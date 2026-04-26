# RSVP Reader — Multi-User Hosting Design Spec
**Date:** 2026-04-26

## Overview

Upgrade the RSVP Reader from a single-user local app to a hosted multi-user platform. Users log in with email + password, manage their own private book libraries, and share reading progress independently. An admin panel lets the owner manage accounts and a shared library visible to all users.

---

## Stack Changes

| Layer | Before | After |
|---|---|---|
| Frontend hosting | Local Vite dev server / Express static | Cloudflare Pages |
| Backend hosting | Local Node.js | Fly.io (Docker container) |
| Database | Filesystem (meta.json files) | Neon.tech PostgreSQL |
| File storage | Local filesystem | Cloudflare R2 |
| Auth | None | JWT in httpOnly cookies + bcrypt |

---

## Architecture

```
Cloudflare Pages (React SPA)
        │  HTTPS  (CORS restricted to Pages domain)
        ▼
Fly.io — Express in Docker (single shared-cpu-1x, 256 MB)
        ├── Neon.tech PostgreSQL  (users, books, progress)
        └── Cloudflare R2         (pdfs/{id}.pdf, cache/{id}.json)
```

- Cloudflare Pages auto-deploys from `main` on GitHub push
- Fly.io backend deployed via `fly deploy` from repo root
- Express no longer serves static files — Pages handles the SPA
- All secrets stored in Fly.io secrets, never in code

---

## Database Schema

### `users`
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
email         TEXT UNIQUE NOT NULL
username      TEXT UNIQUE NOT NULL
password_hash TEXT NOT NULL
role          TEXT NOT NULL DEFAULT 'user'  -- 'user' | 'admin'
created_at    TIMESTAMPTZ DEFAULT NOW()
```

### `books`
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
is_shared   BOOLEAN NOT NULL DEFAULT FALSE
title       TEXT NOT NULL
word_count  INTEGER NOT NULL DEFAULT 0
has_warning BOOLEAN NOT NULL DEFAULT FALSE
created_at  TIMESTAMPTZ DEFAULT NOW()
```

Shared books have `is_shared = TRUE`. The uploader (admin) remains `owner_id`. Every user sees their own books plus all rows where `is_shared = TRUE`.

### `progress`
```sql
user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
book_id     UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE
word_index  INTEGER NOT NULL DEFAULT 0
wpm         INTEGER NOT NULL DEFAULT 300
updated_at  TIMESTAMPTZ DEFAULT NOW()
PRIMARY KEY (user_id, book_id)
```

Per-user per-book progress. Two users reading the same shared book have independent rows — positions and WPM never collide.

---

## File Storage (Cloudflare R2)

R2 layout is unchanged from the current filesystem layout:

```
pdfs/{book_id}.pdf
cache/{book_id}.json
```

Accessed via the AWS SDK (`@aws-sdk/client-s3`) — R2 is S3-compatible. The backend streams uploads directly to R2 using multer's memory storage (no temp files on the server). Word cache JSON is written to R2 after extraction.

R2 is private — no public bucket access. All reads go through the authenticated Express API.

---

## Authentication

### Login flow
1. `POST /api/auth/login` with `{ email, password }`
2. Server looks up user by email, verifies bcrypt hash (cost factor 12)
3. On success: signs JWT `{ sub: userId, role }`, sets as httpOnly + Secure + SameSite=Strict cookie (7-day expiry)
4. On failure: 401 with generic message ("Invalid email or password") — no oracle for valid emails

### Per-request auth
- `requireAuth` middleware: verifies JWT cookie, attaches `req.user = { id, role }` to request
- `requireAdmin` middleware: calls `requireAuth` then checks `role === 'admin'`, returns 403 otherwise
- Expired or tampered tokens → 401, client redirects to login screen

### Admin bootstrapping
First admin created via `npm run seed` which reads `ADMIN_EMAIL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` from environment variables and inserts a hashed user row. Run once on first deploy via `fly ssh console`, then remove those secrets.

### No password reset email
Admin resets passwords directly from the admin panel. No email infrastructure required.

---

## Security

| Concern | Measure |
|---|---|
| Password storage | bcrypt cost factor 12 |
| Token theft via XSS | httpOnly cookie — JS cannot read it |
| CSRF | SameSite=Strict cookie + CORS origin allowlist |
| Brute force | express-rate-limit: 10 attempts / 15 min per IP on login route |
| Security headers | helmet.js (CSP, HSTS, X-Frame-Options, nosniff) |
| SQL injection | Parameterized queries via `pg` driver — no string concatenation |
| File uploads | Mimetype + extension validation, 200 MB size cap |
| User isolation | All book queries filter by `owner_id = req.user.id OR is_shared = TRUE` |
| Secrets | Fly.io secrets for JWT secret, DB URL, R2 keys — never committed |

---

## API Routes

### Public
```
POST /api/auth/login    — verify credentials, set JWT cookie
POST /api/auth/logout   — clear JWT cookie
GET  /api/auth/me       — return { id, username, role } for logged-in user
```

### Authenticated (requireAuth)
```
GET    /api/books              — own books + shared books, each with { isOwner, isShared }
POST   /api/books              — upload PDF to own library
GET    /api/books/:id/words    — word array (own or shared books only)
DELETE /api/books/:id          — own books only
PUT    /api/books/:id/progress — upsert (user_id, book_id) row in progress table
```

### Admin only (requireAdmin)
```
GET    /api/admin/users                — list all users
POST   /api/admin/users                — create user { email, username, password, role }
DELETE /api/admin/users/:id            — delete user + cascade books and progress
PUT    /api/admin/users/:id/password   — hash and store new password

GET    /api/admin/books                — all books across all users
DELETE /api/admin/books/:id            — delete any book
PUT    /api/admin/books/:id/share      — set is_shared = TRUE
DELETE /api/admin/books/:id/share      — set is_shared = FALSE
```

---

## Frontend Changes

### New files
- `client/src/screens/LoginScreen.jsx` — email + password form, centered, dark themed
- `client/src/screens/AdminScreen.jsx` — three-tab admin panel
- `client/src/api.js` — add `login`, `logout`, `getMe`, `adminUsers*`, `adminBooks*` calls

### Modified files
- `client/src/App.jsx` — add auth state; show LoginScreen when unauthenticated; show Admin link in nav when role === 'admin'
- `client/src/screens/LibraryScreen.jsx` — render shared book badge, hide delete button on books the user doesn't own
- `client/src/api.js` — change `BASE` to use `VITE_API_URL` env var; all fetch calls already send cookies via `credentials: 'include'`

### Admin Panel (AdminScreen.jsx)

Three tabs:

**Users tab**
- Table: username, email, created date, role
- "Add User" form: username, email, password, role selector
- Per-row: "Reset Password" (modal, new password field), "Delete" (confirmation dialog)

**Shared Library tab**
- Grid of shared books with word count
- "Upload Shared Book" button — same PDF upload flow, `is_shared` set TRUE immediately
- Per-card: "Unshare" button — sets `is_shared = FALSE`, book returns to admin's private library

**All Books tab**
- Table: title, owner username, word count, shared status, created date
- Per-row: Share/Unshare toggle, Delete button

### Auth flow in React
`App.jsx` calls `GET /api/auth/me` on mount:
- Loading → blank screen (no flash)
- 401 → render `<LoginScreen />`
- 200 → render library/reader as today, with `user` in context

---

## Infrastructure & Deployment

### Docker (backend only)
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

`client/dist` is NOT baked in — Express no longer serves static files.

### Cloudflare Pages setup
1. Connect GitHub repo in CF Pages dashboard
2. Build command: `npm --prefix client run build`
3. Output directory: `client/dist`
4. Environment variable: `VITE_API_URL=https://<your-app>.fly.dev`
5. Every push to `main` auto-deploys

### Fly.io setup
`fly.toml`:
```toml
[build]
[http_service]
  internal_port = 3000
  force_https = true
  [[http_service.concurrency]]
    type = "connections"
    hard_limit = 25
    soft_limit = 20

[[vm]]
  size = "shared-cpu-1x"
  memory = "256mb"
```

Secrets (set via `fly secrets set KEY=value`):
```
JWT_SECRET          — random 64-char string
DATABASE_URL        — Neon connection string (with ?sslmode=require)
R2_ACCOUNT_ID       — Cloudflare account ID
R2_ACCESS_KEY_ID    — R2 API token key ID
R2_SECRET_ACCESS_KEY — R2 API token secret
R2_BUCKET           — bucket name
CORS_ORIGIN         — https://<your-app>.pages.dev
```

### Neon setup
1. Create project at neon.tech
2. Copy connection string → `fly secrets set DATABASE_URL=...`
3. Run migrations: `fly ssh console -C "node scripts/migrate.js"`
4. Run seed: `fly ssh console -C "node scripts/seed.js"` (with ADMIN_* secrets set)
5. Remove `ADMIN_PASSWORD` secret after seeding

### CORS
Express configured to allow only `CORS_ORIGIN`. Credentials allowed (`credentials: true` in cors config, matching `credentials: 'include'` in all client fetch calls).

---

## New npm Dependencies

### Backend
- `pg` — PostgreSQL client
- `helmet` — security headers
- `express-rate-limit` — login brute force protection
- `@aws-sdk/client-s3` — R2 file storage
- `@aws-sdk/s3-request-presigner` — (if presigned URLs needed later)

### Removed
- `fs` usage for book/meta/cache storage (replaced by pg + R2)

### Frontend
No new dependencies. `VITE_API_URL` replaces the hardcoded `/api` base.

---

## Migration from Current Version

Existing local data (uploads/, cache/ directories) is not migrated. Books will need to be re-uploaded after launch. Given the current user base is one person, this is acceptable.

---

## Out of Scope

- Email-based password reset (admin resets via panel)
- OAuth / social login
- Public book sharing via link
- Reading analytics / stats
- Book chapters or position bookmarks
- Subscription or payment tiers
