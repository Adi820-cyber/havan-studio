# 🎉 HAVAN Studio — Interactive Invitation Studio

An interactive invitation web app built with **React 19**, **Vite 6**, vanilla CSS,
the **Web Audio API**, and a **Supabase Postgres** backend — structured as an
enterprise-grade monorepo with separated frontend and backend.

---

## 📐 Architecture

```
AWS_HAVAN/
├── frontend/          React SPA (Vite) → S3 + CloudFront / Vercel
├── backend/           Express API      → Native Node.js Server / AWS App Runner / Elastic Beanstalk
├── supabase/          Database migrations + tests (shared)
├── infra/             CodeBuild & CI/CD deployment specs
└── scripts/           Verification tools
```

```
┌────────────────┐         ┌────────────────────┐
│  S3+CloudFront │ ──/api──▶  Express API        │
│  React SPA     │         │  (Node.js 20)      │
└────────────────┘         │                     │
                           │  ├── Auth           │
                           │  ├── Events         │
                           │  ├── RSVP           │
                           │  ├── Comments       │
                           │  ├── Profiles       │
                           │  ├── Upload (S3)    │
                           │  └── SSE (realtime) │
                           │         │           │
                           └─────────┼───────────┘
                                     │
                           ┌─────────▼───────────┐
                           │  Supabase           │
                           │  Postgres + Auth    │
                           └─────────────────────┘
```

**Key decisions:**
- Frontend **never** talks to Supabase directly — all data flows through the backend API
- Backend acts as an API gateway proxying Supabase RPCs with proper auth
- SSE (Server-Sent Events) replaces direct Supabase Realtime WebSocket
- Secrets (service_role key, AWS keys) stay on the backend only
- Built & deployed natively using Git CI/CD services (GitHub Actions / AWS CodeBuild) without Docker overhead

---

## ⚡ Quick Start

### Prerequisites
- Node.js 20+
- npm 9+

### Local Development (Direct Node.js)

```bash
# 1. Install all dependencies
npm run install:all

# 2. Configure backend environment
cp backend/.env.example backend/.env.local
# Fill in: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY,
#          AWS_REGION, AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY

# 3. Run both services concurrently
npm run dev
# → Frontend: http://localhost:3001  (proxies /api to backend)
# → Backend:  http://localhost:3000
```

---

## 🏗 Project Structure

### Frontend (`frontend/`)

React 19 SPA with no Supabase client. All API calls go through `services/api.js` 
which uses `fetch()` to the backend.

```
frontend/
├── src/
│   ├── components/     27 React components
│   ├── data/           templates, vibes, seenHai content
│   ├── hooks/          useSSE (realtime via Server-Sent Events)
│   ├── lib/            icons
│   ├── services/       api.js (fetch-based, no Supabase)
│   ├── styles/         brand.css, reveals.css
│   ├── types/          database.types.ts
│   ├── utils/          prepareImage, soundEffects
│   ├── App.jsx
│   └── main.jsx
├── public/             avatars, media, seen-hai clips
├── vite.config.js
├── vercel.json         Vercel security headers
└── package.json
```

### Backend (`backend/`)

Express API server that proxies Supabase Auth + RPCs. Holds all secrets.

```
backend/
├── src/
│   ├── config/
│   │   ├── env.js        Env validation (fail-fast)
│   │   └── supabase.js   Admin + per-user client factory
│   ├── middleware/
│   │   ├── auth.js       JWT validation (requireAuth / optionalAuth)
│   │   ├── cors.js       CORS configuration
│   │   ├── rateLimit.js  Tiered rate limiting
│   │   ├── security.js   API security & cache control
│   │   └── errorHandler.js
│   ├── routes/
│   │   ├── auth.js       Signup, login, logout, anonymous sessions
│   │   ├── events.js     Create event, get invite, guest list
│   │   ├── rsvp.js       Submit RSVP
│   │   ├── comments.js   Hype wall read/write
│   │   ├── profiles.js   Profile CRUD + public lookup
│   │   ├── upload.js     S3 presigned URLs
│   │   ├── invitees.js   Private invite management
│   │   ├── sse.js        Realtime proxy (Supabase → SSE)
│   │   ├── dashboard.js  My invitations
│   │   └── health.js     Health check endpoint
│   └── app.js            Express app assembly
├── server.js             Entry point
└── package.json
```

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/signup` | No | Create account |
| POST | `/api/auth/login` | No | Sign in |
| POST | `/api/auth/logout` | Yes | Sign out |
| POST | `/api/auth/anonymous` | No | Guest session |
| GET | `/api/auth/session` | Yes | Current user |
| POST | `/api/auth/refresh` | No | Refresh token |
| GET | `/api/events/:slug` | Optional | Load invitation |
| POST | `/api/events` | Yes | Create event |
| GET | `/api/events/:slug/guests` | Yes (host) | Guest list |
| POST | `/api/rsvp/:slug` | Yes | Submit RSVP |
| GET | `/api/comments/:slug` | Yes | Read comments |
| POST | `/api/comments/:slug` | Yes | Post comment |
| GET | `/api/profiles/me` | Yes | Own profile |
| PUT | `/api/profiles/me` | Yes | Update profile |
| GET | `/api/profiles/:handle` | No | Public profile |
| GET | `/api/upload/presigned-url` | Yes | S3 upload URL |
| POST | `/api/invitees/:slug` | Yes (host) | Add invitee |
| GET | `/api/invitees/:slug` | Yes (host) | List invitees |
| DELETE | `/api/invitees/:id` | Yes (host) | Remove invitee |
| GET | `/api/sse/events/:eventId` | Optional | Realtime stream |
| GET | `/api/dashboard/invites` | Yes | My invitations |
| GET | `/api/health` | No | Health check |

---

## 🚀 Git CI/CD & Deployment

### CI/CD Workflow
- **GitHub Actions:** Enforced via `.github/workflows/ci-cd.yml` on every `push` and `pull_request`
  - Runs static syntax & reference verification (`npm run verify`)
  - Compiles frontend assets (`npm run build`)
- **AWS CodeBuild:** Configured in `infra/buildspec.yml` for direct Node.js builds & S3/CloudFront sync

### Hosting Setup
- **Frontend:** Deployed to S3 + CloudFront or Vercel
- **Backend:** Deployed directly as a Node.js 20 service (AWS Elastic Beanstalk / App Runner / EC2)
- **Database:** Supabase (external)

---

## 🛠 Built With

React 19 · Vite 6 · Express · Supabase (Postgres, Auth, RLS) · AWS S3 ·
Git CI/CD · GitHub Actions · Lucide Icons · Canvas Confetti · Web Audio API
