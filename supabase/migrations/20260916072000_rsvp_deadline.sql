-- ============================================================================
-- HAVAN Studio — replies close before the gathering starts
--
-- A host shopping for eight people needs to know it is eight. Until now a guest
-- could flip their answer at any point, including while the party was already
-- running, so `going_count` was never final and the host had no moment at which
-- the number stopped moving.
--
-- The rule: replies close two hours before `starts_at`.
--
-- One deliberate exception. A gathering announced less than two hours before it
-- begins ("we're doing this tonight, come over") would otherwise be born closed
-- — its deadline would already be in the past at the instant it was published,
-- and nobody could ever reply. For those, replies stay open until the start
-- time itself. `rsvp_closes_at` encodes that, comparing against created_at.
--
-- This closes *changes* as well as first replies. That is the point: "final
-- response" means final. A guest who said yes and then cannot come after the
-- cutoff has to message the host, which is the honest outcome — the food is
-- already bought either way.
--
-- Enforced here rather than in the client because the client cannot enforce
-- anything. The UI disables the buttons and shows the deadline; this makes the
-- write actually fail.
-- ============================================================================

-- ── the deadline itself ─────────────────────────────────────────────────────
--
-- A function rather than a generated column: `timestamptz - interval` is only
-- STABLE in Postgres (interval arithmetic depends on the session time zone), and
-- a stored generated column requires an IMMUTABLE expression.
create or replace function public.rsvp_closes_at(
  p_starts_at  timestamptz,
  p_created_at timestamptz
)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case
    when p_starts_at is null then null
    -- Announced inside the notice window: take replies until it starts.
    when p_created_at is null or p_created_at > p_starts_at - interval '2 hours'
      then p_starts_at
    else p_starts_at - interval '2 hours'
  end;
$$;

comment on function public.rsvp_closes_at(timestamptz, timestamptz) is
  'The instant replies stop being accepted: two hours before starts_at, or starts_at itself for a gathering published less than two hours ahead.';

grant execute on function public.rsvp_closes_at(timestamptz, timestamptz) to anon, authenticated;

-- ── get_invite: hand the client the deadline and whether it has passed ──────
--
-- Same (text, text) signature, so replacing in place creates no overload.
create or replace function public.get_invite(p_slug text, p_token text default null)
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
  v_close_at timestamptz;
begin
  select * into v_event
  from public.events
  where slug = lower(trim(coalesce(p_slug, '')));

  if not found then
    return null;
  end if;

  v_is_host := (v_uid is not null and v_uid = v_event.host_id);

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

  v_close_at := public.rsvp_closes_at(v_event.starts_at, v_event.created_at);

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
    -- The reply window. Sent to everyone, including guests who have not replied:
    -- a deadline you only learn about after committing is not a deadline.
    'replies_close_at', v_close_at,
    'replies_open',     (v_close_at is null or now() < v_close_at),
    -- Secrets. Coordinates travel with the address, never ahead of it.
    'venue_address',  case when v_unlocked then v_event.venue_address end,
    'door_code',      case when v_unlocked then v_event.door_code end,
    'venue_lat',      case when v_unlocked then v_event.venue_lat end,
    'venue_lng',      case when v_unlocked then v_event.venue_lng end,
    'going_count',    coalesce(v_going, 0),
    'maybe_count',    coalesce(v_maybe, 0),
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
  'Guest-facing read for an invitation. Private events require a valid invitee token. venue_address, door_code and the coordinates are disclosed together, only to the host or a going/maybe guest. Also reports replies_close_at / replies_open.';

grant execute on function public.get_invite(text, text) to anon, authenticated;

-- ── submit_rsvp: refuse writes after the deadline ───────────────────────────
create or replace function public.submit_rsvp(
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
  v_close_at timestamptz;
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

  -- The host is already attending by definition. Letting them reply would count
  -- them among their own guests.
  if v_uid = v_event.host_id then
    raise exception 'You are hosting this one — no need to reply to yourself'
      using errcode = '42501';
  end if;

  -- Checked before the token is resolved, so a late arrival does not burn their
  -- one-time private link on a reply that is going to be rejected anyway.
  v_close_at := public.rsvp_closes_at(v_event.starts_at, v_event.created_at);
  if v_close_at is not null and now() >= v_close_at then
    raise exception 'Replies closed for this gathering'
      using errcode = '42501';
  end if;

  -- Private events: valid token required, and claim it on first use so the link
  -- cannot be passed around. The host early-return above means this branch no
  -- longer needs to special-case them.
  if v_event.is_private then
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
  'Upserts the caller''s reply keyed on auth.uid(). Rejects the event host, and rejects any reply or change once rsvp_closes_at has passed. For private events requires and claims an invitee token.';
