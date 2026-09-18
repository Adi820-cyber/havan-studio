/**
 * Verifies per-person private invites.
 *
 * The load-bearing claim: for a private event, someone holding only the slug
 * gets exactly the same answer as for a slug that does not exist. Anything more
 * specific ("this event is private") confirms the event exists.
 */
import { createClient } from '@supabase/supabase-js';

const mk = () =>
  createClient(process.env.SB_URL, process.env.SB_PUB, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

let pass = 0, fail = 0;
const ok = (m, x = '') => { pass++; console.log(`  PASS  ${m}${x ? ' — ' + x : ''}`); };
const bad = (m, x = '') => { fail++; console.log(`  FAIL  ${m}${x ? ' — ' + x : ''}`); };
const head = (m) => console.log(`\n${m}`);

const stamp = Date.now();
const PASSWORD = 'HavanTest123';

head('SETUP — host publishes a PRIVATE event');
const host = mk();
{
  const { error } = await host.auth.signUp({
    email: `host-${stamp}@havan-test.dev`,
    password: PASSWORD,
    options: { data: { display_name: 'Private Host' } }
  });
  if (error) { bad('host signUp', error.message); process.exit(1); }
  ok('host registered');
}

let slug;
{
  const { data, error } = await host
    .from('events')
    .insert({
      title: 'Closed Door Baithak',
      host_name: 'Private Host',
      starts_at: new Date(Date.now() + 5 * 86400000).toISOString(),
      venue_name: 'The Inner Courtyard',
      venue_address: 'Gali 4, Old City',
      door_code: 'CODE: #1191',
      hide_until_rsvp: true,
      is_private: true
    })
    .select()
    .single();
  if (error) { bad('create private event', error.message); process.exit(1); }
  slug = data.slug;
  ok('private event created', slug);
  if (data.is_private === true) ok('is_private persisted');
}

head('CHECK 1 — public control: a NON-private event is still open with the slug');
{
  const { data: pub } = await host
    .from('events')
    .insert({
      title: 'Open House',
      host_name: 'Private Host',
      starts_at: new Date(Date.now() + 6 * 86400000).toISOString(),
      venue_name: 'Rooftop'
    })
    .select()
    .single();
  const anon = mk();
  const { data } = await anon.rpc('get_invite', { p_slug: pub.slug });
  if (data && data.title === 'Open House') ok('public event loads with slug alone, no token');
  else bad('public event stopped working', JSON.stringify(data)?.slice(0, 90));
  await host.from('events').delete().eq('slug', pub.slug);
}

head('CHECK 2 — stranger with only the slug gets NULL (same as a bad slug)');
{
  const anon = mk();
  const { data, error } = await anon.rpc('get_invite', { p_slug: slug });
  if (error) { bad('unexpected error', error.message); }
  else if (data === null) ok('private event returns null without a token');
  else bad('private event leaked to a tokenless caller', JSON.stringify(data).slice(0, 120));

  const { data: nonexistent } = await anon.rpc('get_invite', { p_slug: 'no-such-event-xyz' });
  if (nonexistent === null && data === null) ok('indistinguishable from a nonexistent slug');
}

head('CHECK 3 — host adds a named invitee and gets a token');
let token, inviteeId;
{
  const { data, error } = await host.rpc('add_event_invitee', {
    p_slug: slug,
    p_name: 'Aarav',
    p_contact: 'aarav@music.in'
  });
  if (error) { bad('add_event_invitee', error.message); process.exit(1); }
  token = data.token;
  inviteeId = data.id;
  ok('invitee added', `name=${data.name}`);
  if (token && token.length >= 16) ok('token is long enough to be unguessable', `${token.length} chars`);
  if (data.claimed === false) ok('starts unclaimed');
}

head('CHECK 4 — the token opens the invitation');
{
  const guest = mk();
  const { data, error } = await guest.rpc('get_invite', { p_slug: slug, p_token: token });
  if (error) { bad('token load errored', error.message); }
  else if (!data) { bad('token did not open the invitation'); }
  else {
    ok('invitation opens with the token', `title="${data.title}"`);
    if (data.invited_as === 'Aarav') ok('greets the invited person by name', data.invited_as);
    if (data.venue_address === null) ok('venue still hidden until they reply');
    if (data.is_private === true) ok('flagged private to the client');
  }
}

head('CHECK 5 — a wrong token is refused');
{
  const guest = mk();
  const { data } = await guest.rpc('get_invite', { p_slug: slug, p_token: 'deadbeefdeadbeefdeadbe' });
  if (data === null) ok('wrong token returns null');
  else bad('wrong token was accepted');
}

head('CHECK 6 — invitee replies, token gets claimed, venue unlocks');
const guestA = mk();
{
  await guestA.auth.signInAnonymously();
  const { data, error } = await guestA.rpc('submit_rsvp', {
    p_slug: slug,
    p_guest_name: 'Aarav',
    p_contact: 'aarav@music.in',
    p_status: 'going',
    p_token: token
  });
  if (error) { bad('reply with token', error.message); }
  else {
    ok('reply accepted');
    if (data.venue_address && data.door_code) ok('venue unlocked in the response', data.door_code);
    if (data.going_count === 1) ok('counted');
  }

  const { data: list } = await host.rpc('list_event_invitees', { p_slug: slug });
  const row = (list || []).find((i) => i.id === inviteeId);
  if (row?.claimed === true) ok('token now shows as claimed');
  else bad('token not marked claimed', JSON.stringify(row));
}

head('CHECK 7 — the SAME link no longer works for a different person');
{
  const guestB = mk();
  await guestB.auth.signInAnonymously();

  const { data: view } = await guestB.rpc('get_invite', { p_slug: slug, p_token: token });
  if (view === null) ok('claimed link returns null for a second person');
  else bad('claimed link still opens for someone else', JSON.stringify(view).slice(0, 100));

  const { error } = await guestB.rpc('submit_rsvp', {
    p_slug: slug,
    p_guest_name: 'Forwarded Friend',
    p_status: 'going',
    p_token: token
  });
  if (error) ok('second person cannot reply on a claimed link', error.message.slice(0, 60));
  else bad('forwarded link let a second person reply');
}

head('CHECK 8 — the original invitee can still return');
{
  const { data } = await guestA.rpc('get_invite', { p_slug: slug, p_token: token });
  if (data && data.my_rsvp) ok('claimant still has access and sees their reply', data.my_rsvp.status);
  else bad('claimant lost access', JSON.stringify(data)?.slice(0, 90));
}

head('CHECK 9 — the host never needs a token');
{
  const { data } = await host.rpc('get_invite', { p_slug: slug });
  if (data && data.is_host && data.door_code) ok('host opens their own private event without a token');
  else bad('host locked out of their own event', JSON.stringify(data)?.slice(0, 90));
}

head('CHECK 10 — a guest cannot manage the invite list');
{
  const { error: e1 } = await guestA.rpc('list_event_invitees', { p_slug: slug });
  if (e1) ok('guest refused the invite list', e1.message.slice(0, 55));
  else bad('guest read the invite list');

  const { error: e2 } = await guestA.rpc('add_event_invitee', { p_slug: slug, p_name: 'Gatecrasher' });
  if (e2) ok('guest cannot add invitees', e2.message.slice(0, 55));
  else bad('guest added an invitee');

  const { data: direct } = await guestA.from('event_invitees').select('*');
  if (!direct || direct.length === 0) ok('event_invitees table yields nothing to a guest');
  else bad('guest read event_invitees directly', String(direct.length));
}

head('CHECK 11 — revoking an invitee kills the link');
{
  const { data: fresh } = await host.rpc('add_event_invitee', { p_slug: slug, p_name: 'Meera' });
  const guestC = mk();
  const { data: before } = await guestC.rpc('get_invite', { p_slug: slug, p_token: fresh.token });
  if (before) ok('new invitee link works');

  const { data: removed } = await host.rpc('remove_event_invitee', { p_invitee_id: fresh.id });
  if (removed === true) ok('invitee removed');

  const { data: after } = await guestC.rpc('get_invite', { p_slug: slug, p_token: fresh.token });
  if (after === null) ok('revoked link returns null');
  else bad('revoked link still works');
}

head('CLEANUP');
{
  const { error } = await host.from('events').delete().eq('slug', slug);
  if (error) bad('cleanup', error.message);
  else ok('event deleted, invitees cascaded');
}

console.log(`\n${'='.repeat(56)}\nRESULT: ${pass} passed, ${fail} failed\n${'='.repeat(56)}`);
process.exit(fail === 0 ? 0 : 1);
