-- ============================================================================
-- HAVAN Studio — two corrections found while reviewing the previous migration.
--
-- 1. generate_event_slug() was SECURITY INVOKER. Its uniqueness loop does
--    `select 1 from public.events where slug = candidate`, which under RLS only
--    saw the caller's OWN events. The unique constraint still made a genuine
--    collision fail loudly rather than silently duplicate, but the check was
--    only pretending to work. SECURITY DEFINER so it sees every row.
--
-- 2. `revoke all on function ... from public` in the previous migration was
--    largely cosmetic: Supabase's default privileges grant EXECUTE on new
--    public-schema functions directly to the anon and authenticated roles, and
--    revoking from the PUBLIC pseudo-role does not touch those. The write
--    functions were therefore still EXECUTE-able by anon. They fail safely
--    (each raises when auth.uid() is null), but relying on an internal guard
--    when the grant itself can be removed is the wrong default. Revoke
--    explicitly, and also take anon off these tables entirely — anon has no
--    legitimate reason to touch them directly, since the only anonymous entry
--    point is get_invite().
-- ============================================================================

-- ── 1. Correct the slug uniqueness check ────────────────────────────────────
create or replace function public.generate_event_slug(p_title text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base      text;
  v_candidate text;
  v_suffix    text;
begin
  v_base := lower(coalesce(p_title, ''));
  v_base := translate(v_base, 'àáâãäåèéêëìíîïòóôõöùúûüñç', 'aaaaaaeeeeiiiiooooouuuunc');
  v_base := regexp_replace(v_base, '[^a-z0-9]+', '-', 'g');
  v_base := trim(both '-' from v_base);
  v_base := left(v_base, 60);
  v_base := trim(both '-' from v_base);

  if v_base is null or v_base = '' then
    v_base := 'gathering';
  end if;

  loop
    v_suffix    := left(replace(gen_random_uuid()::text, '-', ''), 10);
    v_candidate := v_base || '-' || v_suffix;
    -- SECURITY DEFINER: this now checks against all events, not just the
    -- caller's, so the loop actually guarantees what it claims to.
    exit when not exists (select 1 from public.events e where e.slug = v_candidate);
  end loop;

  return v_candidate;
end;
$$;

comment on function public.generate_event_slug is
  'Builds a unique, unguessable slug from a title. SECURITY DEFINER so the uniqueness check sees all rows. Clients never set slugs directly.';

-- ── 2. Take anon off the tables ─────────────────────────────────────────────
-- RLS already yields zero rows for anon, but removing the grant means a future
-- permissive policy cannot accidentally open these up to unauthenticated reads.
revoke all on table public.profiles from anon;
revoke all on table public.events   from anon;
revoke all on table public.rsvps    from anon;
revoke all on table public.comments from anon;

-- ── 3. Explicit function grants ─────────────────────────────────────────────
-- Internal predicates: not part of the client API surface at all.
revoke execute on function public.is_event_host(uuid)        from anon, authenticated;
revoke execute on function public.has_rsvp_for_event(uuid)   from anon, authenticated;
revoke execute on function public.generate_event_slug(text)  from anon, authenticated;

-- Writes require a session. Revoking anon means an unauthenticated caller is
-- refused by the grant, before the function's own auth.uid() guard is reached.
revoke execute on function public.submit_rsvp(text, text, text, text, text, integer, text) from anon;
revoke execute on function public.post_comment(text, text, text, text)                     from anon;
revoke execute on function public.get_event_comments(text, integer)                        from anon;
revoke execute on function public.get_my_invites()                                          from anon;

-- get_invite stays reachable by anon: opening an invitation link has to work
-- before any session exists. It discloses no secrets to an unentitled caller.
grant execute on function public.get_invite(text) to anon, authenticated;

grant execute on function public.submit_rsvp(text, text, text, text, text, integer, text) to authenticated;
grant execute on function public.post_comment(text, text, text, text)                     to authenticated;
grant execute on function public.get_event_comments(text, integer)                        to authenticated;
grant execute on function public.get_my_invites()                                          to authenticated;
