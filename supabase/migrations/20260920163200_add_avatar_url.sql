-- ============================================================================
-- HAVAN Studio — add avatar_url column to profiles
--
-- The old schema stored only avatar_emoji (a single emoji / short string).
-- The new UI lets users pick from a library of portrait images stored at
-- /avatars/png/<n>.png, whose paths exceed the old 8-char constraint.
-- We already raised that constraint to 255 chars in the previous migration.
--
-- Now we add a dedicated avatar_url column so the two concepts (emoji identity
-- vs. a real image) don't share the same column, and we update the two RPCs
-- that read/write profiles to include it.
-- ============================================================================

-- 1. Add the column (nullable — old rows keep their emoji, no backfill needed).
alter table public.profiles
  add column if not exists avatar_url text;

alter table public.profiles
  add constraint profiles_avatar_url_len
  check (avatar_url is null or char_length(avatar_url) <= 500);

-- 2. Re-create get_my_profile() to include avatar_url.
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
    'id',            v_row.id,
    'handle',        v_row.handle,
    'display_name',  v_row.display_name,
    'avatar_emoji',  v_row.avatar_emoji,
    'avatar_url',    v_row.avatar_url,
    'bio',           v_row.bio,
    'city',          v_row.city,
    'instagram',     v_row.instagram,
    'vsco',          v_row.vsco,
    'spotify',       v_row.spotify,
    'playlist_url',  v_row.playlist_url,
    'created_at',    v_row.created_at,
    'is_me',         true
  ) || public.profile_counts(v_uid);
end;
$$;

-- 3. Re-create get_public_profile() to include avatar_url.
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

  return jsonb_build_object(
    'id',           v_row.id,
    'handle',       v_row.handle,
    'display_name', v_row.display_name,
    'avatar_emoji', v_row.avatar_emoji,
    'avatar_url',   v_row.avatar_url,
    'bio',          v_row.bio,
    'city',         v_row.city,
    'instagram',    v_row.instagram,
    'vsco',         v_row.vsco,
    'spotify',      v_row.spotify,
    'playlist_url', v_row.playlist_url,
    'created_at',   v_row.created_at,
    'is_me',        (v_uid is not null and v_uid = v_row.id)
  ) || public.profile_counts(v_row.id);
end;
$$;

-- 4. Re-create update_my_profile() to accept and save p_avatar_url.
--    We must first revoke, then drop old signature, then re-grant because
--    adding a parameter changes the function signature.
revoke all on function public.update_my_profile(text, text, text, text, text, text, text, text, text) from public, authenticated;

drop function if exists public.update_my_profile(text, text, text, text, text, text, text, text, text);

create function public.update_my_profile(
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
    avatar_url   = case when p_avatar_url is null then p.avatar_url else nullif(btrim(p_avatar_url), '') end,
    handle       = case when p_handle       is null then p.handle       else v_handle end,
    bio          = case when p_bio          is null then p.bio          else nullif(btrim(p_bio), '') end,
    city         = case when p_city         is null then p.city         else nullif(btrim(p_city), '') end,
    instagram    = case when p_instagram    is null then p.instagram    else public.normalize_social_handle(p_instagram) end,
    vsco         = case when p_vsco         is null then p.vsco         else public.normalize_social_handle(p_vsco) end,
    spotify      = case when p_spotify      is null then p.spotify      else public.normalize_social_handle(p_spotify) end,
    playlist_url = case when p_playlist_url is null then p.playlist_url else nullif(btrim(p_playlist_url), '') end
  where p.id = v_uid;

  return public.get_my_profile();
end;
$$;

grant execute on function public.update_my_profile(text, text, text, text, text, text, boolean, text, text, text, text) to authenticated;
