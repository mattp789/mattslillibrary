# Infrastructure & Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Containerize the Express backend, deploy it to Fly.io, and deploy the React frontend to Cloudflare Pages.

**Architecture:** The backend is packaged as a Docker image (node:20-alpine) and deployed to Fly.io. Express no longer serves static files — that responsibility moves to Cloudflare Pages, which builds the React SPA from the GitHub repo on every push to `main`. The client uses `VITE_API_URL` (set in CF Pages dashboard) to reach the Fly.io backend. CORS on the backend allows only the Pages domain.

**Prerequisites:** Plans 1, 2, and 3 must be complete. You need:
- A [fly.io](https://fly.io) account with `flyctl` CLI installed
- A [Cloudflare](https://cloudflare.com) account
- A [Neon.tech](https://neon.tech) project with the connection string
- A [Cloudflare R2](https://developers.cloudflare.com/r2/) bucket with API token

**Tech Stack:** Docker, fly.toml, Cloudflare Pages, GitHub Actions (optional)

---

## File Structure

| Action | Path | Responsibility |
|---|---|---|
| Create | `Dockerfile` | Build image for Express backend |
| Create | `.dockerignore` | Exclude node_modules, client/src, etc. |
| Create | `fly.toml` | Fly.io app config |
| Modify | `client/vite.config.js` | Ensure proxy still works in dev with new api base |

---

### Task 1: Create .dockerignore and Dockerfile

**Files:**
- Create: `.dockerignore`
- Create: `Dockerfile`

- [ ] **Step 1: Create .dockerignore**

```
node_modules
client/node_modules
client/src
client/public
client/index.html
client/vite.config.js
uploads
cache
.env
.git
*.md
docs
tests
```

- [ ] **Step 2: Create Dockerfile**

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install production deps only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy server source
COPY server.js ./
COPY lib/ ./lib/
COPY middleware/ ./middleware/
COPY routes/ ./routes/
COPY scripts/ ./scripts/

EXPOSE 3000

CMD ["node", "server.js"]
```

The client is NOT baked into the image — Cloudflare Pages builds and serves it separately.

- [ ] **Step 3: Build the image locally to verify it works**

```bash
docker build -t rsvp-reader-api .
```

Expected: Build succeeds, image tagged `rsvp-reader-api`.

- [ ] **Step 4: Run container locally to verify startup**

```bash
docker run --rm \
  -e DATABASE_URL="postgresql://localhost/test" \
  -e JWT_SECRET="test-secret" \
  -e CORS_ORIGIN="http://localhost:5173" \
  -e NODE_ENV="production" \
  -p 3000:3000 \
  rsvp-reader-api
```

Expected: `Server running at http://0.0.0.0:3000`

The server will fail to connect to Neon (test URL), but the startup log confirms the image is good. Stop with Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add Dockerfile .dockerignore
git commit -m "feat: add Dockerfile for Express backend"
```

---

### Task 2: Create fly.toml and deploy to Fly.io

**Files:**
- Create: `fly.toml`

- [ ] **Step 1: Install flyctl (if not already installed)**

Windows (PowerShell):
```powershell
iwr https://fly.io/install.ps1 -useb | iex
```

macOS/Linux:
```bash
curl -L https://fly.io/install.sh | sh
```

- [ ] **Step 2: Log in to Fly.io**

```bash
flyctl auth login
```

Opens a browser to authenticate.

- [ ] **Step 3: Create your Fly.io app**

```bash
flyctl apps create rsvp-reader-api
```

If that name is taken, pick a unique name like `rsvp-api-yourname`. Note the app name — you'll use it in the next step.

- [ ] **Step 4: Create fly.toml**

Replace `rsvp-reader-api` with your actual app name if different:

```toml
app = "rsvp-reader-api"
primary_region = "iad"

[build]

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0

  [[http_service.checks]]
    grace_period = "10s"
    interval = "30s"
    method = "GET"
    path = "/api/auth/me"
    timeout = "5s"

[[vm]]
  size = "shared-cpu-1x"
  memory = "256mb"
```

- [ ] **Step 5: Set all secrets on Fly.io**

Run each command with your real values:

```bash
flyctl secrets set JWT_SECRET="paste-64-random-chars-here"
flyctl secrets set DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
flyctl secrets set R2_ACCOUNT_ID="your-cloudflare-account-id"
flyctl secrets set R2_ACCESS_KEY_ID="your-r2-key-id"
flyctl secrets set R2_SECRET_ACCESS_KEY="your-r2-secret"
flyctl secrets set R2_BUCKET="rsvp-reader"
flyctl secrets set CORS_ORIGIN="https://your-app.pages.dev"
```

To generate a strong JWT_SECRET:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

- [ ] **Step 6: Run database migration on Fly.io**

The Neon database is empty — run the migration script once before the first deploy:

```bash
# Set env vars temporarily for the migration script
export DATABASE_URL="your-neon-connection-string"
npm run migrate
```

Expected: `Migration complete`

- [ ] **Step 7: Seed your admin account**

```bash
export DATABASE_URL="your-neon-connection-string"
export ADMIN_EMAIL="you@example.com"
export ADMIN_USERNAME="admin"
export ADMIN_PASSWORD="choose-a-strong-password"
npm run seed
```

Expected: `Admin admin created`

- [ ] **Step 8: Deploy to Fly.io**

```bash
flyctl deploy
```

Fly.io builds the Docker image and deploys it. First deploy takes ~2 minutes.

Expected output ends with:
```
==> Monitoring deployment
 1 desired, 1 placed, 1 healthy, 0 unhealthy
```

- [ ] **Step 9: Verify the backend is live**

```bash
# Replace with your actual app name
curl -s https://rsvp-reader-api.fly.dev/api/auth/me
```

Expected: `{"error":"Unauthorized"}` — correct, the backend is running.

- [ ] **Step 10: Commit**

```bash
git add fly.toml
git commit -m "feat: add fly.toml for Fly.io deployment"
```

---

### Task 3: Update vite.config.js for production API URL

**Files:**
- Modify: `client/vite.config.js`

In development, Vite's proxy forwards `/api` to Express on port 3000. In production (Cloudflare Pages), there is no proxy — the client uses `VITE_API_URL` directly. Confirm the current vite.config.js proxy is set up, and verify the dev flow still works.

- [ ] **Step 1: Read the current vite.config.js**

Read `client/vite.config.js` to see its current contents.

- [ ] **Step 2: Confirm proxy is in place**

The file should contain a `server.proxy` block like this:

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
```

If it's missing the proxy block, add it. The proxy only applies in dev — in production the built files go to Cloudflare Pages where `VITE_API_URL` is baked in at build time.

- [ ] **Step 3: Verify dev mode still works end-to-end**

Start the backend and client dev servers together:

```bash
npm run dev
```

Open `http://localhost:5173`. Log in with your admin credentials. Verify books can be uploaded (requires real R2 + Neon in your `.env`).

- [ ] **Step 4: Commit if vite.config.js was changed**

```bash
git add client/vite.config.js
git commit -m "chore: confirm vite proxy config for dev"
```

---

### Task 4: Deploy frontend to Cloudflare Pages

No files to commit — this is entirely dashboard configuration.

- [ ] **Step 1: Push current code to GitHub**

```bash
git push origin main
```

If you don't have a GitHub remote yet:
```bash
gh repo create rsvp-reader --private --source=. --push
```

- [ ] **Step 2: Create a Cloudflare Pages project**

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → Workers & Pages → Create application → Pages
2. Click "Connect to Git" and select your GitHub repo
3. Set build settings:
   - **Framework preset:** None
   - **Build command:** `npm --prefix client run build`
   - **Build output directory:** `client/dist`
4. Under **Environment variables**, add:
   - `VITE_API_URL` = `https://rsvp-reader-api.fly.dev` (your actual Fly.io URL)
5. Click "Save and Deploy"

Expected: CF Pages builds and deploys. First deploy takes ~1 minute.

- [ ] **Step 3: Update CORS_ORIGIN on Fly.io**

Once CF Pages gives you a `.pages.dev` URL, update the backend CORS config:

```bash
flyctl secrets set CORS_ORIGIN="https://your-app.pages.dev"
flyctl deploy
```

- [ ] **Step 4: End-to-end smoke test from the Pages URL**

Open your `https://your-app.pages.dev` URL in a browser (or on your phone).

Verify:
1. Login screen appears
2. Log in with admin credentials — library loads
3. Upload a PDF — book appears in library
4. Click Read — reader opens, RSVP plays
5. Progress saves — navigate away and back, position is restored
6. On a second device (phone), open the same URL, log in — library is there
7. Open the Admin panel — Users tab shows your account

- [ ] **Step 5: Create a friend's account**

In the Admin panel:
1. Click "Add User" — enter your friend's username, email, temporary password
2. Send them the Pages URL and their credentials
3. They log in and can upload and read their own books

---

### Task 5: Set up automatic deploys (optional)

Every push to `main` automatically redeploys Cloudflare Pages (this is built-in). For Fly.io auto-deploy on push, add a GitHub Actions workflow.

- [ ] **Step 1: Create .github/workflows/fly-deploy.yml**

```bash
mkdir -p .github/workflows
```

```yaml
# .github/workflows/fly-deploy.yml
name: Deploy to Fly.io

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

- [ ] **Step 2: Add your Fly.io API token to GitHub**

```bash
flyctl tokens create deploy -x 999999h
```

Copy the output token. In GitHub: repo → Settings → Secrets → Actions → New repository secret:
- Name: `FLY_API_TOKEN`
- Value: paste the token

- [ ] **Step 3: Test by pushing a trivial commit**

```bash
git add .github/
git commit -m "ci: auto-deploy backend to Fly.io on push to main"
git push origin main
```

Watch GitHub Actions — the deploy job should succeed.

---

## Reference: Cost Summary

| Service | Usage | Monthly Cost |
|---|---|---|
| Cloudflare Pages | SPA hosting | $0 |
| Cloudflare R2 | Up to 10 GB storage, unlimited egress | $0 |
| Fly.io compute | 1 shared-cpu-1x 256MB machine | $0 (free allowance) |
| Neon PostgreSQL | Up to 512 MB database | $0 (free tier) |
| **Total** | | **$0** |

## Reference: Updating the app

**Backend change:** `flyctl deploy` (or push to main if CI is set up)

**Frontend change:** Push to main — Cloudflare Pages auto-rebuilds

**Database schema change:** Run `npm run migrate` locally (pointing at Neon) then deploy

**Reset a user's password:** Log in as admin → Admin panel → Users tab → Reset PW
