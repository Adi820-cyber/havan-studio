/**
 * Verifies the host guest list and threaded note replies.
 *
 * The point of interest is negative: a guest must be refused the guest list
 * outright, not handed a filtered version of it.
 *
 *   $env:SB_URL = 'https://<ref>.supabase.co'
 *   $env:SB_PUB = '<sb_publishable_... key>'
 *   node supabase/tests/host-view-verification.mjs
 */
import { createClient } from '@supabase/supabase-js';

const mk = () =>
  createClient(process.env.SB_URL, process.env.SB_PUB, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

let pass = 0,
  fail = 0;
const ok = (m, x = '') => { pass++; console.log(`  PASS  ${m}${x ? ' — ' + x : ''}`); };
const bad = (m, x = '') => { fail++; console.log(`  FAIL  ${m}${x ? ' — ' + x : ''}`); };
const head = (m) => console.log(`\n${m}`);

const stamp = Date.now();
const PASSWORD = 'HavanTest123';

head('SETUP');
const host = mk();
{
  const { error } = await host.auth.signUp({
    email: `host-${stamp}@havan-test.dev`,
    password: PASSWORD,
    options: { data: { display_name: 'Test Host' } }
  });
  if (error) { bad('host signUp', error.message); process.exit(1); }
  ok('host registered');
}

let slug;
{
  const { data, error } = await host
    .from('events')
    .insert({
      title: 'Guest List Test Mehfil',
      host_name: 'Test Host',
      starts_at: new Date(Date.now() + 4 * 86400000).toISOString(),
      venue_name: 'The Courtyard',
      venue_address: 'Brass Gate #1',
      door_code: 'CODE: #7721',
      hide_until_rsvp: true
    })
    .select()
    .single();
  if (error) { bad('create event', error.message); process.exit(1); }
  slug = data.slug;
  ok('event created', slug);
}

// Two guests reply with notes
const guestA = mk();
const guestB = mk();
{
  await guestA.auth.signInAnonymously();
  const { error: e1 } = await guestA.rpc('submit_rsvp', {
    p_slug: slug,
    p_guest_name: 'Aarav',
    p_contact: 'aarav@music.in',
    p_status: 'going',
    p_plus_ones: 2,
    p_dietary_notes: 'No onion no garlic',
    p_note: 'Bringing saffron sweets!'
  });
  if (e1) bad('guest A reply', e1.message); else ok('guest A replied going +2 with a note');

  await guestB.auth.signInAnonymously();
  const { error: e2 } = await guestB.rpc('submit_rsvp', {
    p_slug: slug,
    p_guest_name: 'Meera',
    p_contact: 'meera@x.in',
    p_status: 'maybe',
    p_note: 'Dekhte hain, might be late'
  });
  if (e2) bad('guest B reply', e2.message); else ok('guest B replied maybe with a note');
}

head('CHECK 1 — host sees the full guest list');
{
  const { data, error } = await host.rpc('get_event_guests', { p_slug: slug });
  if (error) { bad('host get_event_guests', error.message); }
  else {
    const g = data.guests || [];
    if (g.length === 2) ok('two guests returned');
    else bad('wrong guest count', String(g.length));

    const aarav = g.find((x) => x.guest_name === 'Aarav');
    if (aarav?.contact === 'aarav@music.in') ok('contact visible to host', aarav.contact);
    if (aarav?.plus_ones === 2) ok('plus_ones recorded', '2');
    if (aarav?.dietary_notes === 'No onion no garlic') ok('dietary notes visible');

    const c = data.counts || {};
    if (c.going === 1 && c.maybe === 1 && c.not_going === 0) ok('counts correct', `going=${c.going} maybe=${c.maybe}`);
    else bad('counts wrong', JSON.stringify(c));
    if (c.head_count === 3) ok('head_count includes plus ones', '1 going + 2 = 3');
    else bad('head_count wrong', String(c.head_count));
  }
}

head('CHECK 2 — a guest must be REFUSED the guest list, not given a filtered one');
{
  const { data, error } = await guestA.rpc('get_event_guests', { p_slug: slug });
  if (error) ok('guest refused', error.message.slice(0, 60));
  else bad('guest received the guest list', JSON.stringify(data).slice(0, 120));
}

head('CHECK 3 — an unrelated logged-in user is also refused');
{
  const outsider = mk();
  await outsider.auth.signUp({ email: `out-${stamp}@havan-test.dev`, password: PASSWORD });
  const { error } = await outsider.rpc('get_event_guests', { p_slug: slug });
  if (error) ok('outsider refused', error.message.slice(0, 60));
  else bad('outsider read the guest list');
}

head('CHECK 4 — host replies to a guest note, guest can see it');
{
  const { data: wall } = await host.rpc('get_event_comments', { p_slug: slug });
  const aaravNote = (wall || []).find((c) => c.message.includes('saffron'));
  if (!aaravNote) { bad('host cannot see guest notes'); }
  else {
    ok('host sees guest notes', `${wall.length} on the wall`);

    const { data: reply, error } = await host.rpc('post_comment', {
      p_slug: slug,
      p_message: 'Shukriya Aarav! Bring them, plenty of room.',
      p_parent_id: aaravNote.id
    });
    if (error) { bad('host reply', error.message); }
    else {
      if (reply.parent_id === aaravNote.id) ok('reply is threaded to the note');
      if (reply.from_host === true) ok('reply flagged from_host');

      const { data: guestWall } = await guestA.rpc('get_event_comments', { p_slug: slug });
      const seen = (guestWall || []).find((c) => c.id === reply.id);
      if (seen) ok('guest can see the host reply', `from_host=${seen.from_host}`);
      else bad('guest cannot see the host reply');
    }
  }
}

head('CHECK 5 — replies cannot be nested past one level');
{
  const { data: wall } = await host.rpc('get_event_comments', { p_slug: slug });
  const reply = (wall || []).find((c) => c.parent_id);
  if (!reply) { bad('no reply found to test nesting'); }
  else {
    const { error } = await host.rpc('post_comment', {
      p_slug: slug,
      p_message: 'nested attempt',
      p_parent_id: reply.id
    });
    if (error) ok('nested reply rejected', error.message.slice(0, 55));
    else bad('nested reply was accepted');
  }
}

head('CHECK 6 — note bodies are never empty (the old blank-note bug)');
{
  const { data: wall } = await host.rpc('get_event_comments', { p_slug: slug });
  const empties = (wall || []).filter((c) => !c.message || !c.message.trim()).length;
  if (empties === 0) ok('no empty note bodies', `${wall.length} checked`);
  else bad('empty notes present', String(empties));
}

head('CHECK 7 — the host cannot reply to their own gathering');
{
  const before = await host.rpc('get_event_guests', { p_slug: slug });
  const countBefore = before.data?.guests?.length ?? 0;

  const { error } = await host.rpc('submit_rsvp', {
    p_slug: slug,
    p_guest_name: 'The Host',
    p_status: 'going'
  });

  if (error) {
    ok('host reply rejected by the database', error.message.slice(0, 60));
  } else {
    bad('host was allowed to reply to their own event');
  }

  const after = await host.rpc('get_event_guests', { p_slug: slug });
  const countAfter = after.data?.guests?.length ?? 0;
  if (countAfter === countBefore) {
    ok('host is not counted among their own guests', `${countAfter} guests`);
  } else {
    bad('guest count changed after the host tried to reply', `${countBefore} -> ${countAfter}`);
  }
}

head('CLEANUP');
{
  const { error } = await host.from('events').delete().eq('slug', slug);
  if (error) bad('cleanup', error.message);
  else ok('event deleted, rsvps + notes cascaded');
}

console.log(`\n${'='.repeat(56)}\nRESULT: ${pass} passed, ${fail} failed\n${'='.repeat(56)}`);
process.exit(fail === 0 ? 0 : 1);
