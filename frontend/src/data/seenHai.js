/**
 * "Seen Hai" — the reply system.
 *
 * Replaces the acronym "RSVP" in everything a guest reads. RSVP is a French
 * abbreviation nobody says out loud; "seen hai" is what actually happens when
 * someone opens your invite and leaves you hanging, so the product may as well
 * call it that.
 *
 * The three database statuses are unchanged — `going`, `maybe`, `not_going` —
 * because they are enforced by a CHECK constraint and referenced by RLS. Only
 * the wording a person sees is different.
 *
 * Each status carries a pool of one-liners and a pool of clips. On reply the app
 * picks one of each, avoiding whatever it showed last time so a guest changing
 * their mind gets a different reaction.
 *
 * Clips were converted from the source GIFs to h264 MP4 (52.8 MB -> 1.12 MB).
 * They are played through <video autoplay loop muted playsinline>, which is both
 * far smaller than GIF and pauses correctly when the tab is hidden.
 */

export const SEEN_HAI = {
  going: {
    /** Status label a guest sees on the button. */
    label: 'Aa raha hoon',
    sub: 'Coming',
    /** Colour used for the button, the celebration ring and the confetti. */
    tint: '#34d399',
    confetti: ['#C0922E', '#4E8B7C', '#E6D5AE', '#D23C78'],
    lines: [
      'Gadi nikal, chabi kaha hai?',
      'Scene kya hai? Scene ON hai.',
      'Apna time aa gaya.',
      'All izz well, main aa raha.',
      'Ek baar jo maine commitment kar di…',
      'Aaj khush toh bahut hoge tum.',
      'Mogambo khush hua.',
      'Jaa Simran, jaa… aa ja party mein.',
      'Picture abhi baaki hai.',
      'Abhi maza aayega na bhidu.',
      'Aila! Party mein jaana hai!',
      'Bade bade deshon mein… aise seen hai hote rehte hain.',
      'Don ko pakadna mushkil nahi… main aa raha hoon.',
      'Aaj mere paas party hai.',
      'Keh diya na, bas keh diya.',
      'Control Uday, main aa raha hoon.',
      'Ye dosti hum nahi todenge.',
      'Aap purush hi nahi… mahapurush ho.',
      'Thala for a reason. Attendance bhi.',
      'Jhakaas. Count me in.'
    ],
    clips: [
      'gaadi-nikal',
      'gaadi-nikal-cat',
      'oye-hoye',
      'husky-dance',
      'beatbox-cat',
      'cat-hype',
      'love'
    ]
  },

  maybe: {
    label: 'Dekhte hain',
    sub: 'Maybe',
    tint: '#fbbf24',
    confetti: ['#fbbf24', '#f5b544', '#ffffff'],
    lines: [
      'Aayein? Baigan?',
      'Dekh lenge.',
      'Scene kya hai abhi?',
      'Kitne aadmi the?',
      'Pooja, what is this behaviour?',
      'Kya bolti public?',
      'Baat toh sahi hai…',
      'Sochne wali baat hai.',
      'Mujhe ghar jaana hai… par dekhte hain.',
      'Picture abhi baaki hai.',
      'Abhi maza aayega… shayad.',
      'Ruko zara, sabar karo.',
      'Aisa kya?',
      'Emotional damage. Calendar bhi.',
      'Moye moye… abhi decide nahi.',
      'Ye kya ho raha hai?',
      'Control Uday, pehle dekhte hain.',
      'Bhai, thoda ruk.',
      'Kuch bhi ho sakta hai.'
    ],
    clips: [
      'confused-cat',
      'rabbit-confused',
      'dog-unsure',
      'dog-hiding',
      'head-bang',
      'frustrated',
      'ughhh'
    ]
  },

  not_going: {
    label: 'Nahi aa paunga',
    sub: 'Not coming',
    tint: '#f87171',
    // No celebration for a decline — a small commiseration puff, not a party.
    confetti: ['#f87171', '#94a3b8'],
    lines: [
      'Aba nahi manenge.',
      'Idhar zeher khane ka paisa nahi hai, tu ja re.',
      'Nahi nahi… ye nahi ho sakta.',
      'Mereko ghar jaana hai.',
      'Aye, nahi re baba.',
      'Pooja, what is this behaviour?',
      'Ye dukh kahe khatam nahi hota be?',
      'Mera toh lag gaya.',
      'Kya karu main, mar jaaun?',
      'Aayein? Baigan? Nahi bhai.',
      'Bhai, paisa ho toh bhej.',
      'Control Uday, budget nahi hai.',
      'Moye moye.',
      'Mereko nahi jaana.',
      'Ye kya bawasir bana rakhe ho?',
      'Hum nahi sudhrenge… par aa bhi nahi rahe.',
      'Aapko kya lagta hai, main aaunga?',
      'Bhai, scene khatam.',
      'Janta maaf nahi karegi… par main ghar pe hoon.',
      'Bas kar bhai, rulayega kya?'
    ],
    clips: [
      'gojo-nah',
      'nah-nope',
      'you-should-leave',
      'ok-cat',
      'dramatic-cry',
      'sad-slump',
      'sad-cat',
      'bunny-carrot'
    ]
    // 'cubs-win' was supplied under nope/ but a winning-team clip reads as
    // celebration, so it is deliberately not in this pool. The file is still in
    // public/seen-hai/nope/ if you want it moved to `going`.
  }
};

/** Folder each status's clips live in, mirroring the original seen_hai/ layout. */
const CLIP_DIR = { going: 'agree', maybe: 'maybe', not_going: 'nope' };

export function clipSrc(status, clipName) {
  return `/seen-hai/${CLIP_DIR[status] || 'agree'}/${clipName}.mp4`;
}

/** Picks a random item, avoiding `previous` when the pool has room to. */
function pickDifferent(pool, previous) {
  if (!pool || pool.length === 0) return null;
  if (pool.length === 1) return pool[0];
  const options = pool.filter((p) => p !== previous);
  return options[Math.floor(Math.random() * options.length)];
}

/**
 * Builds one reaction: a line, a clip and the colours to celebrate with.
 * Pass the previous reaction to avoid repeating yourself.
 */
export function pickReaction(status, previous = {}) {
  const cfg = SEEN_HAI[status] || SEEN_HAI.going;
  const line = pickDifferent(cfg.lines, previous.line);
  const clip = pickDifferent(cfg.clips, previous.clip);
  return {
    status,
    line,
    clip,
    src: clip ? clipSrc(status, clip) : null,
    tint: cfg.tint,
    confetti: cfg.confetti,
    label: cfg.label,
    sub: cfg.sub
  };
}

/** UI key ('yes' | 'maybe' | 'no') to the database status value. */
export const UI_TO_STATUS = { yes: 'going', maybe: 'maybe', no: 'not_going' };
export const STATUS_TO_UI = { going: 'yes', maybe: 'maybe', not_going: 'no' };

/** Short human label for a stored status, used in the host's guest list. */
export const STATUS_LABEL = {
  going: 'Aa raha hai',
  maybe: 'Dekh raha hai',
  not_going: 'Nahi aa raha'
};
