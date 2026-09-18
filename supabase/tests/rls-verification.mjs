/**
 * Adversarial verification of the Supabase backend.
 *
 * Each numbered check replays one of the exploits that worked against the old
 * JSON-file backend and asserts it now fails. Run this after any change to the
 * schema, the RLS policies, or the SECURITY DEFINER functions.
 *
 * Usage (PowerShell), from the project root:
 *
 *   $env:SB_URL = 'https://<project-ref>.supabase.co'
 *   $env:SB_PUB = '<sb_publishable_... key>'
 *   node supabase/tests/rls-verification.mjs
 *
 * Note: this registers two throwaway accounts and a few anonymous sessions in
 * the linked project on each run, then deletes the event it created (RSVPs and
 * comments cascade). The auth users are left behind; clear them from
 * Dashboard → Authentication → Users if they accumulate.
 */
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SB_URL;
const KEY = process.env.SB_PUB;

const mk = () => createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

let pass = 0, fail = 0;
const ok   = (m, extra = '') => { pass++; console.log(`  PASS  ${m}${extra ? ' — ' + extra : ''}`); };
const bad  = (m, extra = '') => { fail++; console.log(`  FAIL  ${m}${extra ? ' — ' + extra : ''}`); };
const head = (m) => console.log(`\n${m}`);

const stamp = Date.now();
const hostEmail  = `host-${stamp}@havan-test.dev`;
const guestEmail = `guest-${stamp}@havan-test.dev`;
const PASSWORD   = 'HavanTest123';

// ── Set up a real host ───────────────────────────────────────────────────────
head('SETUP — register a host and publish an invitation');
const host = mk();
{
  const { data, error } = await host.auth.signUp({
    email: hostEmail,
    password: PASSWORD,
    options: { data: { display_name: 'Test Host', avatar_emoji: '👑' } }
  });
  if (error) { bad('host signUp', error.message); process.exit(1); }
  ok('host registered', `uid=${data.user.id.slice(0, 8)}…`);
}

// password hashing is Supabase Auth's job — confirm the app schema has no password column
{
  const { error } = await host.from('profiles').select('password').limit(1);
  if (error && /column .*password.* does not exist|does not exist/i.test(error.message)) {
    ok('profiles has no password column (credentials live in auth.users, bcrypt-hashed)');
  } else {
    bad('profiles.password should not exist', error ? error.message : 'query unexpectedly succeeded');
  }
}

let slug;
{
  const startsAt = new Date(Date.now() + 6 * 86400000).toISOString();
  const { data, error } = await host
    .from('events')
    .insert({
      title: 'Chishtia Sufi & Qawwali Night',
      subtitle: 'Candlelit courtyards',
      host_name: 'Test Host',
      description: 'An evening of mystic chants.',
      starts_at: startsAt,
      timezone: 'Asia/Kolkata',
      venue_name: 'The Red Sandstone Haveli Courtyard',
      venue_address: 'Brass Gate #1, Heritage Quarter, Old Delhi',
      door_code: 'CODE: #7721',
      byob_note: 'Saffron tea provided',
      hide_until_rsvp: true,
      theme: { presetId: 'theme-royal-marigold' },
      customization: { vibeTag: 'Sufi Mehfil', effect: 'stardust' }
    })
    .select()
    .single();
  if (error) { bad('host create event', error.message); process.exit(1); }
  slug = data.slug;
  ok('event published', `slug=${slug}`);
  if (data.host_id) ok('host_id pinned server-side by trigger');
  if (/-[0-9a-f]{10}$/.test(slug)) ok('slug carries a random unguessable suffix');
  else bad('slug lacks random suffix', slug);
}

// ── 1. Enumeration ──────────────────────────────────────────────────────────
head('CHECK 1 — anonymous enumeration of every event (old: GET /api/v1/events leaked all)');
{
  const anon = mk();
  const { data, error } = await anon.from('events').select('*');
  if (error) ok('anon SELECT on events blocked', error.message);
  else if (!data || data.length === 0) ok('anon SELECT on events returned 0 rows (RLS: no policy for anon)');
  else bad('anon could read events', `${data.length} rows, door_code=${data[0]?.door_code}`);
}

head('CHECK 2 — a logged-in stranger reading other people\'s events');
const stranger = mk();
{
  const { error: sErr } = await stranger.auth.signUp({ email: guestEmail, password: PASSWORD });
  if (sErr) { bad('stranger signUp', sErr.message); }
  const { data, error } = await stranger.from('events').select('*');
  if (error) ok('stranger SELECT blocked', error.message);
  else if (!data || data.length === 0) ok('stranger SELECT returned 0 rows (host-only policy)');
  else bad('stranger read events', `${data.length} rows`);
}

// ── 3. Secret disclosure before RSVP ────────────────────────────────────────
head('CHECK 3 — get_invite() must hide venue_address/door_code before RSVP');
{
  const anon = mk();
  const { data, error } = await anon.rpc('get_invite', { p_slug: slug });
  if (error) { bad('anon get_invite errored', error.message); }
  else if (!data) { bad('anon get_invite returned null'); }
  else {
    ok('anon can load the invitation by slug', `title="${data.title}"`);
    if (data.venue_address === null && data.door_code === null) ok('venue_address and door_code withheld');
    else bad('secrets leaked pre-RSVP', `address=${data.venue_address} code=${data.door_code}`);
    if (data.is_unlocked === false) ok('is_unlocked = false');
    if (data.venue_name) ok('public venue_name still shown', data.venue_name);
    if (typeof data.going_count === 'number') ok('going_count derived live', `= ${data.going_count}`);
  }
}

head('CHECK 4 — a wrong/guessed slug reveals nothing');
{
  const anon = mk();
  const { data } = await anon.rpc('get_invite', { p_slug: 'sufi-qawwali-night' });
  if (data === null) ok('unknown slug returns null (no substring search, no enumeration)');
  else bad('guessable slug resolved', JSON.stringify(data).slice(0, 120));
}

// ── 5. Guest RSVP via anonymous session ─────────────────────────────────────
head('CHECK 5 — guest RSVPs with an anonymous session and unlocks the venue');
const guestA = mk();
let guestAName = 'Aarav';
{
  const { data: sess, error: sErr } = await guestA.auth.signInAnonymously();
  if (sErr) { bad('anonymous sign-in', sErr.message); process.exit(1); }
  ok('guest got an anonymous session', `uid=${sess.user.id.slice(0, 8)}… is_anonymous=${sess.user.is_anonymous}`);

  const { data, error } = await guestA.rpc('submit_rsvp', {
    p_slug: slug,
    p_guest_name: guestAName,
    p_contact: 'aarav@music.in',
    p_status: 'going',
    p_note: 'Bringing saffron sweets!'
  });
  if (error) { bad('submit_rsvp', error.message); }
  else {
    ok('RSVP accepted');
    if (data.my_rsvp?.guest_name === guestAName) ok('guest_name persisted correctly', `"${data.my_rsvp.guest_name}"`);
    else bad('guest_name wrong', JSON.stringify(data.my_rsvp));
    if (data.venue_address && data.door_code) ok('venue unlocked in the same response', data.door_code);
    else bad('venue not unlocked after going RSVP');
    if (data.is_unlocked === true) ok('is_unlocked = true');
    if (data.going_count === 1) ok('going_count = 1 (real count, not a hardcoded 12)');
    else bad('going_count wrong', String(data.going_count));
  }
}

// ── 6. RSVP hijack ──────────────────────────────────────────────────────────
head('CHECK 6 — hijacking another guest\'s RSVP by claiming their contact (old: worked)');
const guestB = mk();
{
  await guestB.auth.signInAnonymously();
  const { data, error } = await guestB.rpc('submit_rsvp', {
    p_slug: slug,
    p_guest_name: 'HIJACKED',
    p_contact: 'aarav@music.in',      // same contact as guest A
    p_status: 'not_going'
  });
  if (error) { bad('guest B rsvp errored unexpectedly', error.message); }
  else {
    // Guest B gets their OWN row; guest A must be untouched.
    const { data: aView } = await guestA.rpc('get_invite', { p_slug: slug });
    if (aView.my_rsvp.guest_name === guestAName && aView.my_rsvp.status === 'going') {
      ok('guest A\'s RSVP untouched', `still "${aView.my_rsvp.guest_name}" / ${aView.my_rsvp.status}`);
    } else {
      bad('guest A\'s RSVP was overwritten', JSON.stringify(aView.my_rsvp));
    }
    if (data.my_rsvp.guest_name === 'HIJACKED' && data.going_count === 1) {
      ok('guest B got a separate row; counts stay correct', `going=${data.going_count}`);
    }
  }
}

head('CHECK 7 — guest cannot read or modify another guest\'s rsvp row directly');
{
  const { data, error } = await guestB.from('rsvps').select('*');
  if (error) ok('rsvps SELECT blocked', error.message);
  else if (data.length === 1) ok('guest B sees only their own rsvp row (1 of 2)');
  else bad('guest B saw other rows', `${data.length} rows`);

  const { data: upd } = await guestB.from('rsvps')
    .update({ status: 'going' })
    .eq('guest_name', guestAName)
    .select();
  if (!upd || upd.length === 0) ok('cross-guest UPDATE affected 0 rows');
  else bad('cross-guest UPDATE succeeded', JSON.stringify(upd));
}

// ── 8. my-invites leak ──────────────────────────────────────────────────────
head('CHECK 8 — reading someone else\'s invite list (old: ?contact=<email> with no auth)');
{
  const { data, error } = await guestB.rpc('get_my_invites', { p_contact: hostEmail });
  if (error && /p_contact|does not exist|function/i.test(error.message)) {
    ok('get_my_invites rejects a contact argument — the parameter does not exist', error.message.slice(0, 80));
  } else if (!error) {
    const hosted = data?.hosted?.length ?? 0;
    if (hosted === 0) ok('extra arg ignored; guest B sees 0 hosted invites (scoped to auth.uid())');
    else bad('guest B saw hosted invites', String(hosted));
  }

  const { data: mine } = await guestB.rpc('get_my_invites');
  if (mine?.hosted?.length === 0 && mine?.accepted?.length === 1) {
    ok('guest B sees only their own: 0 hosted, 1 accepted');
  } else {
    bad('unexpected my-invites payload', JSON.stringify(mine).slice(0, 160));
  }
}

// ── 9. Host visibility ──────────────────────────────────────────────────────
head('CHECK 9 — host can see their own event and all its RSVPs');
{
  const { data: evs } = await host.from('events').select('*');
  if (evs?.length === 1 && evs[0].door_code) ok('host reads own event including door_code');
  else bad('host cannot read own event', JSON.stringify(evs)?.slice(0, 120));

  const { data: rs } = await host.from('rsvps').select('*');
  if (rs?.length === 2) ok('host reads all RSVPs for their event', `${rs.length} rows`);
  else bad('host RSVP visibility wrong', `${rs?.length} rows`);

  const { data: inv } = await host.rpc('get_my_invites');
  if (inv?.hosted?.length === 1 && inv.hosted[0].going_count === 1) ok('host dashboard counts correct');
  else bad('host dashboard wrong', JSON.stringify(inv?.hosted)?.slice(0, 160));
}

// ── 10. Comment integrity ───────────────────────────────────────────────────
head('CHECK 10 — hype wall stores the message (old: client sent "text", server read "message" → always empty)');
{
  const { data, error } = await guestA.rpc('post_comment', {
    p_slug: slug,
    p_message: 'This message must actually persist'
  });
  if (error) bad('post_comment', error.message);
  else if (data.message === 'This message must actually persist') ok('message persisted verbatim');
  else bad('message not persisted', JSON.stringify(data));

  const { data: list } = await guestA.rpc('get_event_comments', { p_slug: slug });
  const empties = (list || []).filter(c => !c.message || !c.message.trim()).length;
  if (list?.length >= 2 && empties === 0) ok('wall returns non-empty messages', `${list.length} comments, 0 empty`);
  else bad('wall content wrong', `${list?.length} comments, ${empties} empty`);

  const outsider = mk();
  await outsider.auth.signInAnonymously();
  const { data: blocked } = await outsider.rpc('get_event_comments', { p_slug: slug });
  if (Array.isArray(blocked) && blocked.length === 0) ok('non-responder sees an empty wall');
  else bad('non-responder read the wall', JSON.stringify(blocked)?.slice(0, 120));

  const { error: postErr } = await outsider.rpc('post_comment', { p_slug: slug, p_message: 'spam' });
  if (postErr) ok('non-responder cannot post', postErr.message);
  else bad('non-responder posted to the wall');
}

// ── 11. Anonymous users must not be able to host ─────────────────────────────
head('CHECK 11 — anonymous session cannot publish an event (accountability)');
{
  const { error } = await guestB.from('events').insert({
    title: 'Anonymous Party',
    starts_at: new Date(Date.now() + 86400000).toISOString(),
    venue_address: 'somewhere',
    door_code: 'X'
  }).select();
  if (error) ok('anonymous INSERT on events blocked', error.message.slice(0, 90));
  else bad('anonymous user published an event');
}

head('CHECK 12 — status values are constrained');
{
  const { error } = await guestA.rpc('submit_rsvp', {
    p_slug: slug, p_guest_name: 'Aarav', p_status: 'definitely_maybe'
  });
  if (error) ok('invalid status rejected', error.message.slice(0, 70));
  else bad('invalid status accepted');
}

// ── Cleanup ─────────────────────────────────────────────────────────────────
head('CLEANUP');
{
  const { error } = await host.from('events').delete().eq('slug', slug);
  if (error) bad('cleanup delete', error.message);
  else ok('test event deleted (rsvps + comments cascaded)');
}

console.log(`\n${'='.repeat(58)}\nRESULT: ${pass} passed, ${fail} failed\n${'='.repeat(58)}`);
process.exit(fail === 0 ? 0 : 1);
