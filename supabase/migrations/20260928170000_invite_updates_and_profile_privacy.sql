-- Event edit notices and a profile privacy setting that is actually stored.

alter table public.events
  add column if not exists last_update_message text;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'events'
  ) then
    alter publication supabase_realtime add table public.events;
  end if;
exception when undefined_object then
  -- Self-hosted installations can run without Supabase Realtime. The normal
  -- invite refresh on focus still surfaces the saved notice in that setup.
  null;
end;
$$;

-- Return the last edit timestamp and host notice without changing the venue
-- gating rules. A claimed private invite can be reopened by its own signed-in
-- identity even when the guest enters through the dashboard without ?k=.
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
    if v_invitee.id is not null
       and v_invitee.claimed_by is not null
       and (v_uid is null or v_invitee.claimed_by <> v_uid) then
      return null;
    end if;
    if v_invitee.id is null and v_uid is not null then
      select * into v_invitee
      from public.event_invitees
      where event_id = v_event.id and claimed_by = v_uid
      limit 1;
    end if;
    if v_invitee.id is null then
      return null;
    end if;
  end if;

  if v_uid is not null then
    select * into v_rsvp
    from public.rsvps
    where event_id = v_event.id and guest_id = v_uid;
  end if;

  v_unlocked := v_is_host
                or (v_event.hide_until_rsvp is false)
                or (v_rsvp.id is not null and v_rsvp.status in ('going', 'maybe'));
  v_close_at := public.rsvp_closes_at(v_event.starts_at, v_event.created_at);

  select count(*) filter (where status = 'going'),
         count(*) filter (where status = 'maybe')
  into v_going, v_maybe
  from public.rsvps
  where event_id = v_event.id;

  return jsonb_build_object(
    'id', v_event.id,
    'slug', v_event.slug,
    'title', v_event.title,
    'subtitle', v_event.subtitle,
    'host_name', v_event.host_name,
    'description', v_event.description,
    'vibe_tag', v_event.vibe_tag,
    'starts_at', v_event.starts_at,
    'ends_at', v_event.ends_at,
    'timezone', v_event.timezone,
    'venue_name', v_event.venue_name,
    'byob_note', v_event.byob_note,
    'theme', v_event.theme,
    'customization', v_event.customization,
    'created_at', v_event.created_at,
    'updated_at', v_event.updated_at,
    'last_update_message', v_event.last_update_message,
    'is_host', v_is_host,
    'is_private', v_event.is_private,
    'is_unlocked', v_unlocked,
    'replies_close_at', v_close_at,
    'replies_open', (v_close_at is null or now() < v_close_at),
    'venue_address', case when v_unlocked then v_event.venue_address end,
    'door_code', case when v_unlocked then v_event.door_code end,
    'venue_lat', case when v_unlocked then v_event.venue_lat end,
    'venue_lng', case when v_unlocked then v_event.venue_lng end,
    'going_count', coalesce(v_going, 0),
    'maybe_count', coalesce(v_maybe, 0),
    'invited_as', v_invitee.name,
    'my_rsvp', case
      when v_rsvp.id is null then null
      else jsonb_build_object(
        'id', v_rsvp.id,
        'guest_name', v_rsvp.guest_name,
        'contact', v_rsvp.contact,
        'status', v_rsvp.status,
        'dietary_notes', v_rsvp.dietary_notes,
        'plus_ones', v_rsvp.plus_ones,
        'updated_at', v_rsvp.updated_at
      )
    end
  );
end;
$$;

comment on function public.get_invite(text, text) is
  'Guest-facing invitation read with edit notice timestamps; private claimed invitations remain readable by their claimed identity.';
grant execute on function public.get_invite(text, text) to anon, authenticated;

-- The previous RPC accepted p_is_public but omitted it from its UPDATE, and
-- get_my_profile never returned it. Keep the existing profile behavior while
-- persisting and returning that setting.
create or replace function public.get_my_profile()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.profiles;
begin
  if v_uid is null then return null; end if;
  select * into v_row from public.profiles p where p.id = v_uid;
  if not found then return null; end if;

  return jsonb_build_object(
    'id', v_row.id,
    'handle', v_row.handle,
    'display_name', v_row.display_name,
    'avatar_emoji', v_row.avatar_emoji,
    'avatar_url', v_row.avatar_url,
    'is_public', v_row.is_public,
    'bio', v_row.bio,
    'city', v_row.city,
    'instagram', v_row.instagram,
    'vsco', v_row.vsco,
    'spotify', v_row.spotify,
    'playlist_url', v_row.playlist_url,
    'created_at', v_row.created_at,
    'is_me', true
  ) || public.profile_counts(v_uid);
end;
$$;

create or replace function public.get_public_profile(p_handle text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_row public.profiles;
  v_uid uuid := (select auth.uid());
begin
  if p_handle is null or btrim(p_handle) = '' then return null; end if;

  select * into v_row
  from public.profiles p
  where lower(p.handle) = lower(btrim(p_handle));
  if not found then return null; end if;
  if not v_row.is_public and (v_uid is null or v_uid <> v_row.id) then return null; end if;

  return jsonb_build_object(
    'id', v_row.id,
    'handle', v_row.handle,
    'display_name', v_row.display_name,
    'avatar_emoji', v_row.avatar_emoji,
    'avatar_url', v_row.avatar_url,
    'is_public', v_row.is_public,
    'bio', v_row.bio,
    'city', v_row.city,
    'instagram', v_row.instagram,
    'vsco', v_row.vsco,
    'spotify', v_row.spotify,
    'playlist_url', v_row.playlist_url,
    'created_at', v_row.created_at,
    'is_me', (v_uid is not null and v_uid = v_row.id)
  ) || public.profile_counts(v_row.id);
end;
$$;

create or replace function public.update_my_profile(
  p_display_name text default null,
  p_handle       text default null,
  p_bio          text default null,
  p_city         text default null,
  p_avatar_emoji text default null,
  p_avatar_url   text default null,
  p_is_public    boolean default null,
  p_instagram    text default null,
  p_vsco         text default null,
  p_spotify      text default null,
  p_playlist_url text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_handle text;
  v_url text;
  v_authority text;
begin
  if v_uid is null or not exists (select 1 from public.profiles p where p.id = v_uid) then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- These values become clickable/loaded URLs in public profiles. Keep the
  -- database boundary safe even for callers that bypass the backend route.
  foreach v_url in array array[
    nullif(btrim(p_avatar_url), ''),
    nullif(btrim(p_playlist_url), '')
  ] loop
    if v_url is not null then
      v_authority := split_part(split_part(v_url, '/', 3), '?', 1);
      v_authority := split_part(v_authority, '#', 1);
      if char_length(v_url) > 2048
         or lower(left(v_url, 8)) <> 'https://'
         or v_authority = ''
         or position('@' in v_authority) > 0
         or v_url ~ '[[:space:]]' then
        raise exception 'profile_url_invalid' using errcode = '22023';
      end if;
    end if;
  end loop;

  if p_handle is not null then
    v_handle := nullif(lower(btrim(p_handle)), '');
    if v_handle is not null then
      if v_handle !~ '^[a-z0-9._]{2,30}$' then
        raise exception 'handle_invalid' using errcode = '22023';
      end if;
      if exists (select 1 from public.profiles p where lower(p.handle) = v_handle and p.id <> v_uid) then
        raise exception 'handle_taken' using errcode = '23505';
      end if;
    end if;
  end if;

  update public.profiles p set
    display_name = coalesce(nullif(btrim(p_display_name), ''), p.display_name),
    avatar_emoji = coalesce(nullif(btrim(p_avatar_emoji), ''), p.avatar_emoji),
    avatar_url = case when p_avatar_url is null then p.avatar_url else nullif(btrim(p_avatar_url), '') end,
    is_public = coalesce(p_is_public, p.is_public),
    handle = case when p_handle is null then p.handle else v_handle end,
    bio = case when p_bio is null then p.bio else nullif(btrim(p_bio), '') end,
    city = case when p_city is null then p.city else nullif(btrim(p_city), '') end,
    instagram = case when p_instagram is null then p.instagram else public.normalize_social_handle(p_instagram) end,
    vsco = case when p_vsco is null then p.vsco else public.normalize_social_handle(p_vsco) end,
    spotify = case when p_spotify is null then p.spotify else public.normalize_social_handle(p_spotify) end,
    playlist_url = case when p_playlist_url is null then p.playlist_url else nullif(btrim(p_playlist_url), '') end
  where p.id = v_uid;

  return public.get_my_profile();
end;
$$;

-- Functions default to EXECUTE for PUBLIC in PostgreSQL. Remove that implicit
-- grant and expose only the roles that need each profile operation. The
-- backend's service-role client calls get_public_profile directly.
revoke all on function public.get_my_profile() from public, anon;
revoke all on function public.get_public_profile(text) from public;
revoke all on function public.update_my_profile(text, text, text, text, text, text, boolean, text, text, text, text) from public, anon;
revoke all on function public.get_invite(text, text) from public;

grant execute on function public.get_my_profile() to authenticated, service_role;
grant execute on function public.get_public_profile(text) to anon, authenticated, service_role;
grant execute on function public.update_my_profile(text, text, text, text, text, text, boolean, text, text, text, text) to authenticated, service_role;
grant execute on function public.get_invite(text, text) to anon, authenticated, service_role;
