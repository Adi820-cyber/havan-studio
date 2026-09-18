# 🎉 HAVAN Studio — Interactive Invitation Studio

An interactive invitation web app built with **React 19**, **Vite 6**, vanilla CSS, the
**Web Audio API**, and a **Supabase Postgres** backend.

---

## ⚡ Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure Supabase
#    Copy the template, then fill in the two VITE_ values from
#    Supabase Dashboard → Project Settings → API
cp .env.example .env.local

# 3. Run the dev server
npm run dev        # → http://localhost:3001
```

The app will refuse to start with a clear error if `.env.local` is missing, rather
than failing mysteriously at the first query.

---

## 🏗 Architecture

```
Browser (React SPA)
   │
   │  supabase-js, publishable key
   ▼
Supabase
   ├── Auth        — bcrypt password hashing, signed JWTs, anonymous sessions
   └── Postgres    — RLS policies + SECURITY DEFINER functions
```

`server.js` exists only to serve the built static files with an SPA fallback. It
holds no secrets and no application state.

### Where the security lives

Authorization is enforced in the database, not in client code. The relevant
definitions are in `supabase/migrations/`:

| Guarantee | How |
|---|---|
| Passwords are never stored by this app | Supabase Auth owns credentials. No password column exists in `public`. |
| No enumerating other people's events | `events` SELECT is restricted to the host. `anon` holds no grant on the table at all. |
| Venue address + door code stay secret | Only `get_invite()` can disclose them, and only to the host or a guest who replied going/maybe. |
| Invite links are unguessable | Slugs get a 10-hex-character random suffix, generated server-side by a trigger. |
| RSVPs can't be hijacked | `rsvps` is unique on `(event_id, guest_id)` where `guest_id` is `auth.uid()`. A contact string is data, not an identity claim. |
| Nobody can read your invite list | `get_my_invites()` takes no arguments and reads `auth.uid()`. |
| Only real accounts can host | The `events` INSERT policy rejects anonymous sessions. |

Guests do not need an account. Tapping RSVP creates an **anonymous** Supabase
session, which gives the guest a durable `auth.uid()` without a signup form —
that uid is what makes their reply theirs alone.

### Verifying it

```bash
$env:SB_URL = 'https://<project-ref>.supabase.co'
$env:SB_PUB = '<sb_publishable_... key>'
node supabase/tests/rls-verification.mjs
```

35 adversarial checks, each replaying an attack that the previous backend allowed.

---

## 🗄 Database

Four tables in `public`: `profiles`, `events`, `rsvps`, `comments`. RLS is enabled
on all of them.

Client access goes through five functions rather than raw table queries:

| Function | Caller | Purpose |
|---|---|---|
| `get_invite(slug)` | anon + authenticated | Load an invitation; gates the venue secrets |
| `submit_rsvp(...)` | authenticated | Upsert a reply, optionally post a note, return the refreshed invite |
| `post_comment(...)` | authenticated | Hype wall write |
| `get_event_comments(slug)` | authenticated | Hype wall read |
| `get_my_invites()` | authenticated | Hosted + replied-to invitations |

Creating an event is a direct insert; triggers pin `host_id` to `auth.uid()` and
generate the slug.

### Schema changes

```bash
supabase migration new my_change     # write SQL in supabase/migrations/
supabase db push                     # apply to the linked project
supabase gen types typescript --linked > src/types/database.types.ts
node supabase/tests/rls-verification.mjs
```

---

## 🚀 Deploy (Render)

`render.yaml` is ready. Two things to remember:

1. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the Render
   dashboard. Vite inlines these at **build** time, so they must exist before
   `npm run build` runs.
2. Add your Render URL to Supabase → Authentication → URL Configuration, and
   update `site_url` in `supabase/config.toml`.

No persistent disk is required — the service is stateless.

---

## 🌟 Features

- **Dual-pane studio** with live card preview: mouse-tracking spotlight, 3D tilt,
  wax seal monograms, framing borders, countdown, and event chips.
- **Curated archetypes** across mehfil, house party, wedding, birthday and
  cocktail themes, with six colour palettes and a canvas particle layer.
- **In-browser Web Audio synthesizer** — deep house chords and tanpura drones
  synthesised live from oscillators, with no audio files shipped.
- **High-dopamine RSVP** — confetti on confirmation, then the venue address and
  entry code are revealed by the database.
- **Share tools** — RFC 5545 `.ics` export built from the event's real
  timestamp, WhatsApp share text, and a QR code rendered locally so the invite
  link is never sent to a third-party image service.
- **Hype wall** — guest messages, readable once you have replied.

---

## 🛠 Built With

React 19 · Vite 6 · Supabase (Postgres, Auth, RLS) · lucide-react ·
canvas-confetti · qrcode · Web Audio API

---

## ⚠️ Migrating from the old backend

Earlier versions stored everything in `data/database.json`, served by a
hand-rolled API in `server/`. Both are gone. If you are updating an existing
clone:

- `data/` is now gitignored and no longer read by the app.
- **That file was previously committed with plaintext passwords.** Removing it
  from tracking does not remove it from git history. Purge it
  (`git filter-repo --path data/database.json --invert-paths`) and treat every
  password that ever existed in it as compromised.
- There are no `fiesta_host_key_*` / `fiesta_rsvp_*` / `fiesta_token`
  localStorage entries any more. Ownership is the authenticated session.

---

## 🎬 Seen Hai — the reply system

"RSVP" is a French abbreviation nobody says out loud. What actually happens is
someone opens your invite and leaves you hanging, so the product calls it **Seen
Hai**.

Three replies, each with a pool of Bollywood one-liners and a reaction clip:

| Reply | Label | Example line |
|---|---|---|
| Coming | *Aa raha hoon* | Gadi nikal, chabi kaha hai? |
| Maybe | *Dekhte hain* | Aayein? Baigan? |
| Not coming | *Nahi aa paunga* | Idhar zeher khane ka paisa nahi hai, tu ja re. |

Copy lives in `src/data/seenHai.js`. The three database status values
(`going` / `maybe` / `not_going`) are unchanged — they are enforced by a CHECK
constraint and referenced by RLS, so only the wording differs.

Answering fires a party-popper burst for a yes, a small puff for a maybe, and a
deliberately meagre one for a no. Celebrating a decline with full confetti reads
as sarcasm.

### The clips

Source GIFs were 52.8 MB across 23 files, one of them 13.5 MB on its own — far
too heavy for a link opened on mobile data. They are encoded to muted h264 MP4
and played through `<video autoplay loop muted playsinline>`, which is smaller and
pauses itself when the tab is hidden.

**52.8 MB → 1.12 MB (about 48× smaller).**

`seen_hai/` holds the originals and is gitignored; `public/seen-hai/` holds what
ships and is tracked. To re-encode after adding a GIF:

```bash
ffmpeg -y -i input.gif \
  -vf "fps=20,scale='min(480,iw)':-2" \
  -c:v libx264 -crf 30 -pix_fmt yuv420p -movflags +faststart -an \
  public/seen-hai/<agree|maybe|nope>/<name>.mp4
```

Then add `<name>` to the matching `clips` array in `src/data/seenHai.js`.

Two notes on the supplied set: `cubs-win` was filed under `nope/` but a
winning-team clip reads as celebration, so it is not in the decline pool — move it
to `going` if you want it. And `sad-cat.gif` is a single frame (0.10s), so its clip
is effectively a still.

---

## 👥 What the host sees

A host opening their own invitation gets a guest list panel: who replied, what
they chose, their contact, plus-ones and dietary notes, with live counts and a
head count that includes plus-ones.

This is enforced in the database, not the client. `get_event_guests(slug)` raises
`42501` for anyone who is not the host rather than returning a filtered list, so
there is no ambiguity about whether data leaked. Verify with:

```bash
node supabase/tests/host-view-verification.mjs
```

Notes are threaded one level deep, so a host can reply underneath a guest's note
and the guest sees the answer badged `HOST`.
