/**
 * Verifies that Realtime actually delivers to the host.
 *
 * This is the load-bearing unknown behind the live-update fix: the rsvps and
 * comments SELECT policies call SECURITY DEFINER helpers (is_event_host,
 * has_rsvp_for_event), and Realtime evaluates RLS per subscriber. If those
 * policies do not evaluate in the Realtime context, the host is never notified
 * and the feature silently does nothing — which is exactly the bug being fixed,
 * so it needs proving rather than assuming.
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

/** Resolves with the first matching event, or null after `ms`. */
function waitFor(ms) {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  const timer = setTimeout(() => resolve(null), ms);
  return { promise, hit: (v) => { clearTimeout(timer); resolve(v); } };
}

const stamp = Date.now();
const PASSWORD = 'HavanTest123';

head('SETUP');
const host = mk();
{
  const { error } = await host.auth.signUp({
    email: `rt-${stamp}@havan-test.dev`,
    password: PASSWORD,
    options: { data: { display_name: 'RT Host' } }
  });
  if (error) { bad('signUp', error.message); process.exit(1); }
  ok('host registered');
}

let slug, eventId;
{
  const { data, error } = await host
    .from('events')
    .insert({
      title: 'Realtime Test Party',
      host_name: 'RT Host',
      starts_at: new Date(Date.now() + 2 * 86400000).toISOString(),
      venue_name: 'The Terrace',
      venue_address: 'Somewhere real',
      door_code: 'CODE: #0001'
    })
    .select()
    .single();
  if (error) { bad('create event', error.message); process.exit(1); }
  slug = data.slug;
  eventId = data.id;
  ok('event created', slug);
}

head('CHECK 1 — host is notified when a guest replies (rsvps INSERT)');
{
  const waiter = waitFor(12000);

  const channel = host
    .channel(`test-rsvps-${eventId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rsvps', filter: `event_id=eq.${eventId}` },
      (payload) => waiter.hit(payload)
    );

  const subscribed = await new Promise((resolve) => {
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') resolve(true);
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') resolve(false);
    });
  });

  if (!subscribed) {
    bad('host could not subscribe to rsvps');
  } else {
    ok('host subscribed to rsvps');

    // Give the server a moment to register the subscription before writing.
    await new Promise((r) => setTimeout(r, 900));

    const guest = mk();
    await guest.auth.signInAnonymously();
    const { error } = await guest.rpc('submit_rsvp', {
      p_slug: slug,
      p_guest_name: 'Aarav',
      p_contact: 'aarav@music.in',
      p_status: 'going'
    });
    if (error) bad('guest reply failed', error.message);

    const evt = await waiter.promise;
    if (evt) {
      ok('host received the rsvps event', `${evt.eventType} on ${evt.table}`);
      if (evt.new?.guest_name === 'Aarav') ok('payload carries the reply', evt.new.guest_name);
    } else {
      bad('host was NOT notified within 12s — Realtime not delivering under RLS');
    }
  }

  await host.removeChannel(channel);
}

head('CHECK 2 — host is notified of a new note (comments INSERT)');
{
  const waiter = waitFor(12000);

  const channel = host
    .channel(`test-comments-${eventId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'comments', filter: `event_id=eq.${eventId}` },
      (payload) => waiter.hit(payload)
    );

  const subscribed = await new Promise((resolve) => {
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') resolve(true);
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') resolve(false);
    });
  });

  if (!subscribed) {
    bad('host could not subscribe to comments');
  } else {
    ok('host subscribed to comments');
    await new Promise((r) => setTimeout(r, 900));

    // A guest who already replied posts a note.
    const guest2 = mk();
    await guest2.auth.signInAnonymously();
    await guest2.rpc('submit_rsvp', {
      p_slug: slug,
      p_guest_name: 'Meera',
      p_status: 'going'
    });
    const { error } = await guest2.rpc('post_comment', {
      p_slug: slug,
      p_message: 'Bringing dessert!'
    });
    if (error) bad('note post failed', error.message);

    const evt = await waiter.promise;
    if (evt) ok('host received the comments event', `${evt.eventType}`);
    else bad('host was NOT notified of the note within 12s');
  }

  await host.removeChannel(channel);
}

head('CHECK 3 — a guest is notified too (so the wall updates for them)');
{
  const guest = mk();
  await guest.auth.signInAnonymously();
  // Must have replied to be allowed to read the wall at all.
  await guest.rpc('submit_rsvp', { p_slug: slug, p_guest_name: 'Watcher', p_status: 'going' });

  const waiter = waitFor(12000);
  const channel = guest
    .channel(`test-guest-comments-${eventId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'comments', filter: `event_id=eq.${eventId}` },
      (payload) => waiter.hit(payload)
    );

  const subscribed = await new Promise((resolve) => {
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') resolve(true);
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') resolve(false);
    });
  });

  if (!subscribed) {
    bad('guest could not subscribe');
  } else {
    ok('guest subscribed to comments');
    await new Promise((r) => setTimeout(r, 900));

    await host.rpc('post_comment', { p_slug: slug, p_message: 'See you all there' });

    const evt = await waiter.promise;
    if (evt) ok('guest received the host note event');
    else bad('guest was NOT notified within 12s');
  }

  await guest.removeChannel(channel);
}

head('CHECK 4 — an UNRELATED user is NOT notified (RLS holds on the socket)');
{
  const outsider = mk();
  await outsider.auth.signUp({ email: `out-${stamp}@havan-test.dev`, password: PASSWORD });

  const waiter = waitFor(7000);
  const channel = outsider
    .channel(`test-outsider-${eventId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rsvps', filter: `event_id=eq.${eventId}` },
      (payload) => waiter.hit(payload)
    );

  await new Promise((resolve) => {
    channel.subscribe((status) => {
      if (['SUBSCRIBED', 'CHANNEL_ERROR', 'TIMED_OUT'].includes(status)) resolve(status);
    });
  });
  await new Promise((r) => setTimeout(r, 900));

  const g = mk();
  await g.auth.signInAnonymously();
  await g.rpc('submit_rsvp', { p_slug: slug, p_guest_name: 'Private Person', p_status: 'going' });

  const evt = await waiter.promise;
  if (evt === null) ok('outsider received nothing — RLS enforced on Realtime');
  else bad('OUTSIDER RECEIVED ROW DATA', JSON.stringify(evt.new)?.slice(0, 110));

  await outsider.removeChannel(channel);
}

head('CLEANUP');
{
  const { error } = await host.from('events').delete().eq('slug', slug);
  if (error) bad('cleanup', error.message);
  else ok('event deleted');
}

console.log(`\n${'='.repeat(58)}\nRESULT: ${pass} passed, ${fail} failed\n${'='.repeat(58)}`);
process.exit(fail === 0 ? 0 : 1);
