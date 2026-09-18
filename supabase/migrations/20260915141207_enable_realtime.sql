-- ============================================================================
-- HAVAN Studio — live updates for replies and notes
--
-- The bug: a host watching their own invitation saw nothing when a guest replied
-- or left a note. Counts, the guest list and the wall only moved on a full page
-- reload, which for a host sitting on the page waiting for RSVPs is the one
-- moment the product should feel alive.
--
-- Fix: publish rsvps and comments through Realtime so the client is told when a
-- row appears.
--
-- IMPORTANT DESIGN CHOICE — the client treats these events as a *signal only*.
-- It does not render the payload. On any event it re-calls get_invite /
-- get_event_comments / get_event_guests, which are the functions that already
-- decide what this particular caller may see. Rendering a Realtime payload
-- directly would sidestep that gating, and the whole venue-lock model depends on
-- exactly one place making disclosure decisions.
--
-- Realtime still applies RLS per subscriber, so a subscriber is only notified
-- about rows they could already SELECT. That is a second line of defence rather
-- than the one we rely on.
-- ============================================================================

-- The publication ships with Supabase. Guard anyway so this migration is safe to
-- run against a project where it is absent.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end
$$;

-- Add the two tables, skipping any that are already published.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rsvps'
  ) then
    alter publication supabase_realtime add table public.rsvps;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'comments'
  ) then
    alter publication supabase_realtime add table public.comments;
  end if;
end
$$;

-- REPLICA IDENTITY FULL on rsvps: a reply that *changes* (going -> not_going)
-- is an UPDATE, and with the default identity the old row is reported as the
-- primary key alone. The host's counts need to react to status changes, so the
-- subscriber has to be able to tell an UPDATE apart from an unrelated one.
alter table public.rsvps replica identity full;

-- comments are insert-and-delete only, where the default identity is sufficient.

comment on table public.rsvps is
  'Guest replies. Keyed on (event_id, guest_id) so a reply cannot be overwritten by a stranger. Published via Realtime; clients use events as a refetch signal, never as data.';
comment on table public.comments is
  'Notes and threaded replies. Published via Realtime; clients use events as a refetch signal, never as data.';
