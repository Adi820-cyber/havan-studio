-- ============================================================================
-- HAVAN Studio — fix execute context after the grant hardening.
--
-- The previous migration revoked EXECUTE too broadly. Two categories of
-- function are called *on behalf of* the user rather than *by* the user, and
-- both still need the calling role to hold EXECUTE:
--
--   a) Functions called from a SECURITY INVOKER trigger body.
--      events_before_insert() calls generate_event_slug(), so revoking EXECUTE
--      from `authenticated` made every INSERT fail with
--      "permission denied for function generate_event_slug".
--      Fix: make the trigger SECURITY DEFINER. It only pins host_id to
--      auth.uid() and derives the slug, so running it as the owner is correct
--      — and auth.uid() is unaffected, because it reads the request's JWT
--      claims rather than the current role.
--
--   b) Functions referenced inside an RLS policy expression.
--      Policy predicates are evaluated as the querying role, so the rsvps
--      host-read policy and both comments policies need `authenticated` to
--      hold EXECUTE on is_event_host() and has_rsvp_for_event(). Grant those
--      back. They are safe to expose: each answers only a yes/no question
--      about the caller's own relationship to an event id the caller must
--      already possess.
--
-- generate_event_slug stays revoked, since after (a) nothing calls it as the
-- end user.
-- ============================================================================

-- (a) Let the insert trigger derive the slug as the function owner.
create or replace function public.events_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- auth.uid() reads request.jwt.claims, so it still resolves to the end user
  -- even though this function now executes as its owner.
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
  'Pins host_id to auth.uid() and generates the slug server-side on INSERT. SECURITY DEFINER so it may call generate_event_slug, which end users cannot execute directly.';

-- (b) RLS policy predicates are evaluated as the querying role.
grant execute on function public.is_event_host(uuid)      to authenticated;
grant execute on function public.has_rsvp_for_event(uuid) to authenticated;
