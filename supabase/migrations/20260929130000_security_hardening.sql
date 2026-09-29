-- Explicit database grants for privileged RPCs, plus an atomic claim for
-- one-person private invite links.

revoke all on function public.get_my_profile() from public, anon, authenticated, service_role;
revoke all on function public.get_public_profile(text) from public, anon, authenticated, service_role;
revoke all on function public.update_my_profile(text, text, text, text, text, text, boolean, text, text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.get_invite(text, text) from public, anon, authenticated, service_role;
revoke all on function public.submit_rsvp(text, text, text, text, text, integer, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.profile_counts(uuid) from public, anon, authenticated, service_role;
revoke all on function public.normalize_social_handle(text) from public, anon, authenticated, service_role;

grant execute on function public.get_my_profile() to authenticated;
grant execute on function public.get_public_profile(text) to anon, authenticated, service_role;
grant execute on function public.update_my_profile(text, text, text, text, text, text, boolean, text, text, text, text)
  to authenticated;
grant execute on function public.get_invite(text, text) to anon, authenticated;
grant execute on function public.submit_rsvp(text, text, text, text, text, integer, text, text)
  to authenticated;

-- Claiming a private invitation was a read-then-write sequence. Two guest
-- sessions using the same link at once could both observe an unclaimed row and
-- the later UPDATE could replace the first claimant. The conditional UPDATE is
-- atomic: only one session can change NULL to its own user id.
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
  v_invitee_id uuid;
  v_name     text := nullif(trim(coalesce(p_guest_name, '')), '');
  v_note     text := nullif(trim(coalesce(p_note, '')), '');
  v_slug     text := lower(trim(coalesce(p_slug, '')));
begin
  if v_uid is null then
    raise exception 'You must have a session to reply' using errcode = '42501';
  end if;

  if p_status not in ('going', 'maybe', 'not_going') then
    raise exception 'Invalid reply' using errcode = '22023';
  end if;

  if v_name is null or char_length(v_name) > 80 then
    raise exception 'Please provide a name of 1 to 80 characters' using errcode = '22023';
  end if;
  if char_length(coalesce(p_contact, '')) > 254
     or char_length(coalesce(p_dietary_notes, '')) > 500
     or char_length(coalesce(v_note, '')) > 500 then
    raise exception 'Reply details are too long' using errcode = '22023';
  end if;

  select * into v_event
  from public.events
  where slug = v_slug;

  if not found then
    raise exception 'Invitation not found' using errcode = 'P0002';
  end if;

  if v_event.is_private and v_uid <> v_event.host_id then
    v_invitee := public.resolve_invitee(v_event.id, p_token);
    if v_invitee.id is null then
      raise exception 'This invitation is for a named guest and the link is not valid for you'
        using errcode = '42501';
    end if;

    if v_invitee.claimed_by is null then
      v_invitee_id := v_invitee.id;
      update public.event_invitees
      set claimed_by = v_uid,
          claimed_at = now()
      where id = v_invitee_id
        and claimed_by is null
      returning * into v_invitee;

      if not found then
        select * into v_invitee
        from public.event_invitees
        where id = v_invitee_id;

        if not found or v_invitee.claimed_by is distinct from v_uid then
          raise exception 'This invitation link has already been used' using errcode = '42501';
        end if;
      end if;
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
    values (v_event.id, v_uid, v_name, v_note);
  end if;

  return public.get_invite(v_slug, p_token);
end;
$$;

revoke all on function public.submit_rsvp(text, text, text, text, text, integer, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.submit_rsvp(text, text, text, text, text, integer, text, text)
  to authenticated;
