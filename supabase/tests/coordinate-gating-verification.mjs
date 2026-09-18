/**
 * Verifies that venue coordinates are gated exactly like the street address.
 *
 * This is the check that matters most for the OpenStreetMap feature: a lat/lng is
 * an exact pin, so leaking it while withholding the address would defeat the lock
 * completely — anyone could paste the numbers into a map.
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
const LAT = 28.6562;
const LNG = 77.2410;

head('SETUP — event with coordinates');
const host = mk();
{
  const { error } = await host.auth.signUp({
    email: `geo-${stamp}@havan-test.dev`,
    password: 'HavanTest123',
    options: { data: { display_name: 'Geo Host' } }
  });
  if (error) { bad('signUp', error.message); process.exit(1); }
  ok('host registered');
}

let slug;
{
  const { data, error } = await host
    .from('events')
    .insert({
      title: 'Red Fort Courtyard Mehfil',
      host_name: 'Geo Host',
      starts_at: new Date(Date.now() + 3 * 86400000).toISOString(),
      venue_name: 'The Courtyard',
      venue_address: 'Netaji Subhash Marg, Chandni Chowk, Delhi',
      venue_lat: LAT,
      venue_lng: LNG,
      venue_osm_label: 'Red Fort, Delhi, India',
      door_code: 'CODE: #4410',
      hide_until_rsvp: true
    })
    .select()
    .single();
  if (error) { bad('create event', error.message); process.exit(1); }
  slug = data.slug;
  ok('event created with coordinates', slug);
  if (Number(data.venue_lat) === LAT && Number(data.venue_lng) === LNG) {
    ok('coordinates stored at full precision', `${data.venue_lat}, ${data.venue_lng}`);
  } else {
    bad('coordinates mangled', `${data.venue_lat}, ${data.venue_lng}`);
  }
}

head('CHECK 1 — an anonymous viewer gets NO coordinates');
{
  const anon = mk();
  const { data } = await anon.rpc('get_invite', { p_slug: slug });
  if (!data) { bad('invite did not load'); }
  else {
    if (data.venue_lat === null && data.venue_lng === null) ok('venue_lat and venue_lng are null');
    else bad('COORDINATES LEAKED to an anonymous viewer', `${data.venue_lat}, ${data.venue_lng}`);
    if (data.venue_address === null) ok('address also withheld (control)');
    if (data.venue_name) ok('public venue name still shown', data.venue_name);
  }
}

head('CHECK 2 — a guest who declined gets NO coordinates');
{
  const decliner = mk();
  await decliner.auth.signInAnonymously();
  const { data } = await decliner.rpc('submit_rsvp', {
    p_slug: slug,
    p_guest_name: 'Not Coming',
    p_status: 'not_going'
  });
  if (data?.venue_lat === null && data?.venue_lng === null) ok('coordinates withheld after a decline');
  else bad('coordinates leaked to a decliner', `${data?.venue_lat}, ${data?.venue_lng}`);
}

head('CHECK 3 — a guest who is coming DOES get coordinates');
{
  const goer = mk();
  await goer.auth.signInAnonymously();
  const { data } = await goer.rpc('submit_rsvp', {
    p_slug: slug,
    p_guest_name: 'Aarav',
    p_status: 'going'
  });
  if (Number(data?.venue_lat) === LAT && Number(data?.venue_lng) === LNG) {
    ok('coordinates released to a going guest', `${data.venue_lat}, ${data.venue_lng}`);
  } else {
    bad('coordinates not released', `${data?.venue_lat}, ${data?.venue_lng}`);
  }
  if (data?.venue_address) ok('address released alongside them');
}

head('CHECK 4 — a maybe also gets them (same rule as the address)');
{
  const maybe = mk();
  await maybe.auth.signInAnonymously();
  const { data } = await maybe.rpc('submit_rsvp', {
    p_slug: slug,
    p_guest_name: 'Meera',
    p_status: 'maybe'
  });
  const hasCoords = data?.venue_lat != null && data?.venue_lng != null;
  const hasAddr = Boolean(data?.venue_address);
  if (hasCoords === hasAddr) ok('coordinates and address travel together', `both ${hasCoords ? 'shown' : 'hidden'}`);
  else bad('coordinates and address disagree', `coords=${hasCoords} addr=${hasAddr}`);
}

head('CHECK 5 — the host always sees them');
{
  const { data } = await host.rpc('get_invite', { p_slug: slug });
  if (data?.venue_lat != null) ok('host sees coordinates');
  else bad('host cannot see their own coordinates');
}

head('CHECK 6 — out-of-range coordinates are rejected');
{
  const { error } = await host
    .from('events')
    .insert({
      title: 'Bad Geo',
      starts_at: new Date(Date.now() + 86400000).toISOString(),
      venue_lat: 999,
      venue_lng: 0
    })
    .select();
  if (error) ok('latitude 999 rejected by constraint', error.message.slice(0, 55));
  else bad('invalid latitude accepted');
}

head('CLEANUP');
{
  const { error } = await host.from('events').delete().eq('slug', slug);
  if (error) bad('cleanup', error.message);
  else ok('event deleted');
}

console.log(`\n${'='.repeat(56)}\nRESULT: ${pass} passed, ${fail} failed\n${'='.repeat(56)}`);
process.exit(fail === 0 ? 0 : 1);
