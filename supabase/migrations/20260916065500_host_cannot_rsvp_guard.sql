-- ============================================================================
-- HAVAN Studio — a host cannot reply to their own gathering
--
-- (Carries the change intended for 20260916064707, which was pushed empty. See
-- the note in that file.)
--
-- The reported symptom was cosmetic: the Seen Hai buttons were clickable for the
-- host, and tapping one opened a form asking them to confirm they were coming to
-- their own party.
--
-- The underlying problem was not cosmetic. Nothing stopped the write. A host who
-- tapped "Coming" was inserted into rsvps as a guest of their own event, which
-- then counted them in going_count and head_count and listed them in their own
-- guest list. Hiding the button in the client fixes the prompt; this fixes the
-- data.
-- ============================================================================

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
  'Upserts the caller''s reply keyed on auth.uid(). Rejects the event host. For private events requires and claims an invitee token.';
