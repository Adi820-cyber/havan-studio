# Session changes — brand pass

The brand direction document is now the specification. Everything below either
implements it or gets out of its way.

Run `npm run verify` for a static check (37 files, clean). You still need
`npm run build` and `supabase db push` on your machine — see the end.

---

## 1. The whole UI now follows the direction

The old stylesheet was a generic dark-glass system: pill buttons, 24px radii,
purple-to-cyan gradients, glassmorphism, drop shadows, confetti. That is almost
exactly the "never" list in your document.

Rather than touch thirty components' inline styles and break things that work,
the correction lives in one readable file, `src/styles/brand.css`, loaded after
`index.css` and deliberately overriding it. `!important` beats an inline `style`
attribute, so components still ship `borderRadius: 14` in their JSX and the
chamfer wins anyway. As each component gets rewritten later it can just drop its
inline value.

What landed:

- **The six colours.** Jodhpur night and Jaisalmer stone as bases, brass for the
  one primary action, verdigris for confirmed and for focus rings, rani rationed,
  chrome for hairlines. The five theme palettes were retuned to these — but their
  **ids are unchanged** (`theme-retro-disco` and the rest), because those are
  stored on every already-published event and renaming them would silently
  repaint invitations people have already sent.
- **Chamfers, never radii.** 14px cards, 10px buttons, 6px avatars, via
  `clip-path`. The four-corner ziggurat is reserved, as specified.
- **Two faces.** Clash Display on display, Mukta on everything else including
  Devanagari. `Space Grotesk` and `Outfit` are gone from the chrome.
- **Removed:** the ambient gradient glow, glassmorphism blur except on sticky
  headers where it does legibility work, and all box shadows on chamfered
  elements (a clip-path eats them anyway — the direction's two-pixel ink borders
  are the correct replacement).
- **Confetti** is on your never list. I retinted the remaining bursts to brass,
  verdigris, stone and rani rather than removing them outright: the reply moment
  is the one place a small burst is earned. Say the word and it goes entirely.

## 2. The host chooses the card's type

Six faces, all already loaded by `index.html`, so choosing one costs no extra
request: Clash Display, Unbounded, Mukta, Syne, Space Grotesk, JetBrains Mono.
Each shows a live specimen set in itself.

Deliberately absent: Poiret One, Limelight, Broadway. Your document is explicit
that deco is in the shapes, not the lettering, and those read as a costume.

The product chrome stays locked to two faces. The card is the one place a host
gets a say, because a qawwali baithak and a 2 AM warehouse thing should not be
set identically.

## 3. Vibe is step one

Swapped. Worth naming: this reverses what you asked for last round, and I think
this version is right — picking artwork is the part a host *wants* to do and the
fields are the part they have to do, so opening on the fields made the studio read
as a form with a decoration step bolted on.

The occasion chips moved to the very top of step one, because every suggestion
below them is ordered against that answer, and it is one tap.

If you want it back the other way it is one line: swap the two entries in `STEPS`
in `InvitationCardMaker.jsx`. Nothing else depends on the order.

## 4. Twelve card reveals

`src/styles/reveals.css` plus `RevealOnScroll.jsx`. The host picks one; it fires
once, when the guest scrolls to the card, and never again that visit.

gate · book · envelope · stepwell · facet · curtain · wedge · blinds · iris ·
unfold · marquee · dissolve

Every one is a **threshold**, not an effect. Your document says every board was
about a door and that "a party app is the same object: something you are either
let into or not" — so nothing bounces, sparkles or pops. Things open, fold,
descend, or are cut away. *Gate* is the default and the signature. *Dissolve* is
the quiet one, for a mehfil where a door slamming open is the wrong register.

Three things the wrapper gets right that are easy to get wrong:

- **Once.** An observer that re-fires on every scroll-past turns an invitation
  into a slot machine. It disconnects itself on trigger.
- **Already-visible cards.** On a direct link the card is on screen at mount, so
  it would fire instantly and look like a glitch. One frame of delay lets the
  closed state paint first.
- **Letting go.** Animations end on a transform, and an ancestor with a transform
  silently breaks `position: sticky` and `fixed` in every descendant. The wrapper
  adds `is-done` afterwards to clear it — without that, the reveal would quietly
  break the share sheet on the same page.

`prefers-reduced-motion` collapses all twelve to one fade.

## 5. Twelve soundscapes

One drone played on every invitation regardless of what it was for, which made it
feel like a system sound rather than part of the card.

tanpura D · tanpura C♯ · harmonium · shehnai · sarangi · house chord · basement
throb · rooftop 8pm · disco strings · neon minor · afterparty 4am · no sound

They differ in more than pitch, which is the point — transposing one chord twelve
times would have given you twelve versions of the same sound. The synth now takes
oscillator shape, filter cutoff, vibrato rate and depth, cents of detune between
voices, and an optional amplitude pulse. That last one is the difference between
a drone and a room with music in it: *basement throb* pulses at 2 Hz through an
almost-shut filter, *afterparty* at 0.55 Hz.

"No sound" is a real choice, not a broken state. Nothing plays until the guest
turns it on.

## 6. More content, in the product's voice

New `TheDoor.jsx` section: four moments in the life of one invitation — behind
the gate, seen hai ab bata, the stuff nobody says out loud, replies close before
it starts. Devanagari set in Mukta beside the Latin at matching weight, as
specified.

Voice pass across the reply presets and landing copy, to your rules: sentence
case, short lines, no exclamation marks, no emoji in system copy, Hinglish where
the Hindi word is the natural one. "Hell Yeah!" and "FOMO Sleeping" became "Aa
raha hoon" and "Nahi ho paayega". There are now zero exclamation marks in
`templates.js`.

## 7. Logistics → House rules, multi-select

Renamed again, and this time to something a person would say. "Logistics" sounds
like a shipping form; these are the things you say at the door.

**Multi-select is the real fix.** BYOB *and* no plus-ones *and* out by two is one
ordinary party — the single-choice field forced a host to pick which of those
mattered most and drop the rest. Fourteen rules now, selected as a set, published
as a list, rendered as separate lines on the invite. Plus one free-text line for
anything that isn't on the list.

New entries worth having: shoes off, quiet after midnight, out by two, come by
cab, there is a cat, no stories, aux is open.

## 8. Other things

- **Palette sound coupling.** Choosing a colour or a suggested background now also
  sets the soundscape that was chosen against it, so one tap moves three things
  that belong together.
- **The guest's synth follows the host's choice.** `LiveInviteView` had its own
  hardcoded drone; it now plays whichever soundscape was published, with the old
  stored chord as fallback so existing invites still work.
- **House rules render on the invite** from the new structured list, and fall back
  to splitting the legacy joined string for invites published before today.

---

## Honest limits

- **Not every component is repainted.** The brand layer corrects colour, type,
  corners and the forbidden effects globally, which is most of what you see. But
  components with heavily bespoke inline layout — `HostPanel`, `CheckInviteModal`,
  `SeenHaiReaction`, the share sheet — still have their own spacing and structure
  underneath. They now *read* as the brand; they are not yet *designed* to it.
- **The stepwell motif** exists as a CSS utility (`.havan-stepwell`) but is not
  yet used as the loading state or the RSVP progress bar. That is the next real
  piece of the identity and it needs the SVG, not a CSS gradient.
- **The still-life illustration language** for empty states is not started. It
  needs actual artwork.
- **Day base** is defined (`.havan-day`) but nothing uses it yet — discovery and
  settings are the screens that should.
- **No build run.** `npm run build` cannot run here; your `node_modules` ships
  Windows-only Rollup and esbuild binaries and there is no network to fetch Linux
  ones. `npm run verify` parses everything, resolves every import, checks named
  exports and lucide icon names against the installed package, and flags unbound
  identifiers — but it does not execute anything or check CSS.

## Before you ship

1. `npm install && npm run build`.
2. `supabase db push` — the profiles and storage migration from last round is
   still pending.
3. Open an invite on a phone and watch the reveal. The 3D ones (book, envelope,
   unfold) are the most likely to need timing adjustment on a real device.
4. Turn the sound on for three different soundscapes and confirm they are
   audibly different, not three pitches of the same thing.
5. Check a sticky header still sticks on the invite page after the reveal has
   finished — that is the failure mode `is-done` exists to prevent.
