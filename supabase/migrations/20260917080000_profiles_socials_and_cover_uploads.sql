-- ============================================================================
-- HAVAN Studio — user profiles (hosts *and* guests) + host-uploaded cover art.
--
-- Two things this unlocks.
--
-- 1. Profiles. Until now `profiles` held a display name and an emoji, and only
--    a host ever got a row. But the same person is a guest at four parties for
--    every one they throw, so the interesting object is a *person*, not a host:
--    what they've thrown, what they've shown up to, and the handful of links
--    (Instagram, VSCO, a playlist) that are how this cohort actually identifies
--    each other. Everything here is opt-in and nullable — an account with no
--    handle and no socials keeps working exactly as before.
--
-- 2. Cover uploads. Hosts can upload their own artwork instead of picking from
--    the bundled library, which needs a public bucket with a per-user write
--    path.
--
-- Privacy shape, deliberately: the public profile RPC returns display identity,
-- the links the person chose to publish, and two counts. It never returns an
-- email, an event list, a guest list, or anything about a private event. The
-- counts are of events that have already started, so a profile cannot be used to
-- work out what somebody is doing next Saturday.
-- ============================================================================

-- ─────────────────────────── columns ───────────────────────────

alter table public.profiles
  add column if not exists handle       text,
  add column if not exists bio          text,
  add column if not exists city         text,
  add column if not exists instagram    text,
  add column if not exists vsco         text,
  add column if not exists spotify      text,
  add column if not exists playlist_url text;

comment on column public.profiles.handle is
  'Optional public handle, lowercase. Unique. This is the only way to address a profile from outside.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_handle_format'
  ) then
    alter table public.profiles
      add constraint profiles_handle_format
      check (handle is null or handle ~ '^[a-z0-9._]{2,30}$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_bio_len'
  ) then
    alter table public.profiles
      add constraint profiles_bio_len check (bio is null or char_length(bio) <= 280);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_link_len'
  ) then
    alter table public.profiles
      add constraint profiles_link_len check (
        (city is null or char_length(city) <= 80) and
        (instagram is null or char_length(instagram) <= 60) and
        (vsco is null or char_length(vsco) <= 60) and
        (spotify is null or char_length(spotify) <= 60) and
        (playlist_url is null or char_length(playlist_url) <= 400)
      );
  end if;
end $$;

-- Case-insensitive uniqueness. The column is already constrained to lowercase,
-- so this is belt and braces against a future writer that forgets.
create unique index if not exists profiles_handle_key
  on public.profiles (lower(handle))
  where handle is not null;

-- ─────────────────────── guests get a profile too ───────────────────────
--
-- handle_new_user() skips anonymous users, which is still right: an anonymous
-- guest has no account to hang a profile on. But a guest who later signs up
-- should not be missing a row, so backfill anyone who has an auth user and no
-- profile.
insert into public.profiles (id, display_name, avatar_emoji)
select
  u.id,
  coalesce(nullif(u.raw_user_meta_data ->> 'display_name', ''), split_part(coalesce(u.email, 'guest'), '@', 1)),
  coalesce(nullif(u.raw_user_meta_data ->> 'avatar_emoji', ''), '✨')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
  and coalesce(u.is_anonymous, false) = false
on conflict (id) do nothing;

-- ─────────────────────────── helpers ───────────────────────────

-- Counts of gatherings that have already started. Past tense on purpose: a
-- profile should read as a history, not as a schedule somebody can follow.
create or replace function public.profile_counts(p_uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'hosted_count', (
      select count(*) from public.events e
      where e.host_id = p_uid and e.starts_at < now()
    ),
    'attended_count', (
      select count(distinct r.event_id)
      from public.rsvps r
      join public.events e on e.id = r.event_id
      where r.guest_id = p_uid
        and r.status = 'going'
        and e.starts_at < now()
    )
  );
$$;

-- Strips the things people paste instead of a handle: a leading @, a full
-- profile URL, a trailing slash or query string.
create or replace function public.normalize_social_handle(p_value text)
returns text
language sql
immutable
as $$
  select nullif(
    regexp_replace(
      regexp_replace(
        btrim(coalesce(p_value, '')),
        '^(https?://)?(www\.)?[a-z]+\.(com|co)/', '', 'i'
      ),
      '^@|[/?].*$', '', 'g'
    ),
    ''
  );
$$;

-- ─────────────────────────── RPCs ───────────────────────────

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

-- Every parameter defaults to null and null means "leave this alone". Saving one
-- section of the form therefore cannot blank another, which is the failure mode
-- of a naive full-row update. To actually clear a field the client sends an
-- empty string.
create or replace function public.update_my_profile(
  p_display_name text default null,
  p_handle       text default null,
  p_bio          text default null,
  p_city         text default null,
  p_avatar_emoji text default null,
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

  -- An anonymous guest session has no profile row and must not be able to make
  -- one: a profile is a thing you own, and an anonymous session is not owned.
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
    playlist_url = case when p_playlist_url is null then p.playlist_url else nullif(btrim(p_playlist_url), '') end
  where p.id = v_uid;

  return public.get_my_profile();
end;
$$;

-- Public read, by handle only. There is no listing and no id lookup, so this
-- cannot be walked to enumerate the user table.
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

revoke all on function public.profile_counts(uuid)          from public;
revoke all on function public.normalize_social_handle(text) from public;
revoke all on function public.get_my_profile()              from public;
revoke all on function public.get_public_profile(text)      from public;
revoke all on function public.update_my_profile(text, text, text, text, text, text, text, text, text) from public;

grant execute on function public.get_my_profile()         to authenticated;
grant execute on function public.get_public_profile(text) to anon, authenticated;
grant execute on function public.update_my_profile(text, text, text, text, text, text, text, text, text) to authenticated;

-- ─────────────────────── cover artwork bucket ───────────────────────
--
-- Public read: a cover image has to load for a guest who is not signed in, on a
-- link they were sent. The image itself reveals nothing the invite doesn't —
-- the address and door code live in gated columns, never in the artwork.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-covers',
  'event-covers',
  true,
  5242880, -- 5 MB; the client downscales to well under this before uploading
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "event covers: public read"    on storage.objects;
drop policy if exists "event covers: owner writes"   on storage.objects;
drop policy if exists "event covers: owner replaces" on storage.objects;
drop policy if exists "event covers: owner deletes"  on storage.objects;

create policy "event covers: public read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'event-covers');

-- The first path segment must be the caller's own uid, which is what stops one
-- host writing into another's folder or overwriting their cover. Anonymous
-- sessions are refused outright: a guest replying to an invite has no reason to
-- write to the bucket, and allowing it would turn this into open image hosting.
create policy "event covers: owner writes"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'event-covers'
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "event covers: owner replaces"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'event-covers'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'event-covers'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "event covers: owner deletes"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'event-covers'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
