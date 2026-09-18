/**
 * Everything the host chooses about how the invitation *behaves*, as opposed to
 * what it says.
 *
 * Kept out of templates.js because that file is examples — nine parties somebody
 * could have thrown — whereas this is the system those examples are assembled
 * from. Mixing the two made it hard to add either.
 */

/* ══════════════════════════ type ══════════════════════════
 *
 * The brand has two faces and that is not up for negotiation on the product
 * chrome. The invitation card is the one place a host gets a choice, because an
 * invite is theirs and a qawwali baithak and a 2 AM warehouse thing should not
 * be set identically.
 *
 * Six, all already loaded by index.html, so choosing one costs no extra request.
 * Deliberately absent: the obvious deco faces — Poiret One, Limelight, Broadway.
 * The direction is explicit that deco lives in the shapes, not the lettering,
 * and those read as a costume.
 */
export const CARD_FONTS = [
  {
    id: 'clash',
    name: 'Clash Display',
    stack: "'Clash Display', Georgia, serif",
    note: 'The house face. Geometric, stepped, a little withholding.',
    weight: 600
  },
  {
    id: 'unbounded',
    name: 'Unbounded',
    stack: "'Unbounded', 'Clash Display', sans-serif",
    note: 'Wider, more Omni-magazine. Retro-future.',
    weight: 700
  },
  {
    id: 'mukta',
    name: 'Mukta',
    stack: "'Mukta', system-ui, sans-serif",
    note: 'Sets Devanagari and Latin as siblings. Use for a Hinglish title.',
    weight: 700
  },
  {
    id: 'syne',
    name: 'Syne',
    stack: "'Syne', 'Clash Display', sans-serif",
    note: 'Art-school poster. Odd widths, confident.',
    weight: 800
  },
  {
    id: 'space',
    name: 'Space Grotesk',
    stack: "'Space Grotesk', system-ui, sans-serif",
    note: 'Neutral and technical. Gets out of the way.',
    weight: 700
  },
  {
    id: 'mono',
    name: 'JetBrains Mono',
    stack: "'JetBrains Mono', ui-monospace, monospace",
    note: 'Fixed width. Reads like a pass, not a party.',
    weight: 600
  }
];

export const DEFAULT_FONT = 'clash';

export function fontById(id) {
  return CARD_FONTS.find((f) => f.id === id) || CARD_FONTS[0];
}

/* ══════════════════════════ reveals ══════════════════════════
 *
 * Twelve ways the card opens when the guest scrolls to it. The CSS lives in
 * styles/reveals.css; this is the list the studio shows and the id that gets
 * published.
 *
 * `moods` drives the "fits your vibe" ordering, the same way backgrounds work —
 * a mehfil should be offered the slow dissolve before the theatre curtain.
 */
export const REVEALS = [
  {
    id: 'gate',
    name: 'The gate',
    note: 'Opens from the centre, like a door being let open for you.',
    moods: ['mehfil', 'wedding', 'happyhours', 'birthday']
  },
  {
    id: 'book',
    name: 'Book',
    note: 'Turns flat from the spine, like a page.',
    moods: ['mehfil', 'wedding']
  },
  {
    id: 'envelope',
    name: 'Envelope',
    note: 'The flap falls forward and the card lifts out.',
    moods: ['wedding', 'mehfil']
  },
  {
    id: 'stepwell',
    name: 'Stepwell',
    note: 'Descends in stepped bands, top to bottom.',
    moods: ['mehfil', 'wedding']
  },
  {
    id: 'facet',
    name: 'Facet',
    note: 'Cubist planes resolving into one image.',
    moods: ['happyhours', 'birthday']
  },
  {
    id: 'curtain',
    name: 'Curtain',
    note: 'Drops from the top with the weight of fabric.',
    moods: ['happyhours', 'wedding']
  },
  {
    id: 'wedge',
    name: 'Wedge',
    note: 'Up along the diagonal. A car door, not a drawer.',
    moods: ['birthday', 'happyhours']
  },
  {
    id: 'blinds',
    name: 'Blinds',
    note: 'Deco grille. Slats opening together.',
    moods: ['happyhours', 'birthday']
  },
  {
    id: 'iris',
    name: 'Iris',
    note: 'Circular, from the centre. A lens opening.',
    moods: ['birthday', 'happyhours']
  },
  {
    id: 'unfold',
    name: 'Unfold',
    note: 'Opens out along a horizontal crease.',
    moods: ['wedding', 'mehfil']
  },
  {
    id: 'marquee',
    name: 'Marquee',
    note: 'A thin band across the middle, then the hoarding lights up.',
    moods: ['birthday', 'happyhours']
  },
  {
    id: 'dissolve',
    name: 'Dissolve',
    note: 'A slow diagonal wipe. For when a door slamming open is the wrong register.',
    moods: ['mehfil', 'wedding']
  }
];

export const DEFAULT_REVEAL = 'gate';

export function revealById(id) {
  return REVEALS.find((r) => r.id === id) || REVEALS[0];
}

export function recommendReveals(categoryId, limit = 4) {
  const scored = REVEALS.map((r, i) => ({
    r,
    score: r.moods[0] === categoryId ? 0 : r.moods.includes(categoryId) ? 1 : 2,
    i
  }));
  scored.sort((a, b) => a.score - b.score || a.i - b.i);
  return scored.slice(0, limit).map((s) => s.r);
}

/* ══════════════════════════ sound ══════════════════════════
 *
 * There was one drone, and it played on every invitation regardless of what the
 * invitation was for, which made it feel like a system sound rather than part of
 * the card. Twelve now, and they differ in more than pitch — the oscillator
 * shape, the filter cutoff, the vibrato and whether there is a pulse at all are
 * what actually separate a tanpura from a warehouse room tone. Transposing one
 * chord twelve times would have produced twelve versions of the same sound.
 *
 *   freqs    the chord, in Hz
 *   wave     oscillator shape — sine is glassy, sawtooth is reedy, square is hard
 *   cutoff   lowpass corner; low is muffled and distant, high is present
 *   lfoRate  vibrato speed in Hz
 *   lfoDepth vibrato depth in Hz of pitch deviation
 *   pulse    amplitude throb in Hz — 0 for a continuous drone
 *   detune   cents of spread between voices; widens the chord
 */
export const SOUNDSCAPES = [
  {
    id: 'tanpura-d',
    name: 'Tanpura, D',
    note: 'What a mehfil opens with.',
    moods: ['mehfil'],
    freqs: [146.83, 220.0, 293.66],
    wave: 'sawtooth', cutoff: 430, lfoRate: 0.2, lfoDepth: 0.8, pulse: 0, detune: 4
  },
  {
    id: 'tanpura-cs',
    name: 'Tanpura, C♯',
    note: 'Lower, heavier. Qawwali register.',
    moods: ['mehfil', 'wedding'],
    freqs: [138.59, 207.65, 277.18],
    wave: 'sawtooth', cutoff: 380, lfoRate: 0.16, lfoDepth: 1.1, pulse: 0, detune: 6
  },
  {
    id: 'harmonium',
    name: 'Harmonium drone',
    note: 'Reedy and close, like the box is in the room.',
    moods: ['mehfil'],
    freqs: [174.61, 261.63, 349.23],
    wave: 'square', cutoff: 620, lfoRate: 0.5, lfoDepth: 1.6, pulse: 0, detune: 9
  },
  {
    id: 'shehnai',
    name: 'Shehnai, distant',
    note: 'For a wedding. Bright, but heard from another courtyard.',
    moods: ['wedding'],
    freqs: [233.08, 349.23, 466.16],
    wave: 'sawtooth', cutoff: 900, lfoRate: 0.7, lfoDepth: 2.4, pulse: 0, detune: 7
  },
  {
    id: 'sarangi',
    name: 'Sarangi haze',
    note: 'Strings bowed slow. Melancholy on purpose.',
    moods: ['mehfil', 'wedding'],
    freqs: [155.56, 233.08, 311.13],
    wave: 'sawtooth', cutoff: 520, lfoRate: 0.34, lfoDepth: 2.8, pulse: 0, detune: 12
  },
  {
    id: 'house-c',
    name: 'House chord, C',
    note: 'The one the old app always played.',
    moods: ['happyhours'],
    freqs: [130.81, 164.81, 196.0],
    wave: 'sawtooth', cutoff: 700, lfoRate: 0.22, lfoDepth: 0.7, pulse: 0, detune: 5
  },
  {
    id: 'basement',
    name: 'Basement throb',
    note: 'Four to the floor, heard through a door.',
    moods: ['happyhours', 'birthday'],
    freqs: [65.41, 98.0, 130.81],
    wave: 'sine', cutoff: 240, lfoRate: 0.1, lfoDepth: 0.4, pulse: 2.0, detune: 0
  },
  {
    id: 'rooftop',
    name: 'Rooftop, 8pm',
    note: 'Open air. Nothing pressing.',
    moods: ['happyhours', 'wedding'],
    freqs: [174.61, 220.0, 261.63],
    wave: 'sine', cutoff: 1100, lfoRate: 0.14, lfoDepth: 1.2, pulse: 0, detune: 8
  },
  {
    id: 'disco',
    name: 'Disco strings',
    note: 'Wide and slightly out of tune with itself. Deliberately.',
    moods: ['happyhours', 'birthday'],
    freqs: [146.83, 185.0, 220.0, 293.66],
    wave: 'sawtooth', cutoff: 1400, lfoRate: 0.9, lfoDepth: 3.2, pulse: 0, detune: 16
  },
  {
    id: 'neon',
    name: 'Neon minor',
    note: 'E minor 7. Colder, synthetic.',
    moods: ['birthday'],
    freqs: [164.81, 207.65, 246.94],
    wave: 'square', cutoff: 820, lfoRate: 0.3, lfoDepth: 1.0, pulse: 0, detune: 3
  },
  {
    id: 'afterparty',
    name: 'Afterparty, 4am',
    note: 'Slow pulse, filter almost shut. Everybody has gone quiet.',
    moods: ['birthday', 'happyhours'],
    freqs: [82.41, 123.47, 164.81],
    wave: 'sine', cutoff: 200, lfoRate: 0.08, lfoDepth: 0.5, pulse: 0.55, detune: 4
  },
  {
    id: 'silence',
    name: 'No sound',
    note: 'Some invitations should not make a noise.',
    moods: [],
    freqs: [],
    wave: 'sine', cutoff: 400, lfoRate: 0, lfoDepth: 0, pulse: 0, detune: 0
  }
];

export const DEFAULT_SOUND = 'house-c';

export function soundById(id) {
  return SOUNDSCAPES.find((s) => s.id === id) || SOUNDSCAPES.find((s) => s.id === DEFAULT_SOUND);
}

export function recommendSounds(categoryId, limit = 5) {
  const scored = SOUNDSCAPES.filter((s) => s.id !== 'silence').map((s, i) => ({
    s,
    score: s.moods[0] === categoryId ? 0 : s.moods.includes(categoryId) ? 1 : 2,
    i
  }));
  scored.sort((a, b) => a.score - b.score || a.i - b.i);
  return scored.slice(0, limit).map((x) => x.s);
}

/* ══════════════════════════ house rules ══════════════════════════
 *
 * Was "Food and drink note", then "Logistics" — both of which sound like a
 * shipping form. These are the things a host would say out loud at the door, so
 * they are called house rules.
 *
 * Multi-select, which is the actual fix: BYOB *and* no plus-ones *and* leave by
 * two is one normal party, and a single-choice field forced a host to pick which
 * of those mattered most and drop the rest. Selected rules publish as a list and
 * render as separate lines on the invite.
 */
export const HOUSE_RULES = [
  { id: 'byob', title: 'BYOB', detail: 'Bring your own bottle' },
  { id: 'potluck', title: 'Potluck', detail: 'Bring one thing to share' },
  { id: 'split', title: 'Splitting costs', detail: 'Roughly ₹500 each' },
  { id: 'covered', title: 'Food and drinks sorted', detail: "You don't need to bring anything" },
  { id: 'ice', title: 'Someone bring ice', detail: 'It is always the thing nobody brings' },
  { id: 'plus-one', title: 'Plus-ones fine', detail: 'Just tell me who' },
  { id: 'no-plus-one', title: 'No plus-ones', detail: 'Tight space, sorry' },
  { id: 'no-shoes', title: 'Shoes off', detail: 'At the door' },
  { id: 'quiet-after', title: 'Quiet after midnight', detail: 'Neighbours, not choice' },
  { id: 'leave-by', title: 'Out by two', detail: 'Building rule' },
  { id: 'cab', title: 'Come by cab', detail: 'Parking is a nightmare' },
  { id: 'cat', title: 'There is a cat', detail: 'Plan accordingly' },
  { id: 'no-story', title: 'No stories', detail: 'Photos are fine, posting is not' },
  { id: 'aux', title: 'Aux is open', detail: 'Within reason' }
];

export function houseRuleById(id) {
  return HOUSE_RULES.find((r) => r.id === id) || null;
}

/** The invite shows rules as short lines; this is the one-line form. */
export function houseRuleLine(id) {
  const r = houseRuleById(id);
  if (!r) return '';
  return r.detail ? `${r.title} — ${r.detail.toLowerCase()}` : r.title;
}
