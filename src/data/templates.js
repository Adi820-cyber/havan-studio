export const CATEGORIES = [
  { id: 'all', label: 'All Experiences', emoji: '✨' },
  { id: 'mehfil', label: 'Sufi Night', altLabel: 'Mehfil', emoji: '🪔', desc: 'Sufi, Qawwali, Ghazal & Candlelit Poetry Baithak' },
  { id: 'happyhours', label: 'Happy Hours', emoji: '🍹', desc: 'Retro Disco, House Jam, Rooftop Lounge & Craft Cocktails' },
  { id: 'wedding', label: 'Wedding', emoji: '💍', desc: 'Shaadi, Sangeet Night, Mehendi & Haldi Gala' },
  { id: 'birthday', label: 'Birthday', emoji: '🎂', desc: 'Neon Midnight Bash, Milestone Soirée & Club Night' }
];

/**
 * Suggestions for the dress-code field, not a fixed list.
 *
 * The studio shows these as one-tap chips that write into a plain text box, so a
 * host who wants "pyjamas, no arguments" can just type it.
 */
export const DRESS_CODES = [
  { id: 'raw-silk', title: 'Raw Silk, Kurta & Bohemia', category: 'mehfil' },
  { id: 'retro-flare', title: 'Retro 70s Flare & Glitter', category: 'happyhours' },
  { id: 'cocktail-chic', title: 'Chic Cocktail & Editorial', category: 'happyhours' },
  { id: 'royal-shaadi', title: 'Regal Velvet & Zari Sherwani', category: 'wedding' },
  { id: 'pastel-ethnic', title: 'Pastel Chiffon & Linen', category: 'wedding' },
  { id: 'neon-casual', title: 'Cyber Chic & Sneakers', category: 'birthday' },
  { id: 'black-tie', title: 'Black Tie & Golden Hour', category: 'birthday' },
  { id: 'come-as-you-are', title: 'Come as you are', category: 'all' }
];

/**
 * Logistics chips.
 *
 * Replaces the old "Food and drink note", which only ever asked about drinks and
 * so left the two things people actually argue about in the group chat — who is
 * bringing what, and whether money is involved — with nowhere to live. Same
 * chips-into-a-textbox model as the dress code: tap one, then edit it.
 */
export const LOGISTICS_SUGGESTIONS = [
  { id: 'byob', title: 'BYOB — bring your own bottle' },
  { id: 'potluck', title: 'Potluck — bring one dish to share' },
  { id: 'split', title: 'Splitting costs, ~₹500 each' },
  { id: 'covered', title: 'Food and drinks are on me' },
  { id: 'bring-ice', title: 'Someone please bring ice' },
  { id: 'plus-one', title: 'Plus-ones welcome, just tell me' },
  { id: 'no-plus-one', title: 'No plus-ones, tight space' },
  { id: 'parking', title: 'Street parking, come by cab if you can' },
  { id: 'pets', title: 'There is a cat. Plan accordingly.' }
];

/**
 * The artwork library.
 *
 * Every entry is hand-illustrated or folk art. The generative pieces that used to
 * sit in here — the "Bday" poster set and the neon-skyline render — were removed:
 * they had garbled lettering, they all looked like the same prompt, and an invite
 * that opens with an obviously machine-made image tells the guest exactly how much
 * thought went into the evening.
 *
 * `moods` drive the recommendations in the studio. A background is suggested when
 * its mood overlaps the vibe the host picked; `palette` is the colour set that was
 * chosen against that artwork, so accepting a suggestion sets both at once.
 */
export const BACKGROUNDS = [
  {
    id: 'bg-record-room',
    src: '/media/img7.jpeg',
    name: 'Record Room',
    credit: 'Illustration',
    moods: ['happyhours', 'birthday'],
    palette: 'theme-retro-disco'
  },
  {
    id: 'bg-poolside',
    src: '/media/img2.jpeg',
    name: 'Poolside Midcentury',
    credit: 'Illustration',
    moods: ['happyhours', 'birthday'],
    palette: 'theme-electric-cyan'
  },
  {
    id: 'bg-lounge',
    src: '/media/img3.jpeg',
    name: 'Atrium Lounge',
    credit: 'Illustration',
    moods: ['happyhours'],
    palette: 'theme-cubist-blush'
  },
  {
    id: 'bg-cubist-crowd',
    src: '/media/img1.jpeg',
    name: 'Cubist Crowd',
    credit: 'Painting',
    moods: ['happyhours', 'birthday'],
    palette: 'theme-cubist-blush'
  },
  {
    id: 'bg-cubist-dance',
    src: '/media/img4.jpeg',
    name: 'Cubist Dancefloor',
    credit: 'Painting',
    moods: ['happyhours', 'birthday', 'mehfil'],
    palette: 'theme-electric-cyan'
  },
  {
    id: 'bg-warli-blue',
    src: '/media/img5.jpeg',
    name: 'Warli Dancers, Indigo',
    credit: 'Warli folk painting',
    moods: ['mehfil', 'wedding'],
    palette: 'theme-mystic-sufi'
  },
  {
    id: 'bg-warli-red',
    src: '/media/img6.jpeg',
    name: 'Warli Tree of Life',
    credit: 'Warli folk painting',
    moods: ['mehfil', 'wedding'],
    palette: 'theme-royal-marigold'
  },
  {
    id: 'bg-courtyard-fire',
    src: '/media/img13.jpeg',
    name: 'Courtyard Bonfire',
    credit: 'Folk painting',
    moods: ['mehfil', 'happyhours'],
    palette: 'theme-royal-marigold'
  },
  {
    id: 'bg-rooftop-drinks',
    src: '/media/img9.jpeg',
    name: 'Rooftop Drinks',
    credit: 'Illustration',
    moods: ['happyhours', 'birthday'],
    palette: 'theme-electric-cyan'
  },
  {
    id: 'bg-balcony-night',
    src: '/media/img10.jpeg',
    name: 'Balcony, 2 AM',
    credit: 'Illustration',
    moods: ['birthday', 'happyhours'],
    palette: 'theme-cubist-blush'
  },
  {
    id: 'bg-mandap',
    src: '/media/img14.jpeg',
    name: 'Mandap in Watercolour',
    credit: 'Watercolour',
    moods: ['wedding'],
    palette: 'theme-royal-marigold'
  },
  {
    id: 'bg-garden-couple',
    src: '/media/img15.jpeg',
    name: 'Garden Ceremony',
    credit: 'Watercolour',
    moods: ['wedding'],
    palette: 'theme-mystic-sufi'
  }
];

export const TEMPLATES = [
  // MEHFIL
  {
    id: 'simla-beat-mehfil',
    category: 'mehfil',
    title: 'Simla Beat Psychedelic Baithak',
    subtitle: 'Vintage rock, poetry & midnight chai vibrations',
    host: 'Kabir & The Collective',
    date: 'Friday, Oct 24',
    time: '9:00 PM — 3:00 AM',
    venue: 'Terrace Garden Baithak, Sector 7',
    doorCode: 'Follow the fairy lights to the roof',
    vibeTag: 'Cultural Mehfil',
    image: '/media/img13.jpeg',
    theme: 'theme-royal-marigold',
    dressCode: 'Raw Silk, Kurta & Bohemia',
    logistics: 'Chai and kahwa on the house · bring a poem',
    rsvpPreset: {
      yes: { emoji: '✨', title: 'Aana hi hai', sub: 'Soul is there' },
      maybe: { emoji: '🫖', title: 'Dil toh chahta hai', sub: 'Trying hard' },
      no: { emoji: '🕊️', title: 'Duaon mein', sub: 'In spirit only' }
    },
    guestCount: 29,
    soundFreqs: [138.59, 207.65, 277.18], // C# Tanpura drone
    description: 'An acoustic and psychedelic fusion gathering. Live sitar, poetry recitations under the open stars, Kashmiri kahwa, and Simla 71 vintage record spins.'
  },
  {
    id: 'sufi-qawwali-night',
    category: 'mehfil',
    title: 'Chishtia Sufi & Qawwali Night',
    subtitle: 'Candlelit courtyards, ecstatic poetry & mystic chants',
    host: 'Hazrat Khusro Foundation',
    date: 'Thursday, Nov 12',
    time: '7:30 PM — Midnight',
    venue: 'The Red Sandstone Haveli Courtyard',
    doorCode: 'Knock 3 times at Brass Gate #1',
    vibeTag: 'Sufi Mehfil',
    image: '/media/img5.jpeg',
    theme: 'theme-mystic-sufi',
    dressCode: 'Raw Silk, Kurta & Bohemia',
    logistics: 'Saffron tea and dinner provided · no alcohol',
    rsvpPreset: {
      yes: { emoji: '🪔', title: 'Hazir hain', sub: 'Confirmed Attending' },
      maybe: { emoji: '🌸', title: 'Koshish karenge', sub: 'Tentative' },
      no: { emoji: '🙏', title: 'Shubhkamnayein', sub: 'With you in spirit' }
    },
    guestCount: 48,
    soundFreqs: [146.83, 220.0, 293.66], // D Tanpura
    description: 'An evening honouring Amir Khusro and Bulleh Shah. Live harmonium, dholak, and communal saffron tea under strings of marigolds.'
  },

  // HAPPY HOURS
  {
    id: 'disco-house-party',
    category: 'happyhours',
    title: 'Groovy Retro House Jam',
    subtitle: 'Vinyl records, disco lights & late night energy',
    host: 'Aarav & Maya',
    date: 'Saturday, Nov 14',
    time: '8:30 PM till sunrise',
    venue: 'Secret Loft, 4th Floor',
    doorCode: 'Dial #402 at front gate',
    vibeTag: 'Happy Hours',
    image: '/media/img7.jpeg',
    theme: 'theme-retro-disco',
    dressCode: 'Retro 70s Flare & Glitter',
    logistics: 'BYOB — bring your own bottle · mixers sorted',
    rsvpPreset: {
      yes: { emoji: '🍾', title: 'Aa raha hoon', sub: 'Count me in' },
      maybe: { emoji: '🍹', title: 'Late aaunga', sub: 'Tentative' },
      no: { emoji: '😴', title: 'Nahi ho paayega', sub: "Can't make it" }
    },
    guestCount: 38,
    soundFreqs: [130.81, 164.81, 196.0], // C major house chord
    description: 'We are clearing out the living room for a full vinyl DJ set, punch bowls, and 70s strobe lights. BYOB encouraged, good vibes mandatory.'
  },
  {
    id: 'cocktail-cubist-soiree',
    category: 'happyhours',
    title: 'Contemporary Salon & Cocktails',
    subtitle: 'Art, conversation & crafted mixology',
    host: 'Tara & Rohan',
    date: 'Saturday, Dec 5',
    time: '7:00 PM — Midnight',
    venue: 'The Atrium Penthouse',
    doorCode: 'Keypad Code: 7921#',
    vibeTag: 'Cocktail Soirée',
    image: '/media/img1.jpeg',
    theme: 'theme-cubist-blush',
    dressCode: 'Chic Cocktail & Editorial',
    logistics: 'Cocktails covered · bring a record if you like',
    rsvpPreset: {
      yes: { emoji: '🥂', title: 'Aa raha hoon', sub: 'VIP Pass' },
      maybe: { emoji: '🍸', title: 'Ek drink ke liye', sub: 'Likely' },
      no: { emoji: '💌', title: 'Agli baar', sub: 'Decline' }
    },
    guestCount: 42,
    soundFreqs: [146.83, 185.0, 220.0], // D major 7 warmth
    description: 'A curated gathering of designers, artists, and storytellers. Crafted botanical cocktails, intimate jazz records, and decadent hors d’oeuvres.'
  },
  {
    id: 'jam-session-lounge',
    category: 'happyhours',
    title: 'Midnight Jazz & Acoustic Jam',
    subtitle: 'Bring your instrument, open mic & craft beers',
    host: 'Dev & Nina',
    date: 'Sunday, Nov 22',
    time: '6:30 PM — 11:30 PM',
    venue: 'The Acoustic Basement Studio',
    doorCode: 'Rooftop doorbell or ring Dev',
    vibeTag: 'Indie Gig / Jam',
    image: '/media/img3.jpeg',
    theme: 'theme-electric-cyan',
    dressCode: 'Come as you are',
    logistics: 'Beers in the fridge · bring your own gear',
    rsvpPreset: {
      yes: { emoji: '🎵', title: 'Gear laa raha hoon', sub: 'Will bring gear' },
      maybe: { emoji: '🎙️', title: 'Sunne aa raha hoon', sub: 'Tentative' },
      no: { emoji: '👋', title: 'Agla set pakadta hoon', sub: "Can't make it" }
    },
    guestCount: 24,
    soundFreqs: [164.81, 207.65, 246.94], // E minor 7
    description: 'Plug in or chill out. An unplugged jam session with electric guitars, bongo drums, and impromptu vocals. Free flowing brews on tap.'
  },

  // WEDDING
  {
    id: 'shahi-shaadi-gala',
    category: 'wedding',
    title: 'Ananya & Siddharth: Shahi Sangeet & Shaadi',
    subtitle: 'Two dynasties, royal dhol, champagne & endless celebration',
    host: 'The Kapoor & Singhania Families',
    date: 'Saturday, Dec 19',
    time: '6:00 PM — Late Night',
    venue: 'The Palatial Rose Courtyard, Heritage Palace',
    doorCode: 'VIP Valet: Royal Arch Entrance',
    vibeTag: 'Royal Wedding',
    image: '/media/img14.jpeg',
    theme: 'theme-royal-marigold',
    dressCode: 'Regal Velvet & Zari Sherwani',
    logistics: 'Dinner and bar provided · valet at the arch',
    rsvpPreset: {
      yes: { emoji: '💖', title: 'Baraat mein aana hi hai', sub: 'Going with family' },
      maybe: { emoji: '🫖', title: 'Koshish zaroor karenge', sub: 'Tentative' },
      no: { emoji: '🕊️', title: 'Duaon mein saath hain', sub: 'In spirit only' }
    },
    guestCount: 160,
    soundFreqs: [138.59, 207.65, 277.18], // Shehnai Tanpura
    description: 'Join us as we celebrate love under the stars. Live Rajasthani folk orchestra, royal banquet, champagne towers, and non-stop dancing.'
  },
  {
    id: 'mehendi-sundowner',
    category: 'wedding',
    title: 'Mehendi, Mimosas & Sangeet Sundowner',
    subtitle: 'Henna artists, marigold canopies & Punjabi dholak beats',
    host: 'Priya & Arjun',
    date: 'Friday, Dec 18',
    time: '3:00 PM — 9:00 PM',
    venue: 'Villa Bougainvillea Poolside Lawn',
    doorCode: 'Garden Gate Code: #8832',
    vibeTag: 'Wedding Sundowner',
    image: '/media/img15.jpeg',
    theme: 'theme-mystic-sufi',
    dressCode: 'Pastel Chiffon & Linen',
    logistics: 'Brunch and bar covered · wear something you can sit on grass in',
    rsvpPreset: {
      yes: { emoji: '✨', title: 'Dholak pe nachna hai', sub: 'Attending' },
      maybe: { emoji: '🍹', title: 'Mimosa ke liye aaunga', sub: 'Maybe' },
      no: { emoji: '💌', title: 'Pyaar bhej rahe hain', sub: 'Decline' }
    },
    guestCount: 95,
    soundFreqs: [146.83, 185.0, 220.0],
    description: 'Bespoke henna artists, fresh mango bellinis, artisanal chaat street, and sunset sufi-pop fusion by the pool.'
  },

  // BIRTHDAY
  {
    id: 'neon-midnight-birthday',
    category: 'birthday',
    title: 'Zoya’s 25th: Midnight Afterparty',
    subtitle: 'Electric violet lights, bespoke shots & deep basslines',
    host: 'Zoya & Crew',
    date: 'Saturday, Nov 28',
    time: '10:00 PM — Sunrise',
    venue: 'The Obsidian Warehouse Lounge',
    doorCode: 'Password at door: ELECTRIC25',
    vibeTag: 'Milestone Birthday',
    image: '/media/img10.jpeg',
    theme: 'theme-electric-cyan',
    dressCode: 'Cyber Chic & Sneakers',
    logistics: 'Cake at 2 AM · BYOB, mixers stocked',
    rsvpPreset: {
      yes: { emoji: '🍾', title: 'Aa rahe hain', sub: 'Squad mein hoon' },
      maybe: { emoji: '🍹', title: 'Baarah ke baad aaunga', sub: 'Maybe' },
      no: { emoji: '😴', title: 'Nahi ho paayega', sub: "Can't make it" }
    },
    guestCount: 54,
    soundFreqs: [130.81, 164.81, 196.0],
    description: 'Quarter century celebration. Custom cocktail menu named after bad decisions, laser mapping, and birthday cake at 2 AM.'
  },
  {
    id: 'golden-hour-milestone',
    category: 'birthday',
    title: 'Rishi’s 30th: Sunset Terraces & Vinyl',
    subtitle: 'Golden hour spritzes, charcoal grill & vinyl lounge',
    host: 'Rishi & Friends',
    date: 'Saturday, Oct 31',
    time: '5:30 PM — 11:30 PM',
    venue: 'The Skyline Pergola & Terrace',
    doorCode: 'Keypad #3030',
    vibeTag: 'Milestone Birthday',
    image: '/media/img9.jpeg',
    theme: 'theme-cubist-blush',
    dressCode: 'Chic Cocktail & Editorial',
    logistics: 'Food sorted · bring a bottle of something natural',
    rsvpPreset: {
      yes: { emoji: '🥂', title: 'Aa raha hoon', sub: 'Attending' },
      maybe: { emoji: '🍸', title: 'Sunset drink ke liye', sub: 'Maybe' },
      no: { emoji: '🎂', title: 'Door se pyaar', sub: 'Decline' }
    },
    guestCount: 36,
    soundFreqs: [146.83, 185.0, 220.0],
    description: 'Turning 30 with style. Woodfired pizzas, natural wines, funk records, and sunset polaroids over the skyline.'
  }
];

export const THEME_PALETTES = [
  /**
   * Five palettes, all built from the six brand colours.
   *
   * The ids are unchanged from the old neon set — "theme-retro-disco" and the
   * rest — because they are stored on every already-published event and renaming
   * them would silently repaint invitations people have already sent. Only the
   * values moved.
   *
   * Every one sits on the night base. The direction is explicit: event pages are
   * indigo regardless of the device setting, because the feeling wanted is
   * standing outside a door, and a light card does not do that. `theme-cubist-blush`
   * is the one exception — a stone card for a daytime thing.
   */
  {
    id: 'theme-mystic-sufi',
    name: 'Verdigris gate',
    tag: 'Mehfil',
    primary: '#4E8B7C',
    accent: '#C0922E',
    bg: '#111A32',
    cardBg: 'rgba(28, 42, 75, 0.88)',
    border: 'rgba(78, 139, 124, 0.38)',
    textColor: '#f5f7fa',
    textColorMuted: 'rgba(245,247,250,0.6)',
    soundId: 'tanpura-d',
    soundFreqs: [146.83, 220.0, 293.66]
  },
  {
    id: 'theme-retro-disco',
    name: 'Brass on night',
    tag: 'Happy hours',
    primary: '#C0922E',
    accent: '#D8A63C',
    bg: '#111A32',
    cardBg: 'rgba(28, 42, 75, 0.88)',
    border: 'rgba(192, 146, 46, 0.4)',
    textColor: '#f5f7fa',
    textColorMuted: 'rgba(245,247,250,0.6)',
    soundId: 'house-c',
    soundFreqs: [130.81, 164.81, 196.0]
  },
  {
    id: 'theme-royal-marigold',
    name: 'Stone and ink',
    tag: 'Wedding',
    primary: '#C0922E',
    accent: '#19140F',
    bg: '#1C2A4B',
    cardBg: 'rgba(230, 213, 174, 0.94)',
    border: 'rgba(25, 20, 15, 0.6)',
    textColor: '#19140F',
    textColorMuted: 'rgba(25,20,15,0.6)',
    soundId: 'shehnai',
    soundFreqs: [233.08, 349.23, 466.16]
  },
  {
    id: 'theme-electric-cyan',
    name: 'Chrome edge',
    tag: 'Retro-future',
    primary: '#C9CFD6',
    accent: '#4E8B7C',
    bg: '#111A32',
    cardBg: 'rgba(24, 36, 64, 0.9)',
    border: 'rgba(201, 207, 214, 0.34)',
    textColor: '#f5f7fa',
    textColorMuted: 'rgba(245,247,250,0.6)',
    soundId: 'neon',
    soundFreqs: [164.81, 207.65, 246.94]
  },
  {
    id: 'theme-cubist-blush',
    name: 'Rani, rationed',
    tag: 'Live',
    primary: '#D23C78',
    accent: '#C0922E',
    bg: '#111A32',
    cardBg: 'rgba(28, 42, 75, 0.88)',
    border: 'rgba(210, 60, 120, 0.36)',
    textColor: '#f5f7fa',
    textColorMuted: 'rgba(245,247,250,0.6)',
    soundId: 'disco',
    soundFreqs: [146.83, 185.0, 220.0]
  }
];

/**
 * Backgrounds worth suggesting for a given vibe, best fit first.
 *
 * Nothing is hidden: the studio shows the whole library underneath, this only
 * decides what surfaces in the "Suggested for your vibe" row.
 */
export function recommendBackgrounds(categoryId, limit = 4) {
  const scored = BACKGROUNDS.map((bg, i) => ({
    bg,
    // Primary mood match wins; a secondary mention is still a hit; index keeps
    // the order stable and deterministic for anything that ties.
    score: bg.moods[0] === categoryId ? 0 : bg.moods.includes(categoryId) ? 1 : 2,
    i
  }));
  scored.sort((a, b) => a.score - b.score || a.i - b.i);
  return scored.slice(0, limit).map((s) => s.bg);
}
