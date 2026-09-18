/**
 * Verifies the reply deadline is enforced by the database, not just hidden in
 * the UI.
 *
 * The rule under test: replies close two hours before starts_at, except for a
 * gathering published less than two hours ahead, which accepts replies until it
 * begins. Both the first reply and later changes are blocked once closed —
 * "final response" has to actually be final or the host's headcount keeps moving.
 *
 * Worth stating why each case is here:
 *   - A client-side disabled button proves nothing; the RPC has to refuse.
 *   - The late-publish exception is the one that would silently break same-day
 *     parties, so it gets its own check rather than being assumed.
 *   - A guest who replied while open must keep their venue access afterwards.
 *     Closing the window should stop writes, not revoke what was disclosed.
 *   - A private guest hitting a closed window must NOT have their one-time token
 *     consumed, or the deadline would quietly destroy their invite.
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

const HOUR = 3600000;
const stamp = Date.now();
const PASSWORD = 'HavanTest123';

/** A signed-in anonymous guest. */
async function guest() {
  const c = mk();
  await c.auth.signInAnonymously();
  return c;
}

head('SETUP');
const host = mk();
{
  const { error } = await host.auth.signUp({
    email: `deadline-${stamp}@havan-test.dev`,
    password: PASSWORD,
    options: { data: { display_name: 'Deadline Host' } }
  });
  if (error) { bad('signUp', error.message); process.exit(1); }
  ok('host registered');
}

/** Creates an event starting `hoursFromNow` from now. Returns its slug. */
async function makeEvent(label, hoursFromNow, extra = {}) {
  const { data, error } = await host
    .from('events')
    .insert({
      title: label,
      host_name: 'Deadline Host',
      starts_at: new Date(Date.now() + hoursFromNow * HOUR).toISOString(),
      venue_name: 'The Terrace',
      venue_address: '12 Rooftop Lane',
      door_code: 'CODE: #7788',
      ...extra
    })
    .select()
    .single();
  if (error) { bad(`create event (${label})`, error.message); return null; }
  return data.slug;
}

const created = [];

/* ────────────────────────────────────────────────────────────────────────── */
head('CHECK 1 — a gathering well in the future is open, and reports its deadline');
{
  const slug = await makeEvent('Open Window Party', 48);
  created.push(slug);

  const g = await guest();
  const { data, error } = await g.rpc('get_invite', { p_slug: slug, p_token: null });

  if (error) {
    bad('get_invite failed', error.message);
  } else if (!data) {
    bad('get_invite returned null');
  } else {
    if (data.replies_open === true) ok('replies_open is true');
    else bad('replies_open should be true', String(data.replies_open));

    if (data.replies_close_at) {
      ok('replies_close_at is present', data.replies_close_at);
      const gap = (new Date(data.starts_at) - new Date(data.replies_close_at)) / HOUR;
      // Allow a little slack for clock/rounding.
      if (Math.abs(gap - 2) < 0.02) ok('deadline is exactly 2h before the start', `${gap.toFixed(3)}h`);
      else bad('deadline is not 2h before the start', `${gap.toFixed(3)}h`);
    } else {
      bad('replies_close_at missing from get_invite');
    }
  }

  const { error: rsvpErr } = await g.rpc('submit_rsvp', {
    p_slug: slug,
    p_guest_name: 'Early Bird',
    p_status: 'going'
  });
  if (rsvpErr) bad('reply inside the window was rejected', rsvpErr.message);
  else ok('reply inside the window accepted');
}

/* ────────────────────────────────────────────────────────────────────────── */
head('CHECK 2 — inside the last 2 hours the window is CLOSED and the write fails');
{
  // Starts in 1 hour. created_at is now, which is NOT earlier than
  // starts_at - 2h, so the late-publish exception would apply — defeating the
  // test. Backdate created_at so this reads as a properly planned event whose
  // deadline has since passed.
  const slug = await makeEvent('Nearly Starting Party', 1);
  created.push(slug);

  const { error: backdateErr } = await host
    .from('events')
    .update({ created_at: new Date(Date.now() - 10 * HOUR).toISOString() })
    .eq('slug', slug);
  if (backdateErr) bad('could not backdate created_at', backdateErr.message);

  const g = await guest();
  const { data } = await g.rpc('get_invite', { p_slug: slug, p_token: null });

  if (data?.replies_open === false) ok('replies_open is false');
  else bad('replies_open should be false', String(data?.replies_open));

  const { error } = await g.rpc('submit_rsvp', {
    p_slug: slug,
    p_guest_name: 'Late Comer',
    p_status: 'going'
  });
  if (error && /closed/i.test(error.message)) ok('reply REJECTED after the deadline', error.message);
  else if (error) bad('rejected, but with an unexpected message', error.message);
  else bad('LATE REPLY WAS ACCEPTED — deadline not enforced');

  // And it really did not land.
  const { data: after } = await g.rpc('get_invite', { p_slug: slug, p_token: null });
  if (after?.my_rsvp == null) ok('no rsvp row was written');
  else bad('an rsvp row exists despite the rejection', JSON.stringify(after.my_rsvp));
  if ((after?.going_count ?? 0) === 0) ok('going_count still 0');
  else bad('going_count moved after a rejected reply', String(after?.going_count));
}

/* ────────────────────────────────────────────────────────────────────────── */
head('CHECK 3 — a guest cannot CHANGE their answer after the deadline');
{
  const slug = await makeEvent('Changed My Mind Party', 48);
  created.push(slug);

  const g = await guest();
  const { error: firstErr } = await g.rpc('submit_rsvp', {
    p_slug: slug,
    p_guest_name: 'Committed Person',
    p_status: 'going'
  });
  if (firstErr) bad('first reply failed', firstErr.message);
  else ok('replied "going" while the window was open');

  // Now move the goalposts: the party is 30 minutes away and was planned long ago.
  const { error: shiftErr } = await host
    .from('events')
    .update({
      starts_at: new Date(Date.now() + 0.5 * HOUR).toISOString(),
      created_at: new Date(Date.now() - 10 * HOUR).toISOString()
    })
    .eq('slug', slug);
  if (shiftErr) bad('could not move the event closer', shiftErr.message);

  const { error } = await g.rpc('submit_rsvp', {
    p_slug: slug,
    p_guest_name: 'Committed Person',
    p_status: 'not_going'
  });
  if (error && /closed/i.test(error.message)) ok('change REJECTED after the deadline');
  else if (error) bad('rejected, but with an unexpected message', error.message);
  else bad('ANSWER WAS CHANGED after the deadline');

  const { data: after } = await g.rpc('get_invite', { p_slug: slug, p_token: null });
  if (after?.my_rsvp?.status === 'going') ok('original answer still stands', after.my_rsvp.status);
  else bad('stored answer is not the original', String(after?.my_rsvp?.status));

  head('CHECK 3b — a closed window does not revoke what was already disclosed');
  if (after?.is_unlocked === true) ok('is_unlocked still true');
  else bad('guest lost unlock when the window closed', String(after?.is_unlocked));
  if (after?.venue_address) ok('venue_address still disclosed', after.venue_address);
  else bad('venue_address withheld from a guest who had already replied');
  if (after?.door_code) ok('door_code still disclosed');
  else bad('door_code withheld from a guest who had already replied');
}

/* ────────────────────────────────────────────────────────────────────────── */
head('CHECK 4 — a last-minute gathering stays open until it starts');
{
  // Starts in 1 hour, published now. Without the exception its deadline would
  // already be an hour in the past and nobody could ever reply.
  const slug = await makeEvent('Aaj Raat Hi Party', 1);
  created.push(slug);

  const g = await guest();
  const { data } = await g.rpc('get_invite', { p_slug: slug, p_token: null });

  if (data?.replies_open === true) ok('replies_open is true for a same-evening party');
  else bad('a last-minute party was born closed', String(data?.replies_open));

  if (data?.replies_close_at && data?.starts_at) {
    const gap = Math.abs(new Date(data.replies_close_at) - new Date(data.starts_at));
    if (gap < 1500) ok('deadline equals the start time');
    else bad('deadline is not the start time', `${(gap / 60000).toFixed(1)} min apart`);
  }

  const { error } = await g.rpc('submit_rsvp', {
    p_slug: slug,
    p_guest_name: 'Spontaneous Friend',
    p_status: 'going'
  });
  if (error) bad('reply to a last-minute party was rejected', error.message);
  else ok('reply to a last-minute party accepted');
}

/* ────────────────────────────────────────────────────────────────────────── */
head('CHECK 5 — a past gathering is closed');
{
  const slug = await makeEvent('Party That Already Happened', -5);
  created.push(slug);

  const g = await guest();
  const { data } = await g.rpc('get_invite', { p_slug: slug, p_token: null });
  if (data?.replies_open === false) ok('replies_open is false');
  else bad('a finished party still accepts replies', String(data?.replies_open));

  const { error } = await g.rpc('submit_rsvp', {
    p_slug: slug,
    p_guest_name: 'Time Traveller',
    p_status: 'going'
  });
  if (error && /closed/i.test(error.message)) ok('reply to a past party REJECTED');
  else if (error) bad('rejected with an unexpected message', error.message);
  else bad('REPLY TO A PAST PARTY ACCEPTED');
}

/* ────────────────────────────────────────────────────────────────────────── */
head('CHECK 6 — a closed window does not burn a private invite token');
{
  const slug = await makeEvent('Private Late Party', 1, { is_private: true });
  created.push(slug);

  const { error: backdateErr } = await host
    .from('events')
    .update({ created_at: new Date(Date.now() - 10 * HOUR).toISOString() })
    .eq('slug', slug);
  if (backdateErr) bad('could not backdate created_at', backdateErr.message);

  const { data: invitee, error: addErr } = await host.rpc('add_event_invitee', {
    p_slug: slug,
    p_name: 'Named Guest',
    p_contact: null
  });
  if (addErr || !invitee?.token) {
    bad('could not create a private invitee', addErr?.message || 'no token');
  } else {
    ok('private invitee created');

    const g = await guest();
    const { error } = await g.rpc('submit_rsvp', {
      p_slug: slug,
      p_guest_name: 'Named Guest',
      p_status: 'going',
      p_token: invitee.token
    });
    if (error && /closed/i.test(error.message)) ok('private reply REJECTED after the deadline');
    else if (error) bad('rejected with an unexpected message', error.message);
    else bad('PRIVATE LATE REPLY ACCEPTED');

    const { data: list } = await host.rpc('list_event_invitees', { p_slug: slug });
    const row = (list || []).find((i) => i.token === invitee.token);
    if (row && row.claimed === false) ok('token NOT claimed — the invite survives');
    else if (row) bad('token was consumed by a rejected reply');
    else bad('invitee row vanished');
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
head('CHECK 7 — the host is still refused for their own event, whatever the window');
{
  const slug = await makeEvent('Host Reply Party', 48);
  created.push(slug);

  const { error } = await host.rpc('submit_rsvp', {
    p_slug: slug,
    p_guest_name: 'Deadline Host',
    p_status: 'going'
  });
  if (error && /hosting this one/i.test(error.message)) ok('host still rejected', error.message);
  else if (error) bad('host rejected with an unexpected message', error.message);
  else bad('HOST WAS ABLE TO REPLY');
}

head('CLEANUP');
{
  for (const slug of created.filter(Boolean)) {
    const { error } = await host.from('events').delete().eq('slug', slug);
    if (error) bad(`cleanup ${slug}`, error.message);
  }
  ok(`${created.filter(Boolean).length} events deleted`);
}

console.log(`\n${'='.repeat(58)}\nRESULT: ${pass} passed, ${fail} failed\n${'='.repeat(58)}`);
process.exit(fail === 0 ? 0 : 1);
