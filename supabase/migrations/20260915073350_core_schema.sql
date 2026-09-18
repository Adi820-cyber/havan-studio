-- ============================================================================
-- HAVAN Studio — core schema
--
-- Replaces the previous data/database.json file store. Notable differences that
-- exist specifically to close findings from the security review:
--
--   * No password column anywhere. Supabase Auth owns credentials and stores
--     them bcrypt-hashed in auth.users. The old store kept plaintext.
--   * No host_key column. Ownership is auth.uid(), not a bearer string that
--     was being handed out by a public list endpoint.
--   * starts_at / ends_at are real timestamptz, not free text plus a
--     fabricated ISO date. Fixes the three-conflicting-dates bug.
--   * guest_count is NOT stored. It is derived by counting rsvps, which fixes
--     the old monotonic counter that could never decrease.
--   * venue_address / door_code live here but are unreachable by guests via
--     table access. RLS restricts events SELECT to the host only; guests read
--     invites exclusively through public.get_invite(), which decides whether to
--     disclose them. See the RLS migration.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Shared trigger: keep updated_at honest
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at is
  'Trigger helper: stamps updated_at = now() on every UPDATE.';

-- ---------------------------------------------------------------------------
-- profiles — public-facing identity for registered hosts.
-- One row per non-anonymous auth user. Deliberately holds no credentials.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null default 'Host',
  avatar_emoji  text not null default '✨',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint profiles_display_name_len check (char_length(display_name) between 1 and 80),
  constraint profiles_avatar_len       check (char_length(avatar_emoji) between 1 and 8)
);

comment on table public.profiles is
  'Display identity for registered hosts. Credentials live in auth.users, never here.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-provision a profile when a real (non-anonymous) user signs up.
-- Anonymous guests intentionally get no profile row: their display name comes
-- from the rsvp they submit, so there is nothing to store.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_anonymous is true then
    return new;
  end if;

  insert into public.profiles (id, display_name, avatar_emoji)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Host'
    ),
    coalesce(nullif(new.raw_user_meta_data ->> 'avatar_emoji', ''), '✨')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user is
  'Creates a public.profiles row for newly registered non-anonymous users.';

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- events — one invitation.
-- ---------------------------------------------------------------------------
create table public.events (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  host_id         uuid not null references auth.users (id) on delete cascade,

  -- Public-safe presentation fields
  title           text not null,
  subtitle        text,
  host_name       text not null default 'Host',
  description     text,
  vibe_tag        text,

  -- Real timestamps
  starts_at       timestamptz not null,
  ends_at         timestamptz,
  timezone        text not null default 'UTC',

  -- Venue. venue_name is public; the next two are the gated secrets.
  venue_name      text not null default 'Secret Venue',
  venue_address   text,
  door_code       text,
  byob_note       text,
  hide_until_rsvp boolean not null default true,

  -- Presentation blobs (theme preset, cover image, seal, borders, rsvp labels,
  -- sound frequencies, particle effect). Kept as jsonb because this is purely
  -- cosmetic data the studio round-trips.
  theme           jsonb not null default '{}'::jsonb,
  customization   jsonb not null default '{}'::jsonb,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint events_title_len      check (char_length(title) between 1 and 200),
  constraint events_slug_format    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint events_slug_len       check (char_length(slug) between 3 and 120),
  constraint events_ends_after     check (ends_at is null or ends_at > starts_at),
  constraint events_theme_object   check (jsonb_typeof(theme) = 'object'),
  constraint events_custom_object  check (jsonb_typeof(customization) = 'object')
);

comment on table public.events is
  'One invitation. RLS restricts SELECT to the host; guests read via public.get_invite(slug).';
comment on column public.events.venue_address is
  'SECRET. Disclosed only by get_invite() to the host or a going/maybe guest.';
comment on column public.events.door_code is
  'SECRET. Disclosed only by get_invite() to the host or a going/maybe guest.';

create index events_host_id_idx    on public.events (host_id);
create index events_starts_at_idx  on public.events (starts_at desc);

create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

-- Server-side slug generation. The client never supplies a slug, so it cannot
-- squat a name or collide with an existing invite.
create or replace function public.generate_event_slug(p_title text)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_base      text;
  v_candidate text;
  v_suffix    text;
begin
  -- Transliterate to ASCII where possible, then reduce to a clean slug body.
  v_base := lower(coalesce(p_title, ''));
  v_base := translate(v_base, 'àáâãäåèéêëìíîïòóôõöùúûüñç', 'aaaaaaeeeeiiiiooooouuuunc');
  v_base := regexp_replace(v_base, '[^a-z0-9]+', '-', 'g');
  v_base := trim(both '-' from v_base);
  v_base := left(v_base, 60);
  v_base := trim(both '-' from v_base);

  if v_base is null or v_base = '' then
    v_base := 'gathering';
  end if;

  -- Random suffix keeps invite URLs unguessable, which matters because knowing
  -- the slug is what grants access to the invitation. gen_random_uuid() is a
  -- built-in (PG13+), so this carries no extension dependency.
  loop
    v_suffix    := left(replace(gen_random_uuid()::text, '-', ''), 10);
    v_candidate := v_base || '-' || v_suffix;
    exit when not exists (select 1 from public.events e where e.slug = v_candidate);
  end loop;

  return v_candidate;
end;
$$;

comment on function public.generate_event_slug is
  'Builds a unique, unguessable slug from a title. Clients never set slugs directly.';

-- Force host_id and slug to trustworthy values regardless of what was sent.
create or replace function public.events_before_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.host_id := auth.uid();

  if new.host_id is null then
    raise exception 'Authentication required to create an event'
      using errcode = '42501';
  end if;

  new.slug := public.generate_event_slug(new.title);
  return new;
end;
$$;

comment on function public.events_before_insert is
  'Pins host_id to auth.uid() and generates the slug server-side on INSERT.';

create trigger events_before_insert_tg
  before insert on public.events
  for each row execute function public.events_before_insert();

-- host_id and slug are immutable after creation.
create or replace function public.events_before_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.host_id := old.host_id;
  new.slug    := old.slug;
  return new;
end;
$$;

comment on function public.events_before_update is
  'Makes host_id and slug immutable on UPDATE.';

create trigger events_before_update_tg
  before update on public.events
  for each row execute function public.events_before_update();

-- ---------------------------------------------------------------------------
-- rsvps — one row per (event, guest).
--
-- The uniqueness key is (event_id, guest_id), NOT (event_id, contact). That is
-- the fix for the hijack: contact is now just data a guest typed about
-- themselves, never an identity claim. Overwriting someone else's RSVP would
-- require their auth session.
-- ---------------------------------------------------------------------------
create table public.rsvps (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.events (id) on delete cascade,
  guest_id       uuid not null references auth.users (id) on delete cascade,

  guest_name     text not null default 'Guest',
  contact        text,
  status         text not null default 'going',
  dietary_notes  text,
  plus_ones      integer not null default 0,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint rsvps_unique_per_guest unique (event_id, guest_id),
  constraint rsvps_status_valid     check (status in ('going', 'maybe', 'not_going')),
  constraint rsvps_plus_ones_range  check (plus_ones between 0 and 20),
  constraint rsvps_guest_name_len   check (char_length(guest_name) between 1 and 80),
  constraint rsvps_contact_len      check (contact is null or char_length(contact) <= 160)
);

comment on table public.rsvps is
  'Guest replies. Keyed on (event_id, guest_id) so an RSVP cannot be overwritten by a stranger.';
comment on column public.rsvps.contact is
  'Self-reported contact detail. NOT an identity claim; guest_id is the identity.';

create index rsvps_event_id_idx on public.rsvps (event_id);
create index rsvps_guest_id_idx on public.rsvps (guest_id);
create index rsvps_going_idx    on public.rsvps (event_id) where status = 'going';

create trigger rsvps_set_updated_at
  before update on public.rsvps
  for each row execute function public.set_updated_at();

create or replace function public.rsvps_pin_guest()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.guest_id := auth.uid();
    if new.guest_id is null then
      raise exception 'Authentication required to RSVP' using errcode = '42501';
    end if;
  else
    new.guest_id := old.guest_id;
    new.event_id := old.event_id;
  end if;
  return new;
end;
$$;

comment on function public.rsvps_pin_guest is
  'Pins guest_id to auth.uid() on INSERT and makes guest_id/event_id immutable on UPDATE.';

create trigger rsvps_pin_guest_tg
  before insert or update on public.rsvps
  for each row execute function public.rsvps_pin_guest();

-- ---------------------------------------------------------------------------
-- comments — the hype wall.
-- ---------------------------------------------------------------------------
create table public.comments (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events (id) on delete cascade,
  author_id     uuid not null references auth.users (id) on delete cascade,

  author_name   text not null default 'Guest',
  avatar_emoji  text not null default '✨',
  message       text not null,

  created_at    timestamptz not null default now(),

  constraint comments_message_len     check (char_length(message) between 1 and 500),
  constraint comments_author_name_len check (char_length(author_name) between 1 and 80),
  constraint comments_avatar_len      check (char_length(avatar_emoji) between 1 and 8)
);

comment on table public.comments is
  'Hype wall messages. message is NOT NULL with a length check, so the old silent-empty-comment bug cannot recur.';

create index comments_event_id_created_idx on public.comments (event_id, created_at desc);

create or replace function public.comments_pin_author()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.author_id := auth.uid();
  if new.author_id is null then
    raise exception 'Authentication required to post' using errcode = '42501';
  end if;
  return new;
end;
$$;

comment on function public.comments_pin_author is
  'Pins author_id to auth.uid() on INSERT.';

create trigger comments_pin_author_tg
  before insert on public.comments
  for each row execute function public.comments_pin_author();
