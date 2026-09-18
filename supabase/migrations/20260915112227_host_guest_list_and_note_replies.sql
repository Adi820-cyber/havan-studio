-- ============================================================================
-- HAVAN Studio — host guest list + threaded replies on notes
--
-- Two gaps this closes, both reported as "the host cannot see or answer anyone":
--
--   1. A host had no way to see who replied. `get_invite()` returns only
--      aggregate counts, and RLS lets a host SELECT public.rsvps directly, but
--      nothing exposed the names, contacts, plus-ones or dietary notes together.
--      get_event_guests() does that, and refuses anyone who is not the host.
--
--   2. Notes were a flat list with no way to answer one. comments now has a
--      self-referencing parent_id, so a host can reply underneath a guest's note
--      and the guest can see the answer.
-- ============================================================================

-- ── Threaded notes ──────────────────────────────────────────────────────────
alter table public.comments
  add column parent_id uuid references public.comments (id) on delete cascade;

create index comments_parent_id_idx on public.comments (parent_id);

comment on column public.comments.parent_id is
  'When set, this row is a reply to another note. Top-level notes have NULL.';

-- A reply must live on the same event as the note it answers, otherwise a reply
-- could be smuggled onto an event the author cannot otherwise post to.
create or replace function public.comments_validate_parent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent_event uuid;
begin
  if new.parent_id is null then
    return new;
  end if;

  select event_id into v_parent_event
  from public.comments
  where id = new.parent_id;

  if v_parent_event is null then
    raise exception 'The note being replied to does not exist' using errcode = 'P0002';
  end if;

  if v_parent_event <> new.event_id then
    raise exception 'A reply must belong to the same event as its parent'
      using errcode = '22023';
  end if;

  -- Single level of nesting. Replies to replies turn a guest wall into a forum.
  if exists (select 1 from public.comments where id = new.parent_id and parent_id is not null) then
    raise exception 'Replies cannot be nested further' using errcode = '22023';
  end if;

  return new;
end;
$$;

comment on function public.comments_validate_parent is
  'Keeps replies on the same event as their parent and limits threading to one level.';

create trigger comments_validate_parent_tg
  before insert on public.comments
  for each row execute function public.comments_validate_parent();

-- ── Host guest list ─────────────────────────────────────────────────────────
create or replace function public.get_event_guests(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_uid      uuid := (select auth.uid());
  v_guests   jsonb;
begin
  if v_uid is null then
    raise exception 'Sign in to see your guest list' using errcode = '42501';
  end if;

  select id into v_event_id
  from public.events
  where slug = lower(trim(coalesce(p_slug, '')));

  if v_event_id is null then
    raise exception 'Invitation not found' using errcode = 'P0002';
  end if;

  -- Host only. A guest asking for this gets refused rather than a filtered list,
  -- so there is no ambiguity about whether the data leaked.
  if not public.is_event_host(v_event_id) then
    raise exception 'Only the host can see the guest list' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(to_jsonb(g) order by g.replied_at desc), '[]'::jsonb)
  into v_guests
  from (
    select
      r.id,
      r.guest_name,
      r.contact,
      r.status,
      r.dietary_notes,
      r.plus_ones,
      r.updated_at as replied_at
    from public.rsvps r
    where r.event_id = v_event_id
  ) g;

  return jsonb_build_object(
    'guests', v_guests,
    'counts', jsonb_build_object(
      'going',     (select count(*) from public.rsvps where event_id = v_event_id and status = 'going'),
      'maybe',     (select count(*) from public.rsvps where event_id = v_event_id and status = 'maybe'),
      'not_going', (select count(*) from public.rsvps where event_id = v_event_id and status = 'not_going'),
      'plus_ones', (select coalesce(sum(plus_ones), 0) from public.rsvps
                     where event_id = v_event_id and status = 'going'),
      'head_count',(select coalesce(count(*) + sum(plus_ones), 0) from public.rsvps
                     where event_id = v_event_id and status = 'going')
    )
  );
end;
$$;

comment on function public.get_event_guests is
  'Returns the full guest list for an event. Raises 42501 for anyone who is not the host.';

-- ── Comments now carry threading + a host badge ─────────────────────────────
create or replace function public.get_event_comments(p_slug text, p_limit integer default 100)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_host_id  uuid;
  v_uid      uuid := (select auth.uid());
  v_result   jsonb;
begin
  if v_uid is null then
    return '[]'::jsonb;
  end if;

  select id, host_id into v_event_id, v_host_id
  from public.events
  where slug = lower(trim(coalesce(p_slug, '')));

  if v_event_id is null then
    return '[]'::jsonb;
  end if;

  if not (public.is_event_host(v_event_id) or public.has_rsvp_for_event(v_event_id)) then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at asc), '[]'::jsonb)
  into v_result
  from (
    select
      cm.id,
      cm.parent_id,
      cm.author_name,
      cm.avatar_emoji,
      cm.message,
      cm.created_at,
      (cm.author_id = v_host_id) as from_host,
      (cm.author_id = v_uid)     as mine
    from public.comments cm
    where cm.event_id = v_event_id
    order by cm.created_at asc
    limit greatest(1, least(400, coalesce(p_limit, 100)))
  ) c;

  return v_result;
end;
$$;

comment on function public.get_event_comments is
  'Hype wall for an invite, host or responders only. Includes parent_id for threading plus from_host/mine flags.';

-- ── post_comment gains an optional parent ───────────────────────────────────
-- Drop the 4-argument version FIRST. Creating the 5-argument one alongside it
-- would leave two overloads, and then any unqualified reference to
-- `public.post_comment` (including COMMENT ON) fails with 42725 "not unique".
drop function if exists public.post_comment(text, text, text, text);

create or replace function public.post_comment(
  p_slug        text,
  p_message     text,
  p_author_name text default null,
  p_avatar      text default '✨',
  p_parent_id   uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_host_id  uuid;
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

  select id, host_id into v_event_id, v_host_id
  from public.events
  where slug = lower(trim(coalesce(p_slug, '')));

  if v_event_id is null then
    raise exception 'Invitation not found' using errcode = 'P0002';
  end if;

  if not (public.is_event_host(v_event_id) or public.has_rsvp_for_event(v_event_id)) then
    raise exception 'Reply to the invite first, then you can post on the wall'
      using errcode = '42501';
  end if;

  v_name := coalesce(
    nullif(trim(coalesce(p_author_name, '')), ''),
    (select guest_name from public.rsvps where event_id = v_event_id and guest_id = v_uid),
    (select display_name from public.profiles where id = v_uid),
    'Guest'
  );

  insert into public.comments (event_id, author_id, author_name, avatar_emoji, message, parent_id)
  values (v_event_id, v_uid, left(v_name, 80), coalesce(nullif(p_avatar, ''), '✨'), left(v_msg, 500), p_parent_id)
  returning * into v_row;

  return jsonb_build_object(
    'id',           v_row.id,
    'parent_id',    v_row.parent_id,
    'author_name',  v_row.author_name,
    'avatar_emoji', v_row.avatar_emoji,
    'message',      v_row.message,
    'created_at',   v_row.created_at,
    'from_host',    (v_uid = v_host_id),
    'mine',         true
  );
end;
$$;

comment on function public.post_comment(text, text, text, text, uuid) is
  'Posts a note, or a reply when p_parent_id is supplied. Host or responders only.';

-- ── Grants ──────────────────────────────────────────────────────────────────
revoke all on function public.get_event_guests(text) from public;
revoke execute on function public.get_event_guests(text) from anon;
grant execute on function public.get_event_guests(text) to authenticated;

revoke all on function public.post_comment(text, text, text, text, uuid) from public;
revoke execute on function public.post_comment(text, text, text, text, uuid) from anon;
grant execute on function public.post_comment(text, text, text, text, uuid) to authenticated;
