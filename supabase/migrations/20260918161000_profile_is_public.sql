-- 1. Add columns to profiles
alter table public.profiles
  add column if not exists is_public boolean not null default true,
  add column if not exists avatar_url text;

comment on column public.profiles.is_public is
  'If true, the profile can be queried publicly by handle.';
comment on column public.profiles.avatar_url is
  'Optional URL to an image avatar. If present, it takes precedence over avatar_emoji.';

-- 2. Update get_my_profile
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
  if v_uid is null then
    return null;
  end if;

  select * into v_row from public.profiles p where p.id = v_uid;
  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id',           v_row.id,
    'handle',       v_row.handle,
    'display_name', v_row.display_name,
    'avatar_emoji', v_row.avatar_emoji,
    'avatar_url',   v_row.avatar_url,
    'is_public',    v_row.is_public,
    'bio',          v_row.bio,
    'city',         v_row.city,
    'instagram',    v_row.instagram,
    'vsco',         v_row.vsco,
    'spotify',      v_row.spotify,
    'playlist_url', v_row.playlist_url,
    'created_at',   v_row.created_at,
    'is_me',        true
  ) || public.profile_counts(v_uid);
end;
$$;

-- 3. Update update_my_profile
create or replace function public.update_my_profile(
  p_display_name text default null,
  p_handle       text default null,
  p_bio          text default null,
  p_city         text default null,
  p_avatar_emoji text default null,
  p_instagram    text default null,
  p_vsco         text default null,
  p_spotify      text default null,
  p_playlist_url text default null,
  p_is_public    boolean default null,
  p_avatar_url   text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_handle text;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (select 1 from public.profiles p where p.id = v_uid) then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_handle is not null then
    v_handle := nullif(lower(btrim(p_handle)), '');
    if v_handle is not null then
      if v_handle !~ '^[a-z0-9._]{2,30}$' then
        raise exception 'handle_invalid' using errcode = '22023';
      end if;
      if exists (
        select 1 from public.profiles p
        where lower(p.handle) = v_handle and p.id <> v_uid
      ) then
        raise exception 'handle_taken' using errcode = '23505';
      end if;
    end if;
  end if;

  update public.profiles p set
    display_name = coalesce(nullif(btrim(p_display_name), ''), p.display_name),
    avatar_emoji = coalesce(nullif(btrim(p_avatar_emoji), ''), p.avatar_emoji),
    handle       = case when p_handle       is null then p.handle       else v_handle end,
    bio          = case when p_bio          is null then p.bio          else nullif(btrim(p_bio), '') end,
    city         = case when p_city         is null then p.city         else nullif(btrim(p_city), '') end,
    instagram    = case when p_instagram    is null then p.instagram    else public.normalize_social_handle(p_instagram) end,
    vsco         = case when p_vsco         is null then p.vsco         else public.normalize_social_handle(p_vsco) end,
    spotify      = case when p_spotify      is null then p.spotify      else public.normalize_social_handle(p_spotify) end,
    playlist_url = case when p_playlist_url is null then p.playlist_url else nullif(btrim(p_playlist_url), '') end,
    is_public    = coalesce(p_is_public, p.is_public),
    avatar_url   = case when p_avatar_url   is null then p.avatar_url   else nullif(btrim(p_avatar_url), '') end
  where p.id = v_uid;

  return public.get_my_profile();
end;
$$;

-- 4. Update get_public_profile
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
  if p_handle is null or btrim(p_handle) = '' then
    return null;
  end if;

  select * into v_row
  from public.profiles p
  where lower(p.handle) = lower(btrim(p_handle));

  if not found then
    return null;
  end if;

  -- Block if not public, unless it's their own profile
  if not v_row.is_public and v_row.id <> v_uid then
    return null;
  end if;

  return jsonb_build_object(
    'id',           v_row.id,
    'handle',       v_row.handle,
    'display_name', v_row.display_name,
    'avatar_emoji', v_row.avatar_emoji,
    'avatar_url',   v_row.avatar_url,
    'is_public',    v_row.is_public,
    'bio',          v_row.bio,
    'city',         v_row.city,
    'instagram',    v_row.instagram,
    'vsco',         v_row.vsco,
    'spotify',      v_row.spotify,
    'playlist_url', v_row.playlist_url,
    'created_at',   v_row.created_at,
    'is_me',        (v_row.id = v_uid)
  ) || public.profile_counts(v_row.id);
end;
$$;
