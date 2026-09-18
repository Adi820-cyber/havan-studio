-- ============================================================================
-- HAVAN Studio — private invites for named people
--
-- Until now every event was "anyone with the link". For a private party a host
-- needs to invite specific people and have the link work only for them.
--
-- Model: the host adds invitees, each gets their own unguessable token, and the
-- share link becomes /invite/<slug>?k=<token>. For a private event:
--
--   * get_invite() returns NULL without a valid token, so a stranger holding
--     only the slug sees exactly what they would see for a slug that does not
--     exist. No "this is private" disclosure, because that itself confirms the
--     event exists.
--   * The first signed-in person to reply claims the token. After that the same
--     link stops working for anyone else, so forwarding it to a group chat does
--     not quietly widen the guest list.
--   * The host is always allowed through, token or not.
--
-- Public events are unaffected: is_private defaults to false and the token
-- argument is ignored.
-- ============================================================================

alter table public.events
  add column is_private boolean not null default false;

comment on column public.events.is_private is
  'When true, get_invite/submit_rsvp require a valid event_invitees token.';

-- ── Invitee list ────────────────────────────────────────────────────────────
create table public.event_invitees (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  name        text not null,
  contact     text,
  token       text not null unique,
  claimed_by  uuid references auth.users (id) on delete set null,
  claimed_at  timestamptz,
  created_at  timestamptz not null default now(),

  constraint event_invitees_name_len    check (char_length(name) between 1 and 80),
  constraint event_invitees_contact_len check (contact is null or char_length(contact) <= 160),
  constraint event_invitees_token_len   check (char_length(token) between 16 and 64)
);

comment on table public.event_invitees is
  'Named invitees for a private event. One unguessable token each, claimed by the first person to reply with it.';

create index event_invitees_event_id_idx on public.event_invitees (event_id);
create index event_invitees_token_idx    on public.event_invitees (token);

alter table public.event_invitees enable row level security;

-- Only the host of the event can see or manage the list directly. Guests never
-- read this table; they present a token to the access functions instead.
create policy "invitees: host reads own"
  on public.event_invitees for select
  to authenticated
  using (public.is_event_host(event_id));

create policy "invitees: host inserts"
  on public.event_invitees for insert
  to authenticated
  with check (public.is_event_host(event_id));

create policy "invitees: host deletes"
  on public.event_invitees for delete
  to authenticated
  using (public.is_event_host(event_id));

revoke all on table public.event_invitees from anon;

-- ── Token check, shared by the access functions ─────────────────────────────
-- Returns the invitee row when the token is valid for this event and either
-- unclaimed or already claimed by the caller. NULL means "no access".
create or replace function public.resolve_invitee(p_event_id uuid, p_token text)
returns public.event_invitees
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_row public.event_invitees;
  v_uid uuid := (select auth.uid());
begin
  if p_token is null or length(trim(p_token)) = 0 then
    return null;
  end if;

  select * into v_row
  from public.event_invitees
  where event_id = p_event_id
    and token = trim(p_token);

  if not found then
    return null;
  end if;

  -- Already claimed by somebody else: the link has been used.
  if v_row.claimed_by is not null and v_uid is not null and v_row.claimed_by <> v_uid then
    return null;
  end if;

  return v_row;
end;
$$;

comment on function public.resolve_invitee is
  'Validates a private-invite token for an event. Returns NULL when the token is wrong or already claimed by someone else.';

revoke all on function public.resolve_invitee(uuid, text) from public;
revoke execute on function public.resolve_invitee(uuid, text) from anon, authenticated;

-- ── get_invite gains a token ────────────────────────────────────────────────
-- The old single-argument version must be dropped rather than replaced: adding
-- a parameter creates a second overload, and then any unqualified reference
-- fails with 42725 "function name is not unique".
drop function if exists public.get_invite(text);

create function public.get_invite(p_slug text, p_token text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_event    public.events;
  v_uid      uuid := (select auth.uid());
  v_rsvp     public.rsvps;
  v_invitee  public.event_invitees;
  v_is_host  boolean;
  v_unlocked boolean;
  v_going    integer;
  v_maybe    integer;
begin
  select * into v_event
  from public.events
  where slug = lower(trim(coalesce(p_slug, '')));

  if not found then
    return null;
  end if;

  v_is_host := (v_uid is not null and v_uid = v_event.host_id);

  -- Private events: a valid token, or be the host. Otherwise indistinguishable
  -- from a slug that does not exist.
  if v_event.is_private and not v_is_host then
    v_invitee := public.resolve_invitee(v_event.id, p_token);
    if v_invitee.id is null then
      return null;
    end if;
  end if;

  if v_uid is not null then
    select * into v_rsvp
    from public.rsvps
    where event_id = v_event.id
      and guest_id = v_uid;
  end if;

  v_unlocked := v_is_host
                or (v_event.hide_until_rsvp is false)
                or (v_rsvp.id is not null and v_rsvp.status in ('going', 'maybe'));

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
    'is_private',     v_event.is_private,
    'is_unlocked',    v_unlocked,
    'venue_address',  case when v_unlocked then v_event.venue_address end,
    'door_code',      case when v_unlocked then v_event.door_code end,
    'going_count',    coalesce(v_going, 0),
    'maybe_count',    coalesce(v_maybe, 0),
    -- Lets the reply form greet the invited person by name.
    'invited_as',     v_invitee.name,
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

comment on function public.get_invite(text, text) is
  'Guest-facing read for an invitation. Private events require a valid invitee token. Discloses venue_address/door_code only to the host or a going/maybe guest.';

grant execute on function public.get_invite(text, text) to anon, authenticated;

-- ── submit_rsvp gains a token and claims it ─────────────────────────────────
drop function if exists public.submit_rsvp(text, text, text, text, text, integer, text);

create function public.submit_rsvp(
  p_slug          text,
  p_guest_name    text,
  p_contact       text default null,
  p_status        text default 'going',
  p_dietary_notes text default null,
  p_plus_ones     integer default 0,
  p_note          text default null,
  p_token         text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event    public.events;
  v_uid      uuid := (select auth.uid());
  v_invitee  public.event_invitees;
  v_name     text := nullif(trim(coalesce(p_guest_name, '')), '');
  v_note     text := nullif(trim(coalesce(p_note, '')), '');
  v_slug     text := lower(trim(coalesce(p_slug, '')));
begin
  if v_uid is null then
    raise exception 'You must have a session to reply' using errcode = '42501';
  end if;

  if p_status not in ('going', 'maybe', 'not_going') then
    raise exception 'Invalid reply: %', p_status using errcode = '22023';
  end if;

  if v_name is null then
    raise exception 'Please provide your name' using errcode = '22023';
  end if;

  select * into v_event from public.events where slug = v_slug;

  if not found then
    raise exception 'Invitation not found' using errcode = 'P0002';
  end if;

  -- Private events: valid token required, and claim it on first use so the link
  -- cannot be passed around.
  if v_event.is_private and v_uid <> v_event.host_id then
    v_invitee := public.resolve_invitee(v_event.id, p_token);
    if v_invitee.id is null then
      raise exception 'This invitation is for a named guest and the link is not valid for you'
        using errcode = '42501';
    end if;

    if v_invitee.claimed_by is null then
      update public.event_invitees
      set claimed_by = v_uid,
          claimed_at = now()
      where id = v_invitee.id;
    end if;
  end if;

  insert into public.rsvps as r (
    event_id, guest_id, guest_name, contact, status, dietary_notes, plus_ones
  )
  values (
    v_event.id, v_uid, v_name, nullif(trim(coalesce(p_contact, '')), ''),
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
    values (v_event.id, v_uid, v_name, left(v_note, 500));
  end if;

  return public.get_invite(v_slug, p_token);
end;
$$;

comment on function public.submit_rsvp(text, text, text, text, text, integer, text, text) is
  'Upserts the caller''s reply keyed on auth.uid(). For private events requires and claims an invitee token.';

grant execute on function public.submit_rsvp(text, text, text, text, text, integer, text, text) to authenticated;

-- ── Host management of the invitee list ─────────────────────────────────────
create or replace function public.add_event_invitee(
  p_slug    text,
  p_name    text,
  p_contact text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_name     text := nullif(trim(coalesce(p_name, '')), '');
  v_token    text;
  v_row      public.event_invitees;
begin
  if v_name is null then
    raise exception 'Give the guest a name' using errcode = '22023';
  end if;

  select id into v_event_id
  from public.events
  where slug = lower(trim(coalesce(p_slug, '')));

  if v_event_id is null then
    raise exception 'Invitation not found' using errcode = 'P0002';
  end if;

  if not public.is_event_host(v_event_id) then
    raise exception 'Only the host can invite people' using errcode = '42501';
  end if;

  -- 22 hex characters. Guessing one is not a realistic attack.
  v_token := left(replace(gen_random_uuid()::text, '-', ''), 22);

  insert into public.event_invitees (event_id, name, contact, token)
  values (v_event_id, left(v_name, 80), nullif(trim(coalesce(p_contact, '')), ''), v_token)
  returning * into v_row;

  return jsonb_build_object(
    'id', v_row.id,
    'name', v_row.name,
    'contact', v_row.contact,
    'token', v_row.token,
    'claimed', false,
    'created_at', v_row.created_at
  );
end;
$$;

comment on function public.add_event_invitee is
  'Host-only. Adds a named invitee to a private event and returns their personal token.';

create or replace function public.list_event_invitees(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_result   jsonb;
begin
  select id into v_event_id
  from public.events
  where slug = lower(trim(coalesce(p_slug, '')));

  if v_event_id is null then
    raise exception 'Invitation not found' using errcode = 'P0002';
  end if;

  if not public.is_event_host(v_event_id) then
    raise exception 'Only the host can see the invite list' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(to_jsonb(i) order by i.created_at asc), '[]'::jsonb)
  into v_result
  from (
    select
      ei.id,
      ei.name,
      ei.contact,
      ei.token,
      (ei.claimed_by is not null) as claimed,
      ei.claimed_at,
      ei.created_at
    from public.event_invitees ei
    where ei.event_id = v_event_id
  ) i;

  return v_result;
end;
$$;

comment on function public.list_event_invitees is
  'Host-only. Returns the named invitees for an event, including their personal tokens.';

create or replace function public.remove_event_invitee(p_invitee_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
begin
  select event_id into v_event_id
  from public.event_invitees
  where id = p_invitee_id;

  if v_event_id is null then
    return false;
  end if;

  if not public.is_event_host(v_event_id) then
    raise exception 'Only the host can remove an invitee' using errcode = '42501';
  end if;

  delete from public.event_invitees where id = p_invitee_id;
  return true;
end;
$$;

comment on function public.remove_event_invitee is
  'Host-only. Removes a named invitee, revoking their link.';

revoke all on function public.add_event_invitee(text, text, text)    from public;
revoke all on function public.list_event_invitees(text)              from public;
revoke all on function public.remove_event_invitee(uuid)             from public;
revoke execute on function public.add_event_invitee(text, text, text) from anon;
revoke execute on function public.list_event_invitees(text)           from anon;
revoke execute on function public.remove_event_invitee(uuid)          from anon;

grant execute on function public.add_event_invitee(text, text, text) to authenticated;
grant execute on function public.list_event_invitees(text)           to authenticated;
grant execute on function public.remove_event_invitee(uuid)          to authenticated;
