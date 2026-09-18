-- ============================================================================
-- HAVAN Studio — venue coordinates from OpenStreetMap
--
-- The host picks their venue from OpenStreetMap search results, which gives us a
-- lat/lng pair. That makes the guest's "open in maps" link land on the exact
-- point instead of running a fuzzy text search that can resolve to the wrong
-- "Terrace Garden" in another city.
--
-- SECURITY NOTE, and the reason this is a migration rather than a client change:
-- coordinates are MORE revealing than a street address, not less. A lat/lng is
-- an exact pin. They are therefore gated by the same `v_unlocked` condition as
-- venue_address and door_code — an un-replied guest receives null for all three.
-- Returning coordinates while withholding the address would defeat the lock
-- entirely, since anyone could paste them into a map.
-- ============================================================================

alter table public.events
  add column venue_lat numeric(9, 6),
  add column venue_lng numeric(9, 6),
  -- The human-readable place name OSM gave back, kept so the host can see what
  -- they picked without re-querying.
  add column venue_osm_label text;

comment on column public.events.venue_lat is
  'SECRET. Latitude of the venue. Disclosed only alongside venue_address.';
comment on column public.events.venue_lng is
  'SECRET. Longitude of the venue. Disclosed only alongside venue_address.';
comment on column public.events.venue_osm_label is
  'Display name returned by OpenStreetMap for the chosen venue.';

alter table public.events
  add constraint events_venue_lat_range
    check (venue_lat is null or venue_lat between -90 and 90),
  add constraint events_venue_lng_range
    check (venue_lng is null or venue_lng between -180 and 180);

-- ── get_invite: same signature, so a plain replace is safe here ─────────────
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
  'Guest-facing read for an invitation. Private events require a valid invitee token. venue_address, door_code and the coordinates are disclosed together, only to the host or a going/maybe guest.';

grant execute on function public.get_invite(text, text) to anon, authenticated;
