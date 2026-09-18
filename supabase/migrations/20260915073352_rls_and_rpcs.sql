-- ============================================================================
-- HAVAN Studio — Row Level Security + gated access functions
--
-- Access model, and which review finding each part closes:
--
--   events SELECT is host-only. There is deliberately no policy that lets a
--   guest read the events table. A guest running `select * from events` gets
--   zero rows.  → closes: GET /api/v1/events leaked every address, door_code
--   and host_key to anonymous callers, and /invites/check/:q allowed
--   enumerating every gathering by title substring.
--
--   Guests reach an invitation only through get_invite(slug). A uuid-suffixed
--   slug is the capability; there is no listing endpoint to discover one.
--
--   get_invite() is the single place that decides whether venue_address and
--   door_code are disclosed. Because it is SECURITY DEFINER, that decision is
--   enforced by the database rather than by client-side sanitising that a
--   second endpoint could bypass.
--
--   submit_rsvp() writes rows keyed to auth.uid(). Contact is data, not
--   identity.  → closes: anyone could overwrite another guest's RSVP by
--   posting their email address.
--
--   get_my_invites() takes no arguments and reads auth.uid().  → closes:
--   GET /my-invites?contact=<email> returned any user's invites with no auth.
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.events   enable row level security;
alter table public.rsvps    enable row level security;
alter table public.comments enable row level security;

-- ---------------------------------------------------------------------------
-- Helper predicates. STABLE + SECURITY DEFINER so policies can consult other
-- tables without recursing back through RLS.
-- ---------------------------------------------------------------------------
create or replace function public.is_event_host(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.events e
    where e.id = p_event_id
      and e.host_id = (select auth.uid())
  );
$$;

comment on function public.is_event_host is
  'True when the caller owns the event. SECURITY DEFINER to avoid RLS recursion in policies.';

create or replace function public.has_rsvp_for_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.rsvps r
    where r.event_id = p_event_id
      and r.guest_id = (select auth.uid())
  );
$$;

comment on function public.has_rsvp_for_event is
  'True when the caller has any RSVP row for the event. Used to gate the hype wall.';

-- ---------------------------------------------------------------------------
-- profiles: a user sees and edits only their own profile.
-- INSERT is handled by the on_auth_user_created trigger, so no INSERT policy.
-- ---------------------------------------------------------------------------
create policy "profiles: read own"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles: update own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ---------------------------------------------------------------------------
-- events
--
-- No SELECT policy for anon, and none for guests. Host only. Guest reads go
-- through get_invite().
-- ---------------------------------------------------------------------------
create policy "events: host reads own"
  on public.events for select
  to authenticated
  using ((select auth.uid()) = host_id);

-- Hosting requires a real account. Anonymous sessions exist so guests can RSVP
-- without signing up; they must not be able to publish events, because an
-- anonymous host could never prove ownership later.
create policy "events: registered users create"
  on public.events for insert
  to authenticated
  with check (
    (select auth.uid()) is not null
    and coalesce((select auth.jwt() ->> 'is_anonymous')::boolean, false) is false
  );

create policy "events: host updates own"
  on public.events for update
  to authenticated
  using ((select auth.uid()) = host_id)
  with check ((select auth.uid()) = host_id);

create policy "events: host deletes own"
  on public.events for delete
  to authenticated
  using ((select auth.uid()) = host_id);

-- ---------------------------------------------------------------------------
-- rsvps
--
-- A guest reads and writes only their own row. The host can read every RSVP
-- for their own events. event_id is an unguessable uuid, so being able to name
-- one is itself the capability to reply to it.
-- ---------------------------------------------------------------------------
create policy "rsvps: guest reads own"
  on public.rsvps for select
  to authenticated
  using ((select auth.uid()) = guest_id);

create policy "rsvps: host reads all for own events"
  on public.rsvps for select
  to authenticated
  using (public.is_event_host(event_id));

create policy "rsvps: guest inserts own"
  on public.rsvps for insert
  to authenticated
  with check ((select auth.uid()) = guest_id);

create policy "rsvps: guest updates own"
  on public.rsvps for update
  to authenticated
  using ((select auth.uid()) = guest_id)
  with check ((select auth.uid()) = guest_id);

create policy "rsvps: guest deletes own"
  on public.rsvps for delete
  to authenticated
  using ((select auth.uid()) = guest_id);

-- ---------------------------------------------------------------------------
-- comments: visible to the host and to anyone who has replied to the invite.
-- ---------------------------------------------------------------------------
create policy "comments: readable by host and responders"
  on public.comments for select
  to authenticated
  using (
    public.is_event_host(event_id)
    or public.has_rsvp_for_event(event_id)
  );

create policy "comments: responders and host post"
  on public.comments for insert
  to authenticated
  with check (
    (select auth.uid()) = author_id
    and (
      public.is_event_host(event_id)
      or public.has_rsvp_for_event(event_id)
    )
  );

create policy "comments: author deletes own"
  on public.comments for delete
  to authenticated
  using ((select auth.uid()) = author_id);

-- ============================================================================
-- Access functions
-- ============================================================================

-- ---------------------------------------------------------------------------
-- get_invite(slug) — the only guest-facing read path.
--
-- Always returns the presentation fields. Returns venue_address and door_code
-- only when the caller is the host, or has RSVP'd going/maybe, or the host
-- chose not to hide the venue at all.
-- ---------------------------------------------------------------------------
create or replace function public.get_invite(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_event      public.events;
  v_uid        uuid := (select auth.uid());
  v_rsvp       public.rsvps;
  v_is_host    boolean;
  v_unlocked   boolean;
  v_going      integer;
  v_maybe      integer;
begin
  select * into v_event
  from public.events
  where slug = lower(trim(coalesce(p_slug, '')));

  if not found then
    return null;
  end if;

  v_is_host := (v_uid is not null and v_uid = v_event.host_id);

  if v_uid is not null then
    select * into v_rsvp
    from public.rsvps
    where event_id = v_event.id
      and guest_id = v_uid;
  end if;

  -- The disclosure decision, in exactly one place.
  v_unlocked := v_is_host
                or (v_event.hide_until_rsvp is false)
                or (v_rsvp.id is not null and v_rsvp.status in ('going', 'maybe'));

  -- Live counts, derived. Never a stored counter that can only increase.
  select
    count(*) filter (where status = 'going'),
    count(*) filter (where status = 'maybe')
  into v_going, v_maybe
  from public.rsvps
  where event_id = v_event.id;

  return jsonb_build_object(
    'id',             v_event.id,
    'slug',           v_event.slug,
    'title',          v_event.title,
    'subtitle',       v_event.subtitle,
    'host_name',      v_event.host_name,
    'description',    v_event.description,
    'vibe_tag',       v_event.vibe_tag,
    'starts_at',      v_event.starts_at,
    'ends_at',        v_event.ends_at,
    'timezone',       v_event.timezone,
    'venue_name',     v_event.venue_name,
    'byob_note',      v_event.byob_note,
    'theme',          v_event.theme,
    'customization',  v_event.customization,
    'created_at',     v_event.created_at,
    'is_host',        v_is_host,
    'is_unlocked',    v_unlocked,
    -- Secrets, present only when entitled.
    'venue_address',  case when v_unlocked then v_event.venue_address end,
    'door_code',      case when v_unlocked then v_event.door_code end,
    'going_count',    coalesce(v_going, 0),
    'maybe_count',    coalesce(v_maybe, 0),
    'my_rsvp',        case
                        when v_rsvp.id is null then null
                        else jsonb_build_object(
                          'id',            v_rsvp.id,
                          'guest_name',    v_rsvp.guest_name,
                          'contact',       v_rsvp.contact,
                          'status',        v_rsvp.status,
                          'dietary_notes', v_rsvp.dietary_notes,
                          'plus_ones',     v_rsvp.plus_ones,
                          'updated_at',    v_rsvp.updated_at
                        )
                      end
  );
end;
$$;

comment on function public.get_invite is
  'Single guest-facing read path for an invitation. Discloses venue_address/door_code only to the host or a going/maybe guest.';

-- ---------------------------------------------------------------------------
-- submit_rsvp(...) — upsert the caller's reply, optionally post a note, and
-- return the freshly-evaluated invite in one round trip.
--
-- One call, one documented return shape. The old flow needed three requests
-- with mismatched field names and crashed reading a key the server never sent.
-- ---------------------------------------------------------------------------
create or replace function public.submit_rsvp(
  p_slug          text,
  p_guest_name    text,
  p_contact       text default null,
  p_status        text default 'going',
  p_dietary_notes text default null,
  p_plus_ones     integer default 0,
  p_note          text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_uid      uuid := (select auth.uid());
  v_name     text := nullif(trim(coalesce(p_guest_name, '')), '');
  v_note     text := nullif(trim(coalesce(p_note, '')), '');
  v_slug     text := lower(trim(coalesce(p_slug, '')));
begin
  if v_uid is null then
    raise exception 'You must have a session to RSVP' using errcode = '42501';
  end if;

  if p_status not in ('going', 'maybe', 'not_going') then
    raise exception 'Invalid RSVP status: %', p_status using errcode = '22023';
  end if;

  if v_name is null then
    raise exception 'Please provide your name' using errcode = '22023';
  end if;

  select id into v_event_id from public.events where slug = v_slug;

  if v_event_id is null then
    raise exception 'Invitation not found' using errcode = 'P0002';
  end if;

  insert into public.rsvps as r (
    event_id, guest_id, guest_name, contact, status, dietary_notes, plus_ones
  )
  values (
    v_event_id, v_uid, v_name, nullif(trim(coalesce(p_contact, '')), ''),
    p_status, nullif(trim(coalesce(p_dietary_notes, '')), ''),
    greatest(0, least(20, coalesce(p_plus_ones, 0)))
  )
  on conflict (event_id, guest_id) do update
    set guest_name    = excluded.guest_name,
        contact       = coalesce(excluded.contact, r.contact),
        status        = excluded.status,
        dietary_notes = coalesce(excluded.dietary_notes, r.dietary_notes),
        plus_ones     = excluded.plus_ones,
        updated_at    = now();

  if v_note is not null then
    insert into public.comments (event_id, author_id, author_name, message)
    values (v_event_id, v_uid, v_name, left(v_note, 500));
  end if;

  return public.get_invite(v_slug);
end;
$$;

comment on function public.submit_rsvp is
  'Upserts the caller''s RSVP keyed on auth.uid(), optionally posts a note, and returns the re-evaluated invite.';

-- ---------------------------------------------------------------------------
-- post_comment(slug, message, author_name) — hype wall write by slug.
-- ---------------------------------------------------------------------------
create or replace function public.post_comment(
  p_slug        text,
  p_message     text,
  p_author_name text default null,
  p_avatar      text default '✨'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_uid      uuid := (select auth.uid());
  v_msg      text := nullif(trim(coalesce(p_message, '')), '');
  v_name     text;
  v_row      public.comments;
begin
  if v_uid is null then
    raise exception 'You must have a session to post' using errcode = '42501';
  end if;

  if v_msg is null then
    raise exception 'Message cannot be empty' using errcode = '22023';
  end if;

  select id into v_event_id
  from public.events
  where slug = lower(trim(coalesce(p_slug, '')));

  if v_event_id is null then
    raise exception 'Invitation not found' using errcode = 'P0002';
  end if;

  -- Only the host or someone who has replied may post.
  if not (public.is_event_host(v_event_id) or public.has_rsvp_for_event(v_event_id)) then
    raise exception 'RSVP first to post on the wall' using errcode = '42501';
  end if;

  v_name := coalesce(
    nullif(trim(coalesce(p_author_name, '')), ''),
    (select guest_name from public.rsvps where event_id = v_event_id and guest_id = v_uid),
    (select display_name from public.profiles where id = v_uid),
    'Guest'
  );

  insert into public.comments (event_id, author_id, author_name, avatar_emoji, message)
  values (v_event_id, v_uid, left(v_name, 80), coalesce(nullif(p_avatar, ''), '✨'), left(v_msg, 500))
  returning * into v_row;

  return jsonb_build_object(
    'id',           v_row.id,
    'author_name',  v_row.author_name,
    'avatar_emoji', v_row.avatar_emoji,
    'message',      v_row.message,
    'created_at',   v_row.created_at
  );
end;
$$;

comment on function public.post_comment is
  'Posts a hype-wall message by slug. Requires the caller to be the host or to have RSVP''d.';

-- ---------------------------------------------------------------------------
-- get_event_comments(slug) — read the wall for an invite the caller can see.
-- ---------------------------------------------------------------------------
create or replace function public.get_event_comments(p_slug text, p_limit integer default 100)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_uid      uuid := (select auth.uid());
  v_result   jsonb;
begin
  if v_uid is null then
    return '[]'::jsonb;
  end if;

  select id into v_event_id
  from public.events
  where slug = lower(trim(coalesce(p_slug, '')));

  if v_event_id is null then
    return '[]'::jsonb;
  end if;

  if not (public.is_event_host(v_event_id) or public.has_rsvp_for_event(v_event_id)) then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(row_to_json(c)::jsonb order by c.created_at desc), '[]'::jsonb)
  into v_result
  from (
    select id, author_name, avatar_emoji, message, created_at
    from public.comments
    where event_id = v_event_id
    order by created_at desc
    limit greatest(1, least(200, coalesce(p_limit, 100)))
  ) c;

  return v_result;
end;
$$;

comment on function public.get_event_comments is
  'Returns hype-wall messages for an invite, but only to the host or a guest who has RSVP''d.';

-- ---------------------------------------------------------------------------
-- get_my_invites() — takes no arguments on purpose.
--
-- Identity comes from auth.uid(). There is no contact parameter, so there is
-- no way to ask for somebody else's invitations.
-- ---------------------------------------------------------------------------
create or replace function public.get_my_invites()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_hosted   jsonb;
  v_accepted jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('hosted', '[]'::jsonb, 'accepted', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(h order by h.starts_at desc), '[]'::jsonb)
  into v_hosted
  from (
    select
      e.id,
      e.slug,
      e.title,
      e.subtitle,
      e.starts_at,
      e.venue_name,
      e.theme,
      e.customization,
      (select count(*) from public.rsvps r
        where r.event_id = e.id and r.status = 'going') as going_count
    from public.events e
    where e.host_id = v_uid
  ) h;

  select coalesce(jsonb_agg(a order by a.starts_at desc), '[]'::jsonb)
  into v_accepted
  from (
    select
      e.id,
      e.slug,
      e.title,
      e.subtitle,
      e.starts_at,
      e.venue_name,
      e.theme,
      e.customization,
      r.status      as my_status,
      r.guest_name  as my_guest_name
    from public.rsvps r
    join public.events e on e.id = r.event_id
    where r.guest_id = v_uid
  ) a;

  return jsonb_build_object('hosted', v_hosted, 'accepted', v_accepted);
end;
$$;

comment on function public.get_my_invites is
  'Returns the caller''s hosted and replied-to invitations. Identity is auth.uid(); there is deliberately no contact parameter.';

-- ---------------------------------------------------------------------------
-- Execution grants.
--
-- Revoke the implicit PUBLIC grant first, then grant deliberately. get_invite
-- is reachable by anon so an invitation link works before a session exists;
-- everything that writes requires at least an anonymous session.
-- ---------------------------------------------------------------------------
revoke all on function public.get_invite(text)                                          from public;
revoke all on function public.submit_rsvp(text, text, text, text, text, integer, text)  from public;
revoke all on function public.post_comment(text, text, text, text)                      from public;
revoke all on function public.get_event_comments(text, integer)                          from public;
revoke all on function public.get_my_invites()                                           from public;
revoke all on function public.is_event_host(uuid)                                        from public;
revoke all on function public.has_rsvp_for_event(uuid)                                   from public;
revoke all on function public.generate_event_slug(text)                                  from public;

grant execute on function public.get_invite(text)                                         to anon, authenticated;
grant execute on function public.submit_rsvp(text, text, text, text, text, integer, text) to authenticated;
grant execute on function public.post_comment(text, text, text, text)                     to authenticated;
grant execute on function public.get_event_comments(text, integer)                        to authenticated;
grant execute on function public.get_my_invites()                                         to authenticated;
grant execute on function public.is_event_host(uuid)                                      to authenticated;
grant execute on function public.has_rsvp_for_event(uuid)                                 to authenticated;
