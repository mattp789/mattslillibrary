# Backend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace filesystem storage with Neon PostgreSQL + Cloudflare R2, add JWT authentication, and make all book routes user-scoped.

**Architecture:** Express routes gain a `requireAuth` middleware that verifies a JWT httpOnly cookie. `lib/storage.js` is rewritten to use a `pg` pool (Neon) for metadata and `@aws-sdk/client-s3` (R2) for file blobs. `lib/extract.js` is updated to accept a buffer instead of a file path so multer can use memory storage and pipe bytes directly to R2.

**Tech Stack:** pg, bcryptjs, jsonwebtoken, cookie-parser, helmet, express-rate-limit, @aws-sdk/client-s3, dotenv

---

## File Structure

| Action | Path | Responsibility |
|---|---|---|
| Create | `lib/db.js` | pg connection pool singleton |
| Create | `lib/r2.js` | R2 upload / download / delete |
| Create | `middleware/auth.js` | requireAuth, requireAdmin |
| Create | `routes/auth.js` | POST /login, POST /logout, GET /me |
| Create | `routes/admin.js` | User + book admin endpoints |
| Create | `scripts/migrate.js` | CREATE TABLE DDL |
| Create | `scripts/seed.js` | Insert first admin user |
| Create | `.env.example` | Template for local dev env vars |
| Modify | `lib/extract.js` | Accept buffer instead of file path |
| Modify | `lib/storage.js` | Full rewrite — async, pg + R2 |
| Modify | `routes/books.js` | Add requireAuth, async storage, memory upload |
| Modify | `server.js` | helmet, cookie-parser, rate-limit, updated cors, new routes |
| Modify | `package.json` | New deps + migrate/seed scripts |
| Rewrite | `tests/books.test.js` | Async mocks + JWT cookie in requests |
| Create | `tests/auth.test.js` | Auth route tests |
| Create | `tests/admin.test.js` | Admin route tests |

---

### Task 1: Install dependencies and add scripts to package.json

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime dependencies**

```bash
npm install pg bcryptjs jsonwebtoken cookie-parser helmet express-rate-limit @aws-sdk/client-s3 dotenv
```

Expected: packages added to node_modules and package.json dependencies section.

- [ ] **Step 2: Add scripts to package.json**

Open `package.json` and add two entries to the `"scripts"` block:

```json
{
  "scripts": {
    "dev": "concurrently \"npm run server:dev\" \"npm run client:dev\"",
    "server:dev": "node --watch server.js",
    "client:dev": "npm --prefix client run dev",
    "build": "npm --prefix client run build",
    "start": "cross-env NODE_ENV=production node server.js",
    "migrate": "node scripts/migrate.js",
    "seed": "node scripts/seed.js",
    "test:server": "jest --testPathPattern=tests/",
    "test:client": "npm --prefix client run test"
  }
}
```

- [ ] **Step 3: Create `.env.example`**

Create `.env.example` at the repo root:

```
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
JWT_SECRET=replace-with-64-random-chars
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-token-key-id
R2_SECRET_ACCESS_KEY=your-r2-token-secret
R2_BUCKET=rsvp-reader
CORS_ORIGIN=http://localhost:5173
```

- [ ] **Step 4: Create `.env` locally (not committed)**

Copy `.env.example` to `.env` and fill in real values for local dev. Verify `.env` is in `.gitignore` — add it if not:

```bash
echo ".env" >> .gitignore
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .env.example .gitignore
git commit -m "chore: add pg, auth, R2, helmet dependencies"
```

---

### Task 2: Create lib/db.js and lib/r2.js

**Files:**
- Create: `lib/db.js`
- Create: `lib/r2.js`

- [ ] **Step 1: Write failing test for db export**

Create `tests/db.test.js`:

```js
describe('lib/db', () => {
  test('exports a pool with a query function', () => {
    process.env.DATABASE_URL = 'postgresql://localhost/test';
    const pool = require('../lib/db');
    expect(typeof pool.query).toBe('function');
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm run test:server -- --testPathPattern=tests/db
```

Expected: FAIL — "Cannot find module '../lib/db'"

- [ ] **Step 3: Create lib/db.js**

```js
// lib/db.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

module.exports = pool;
```

- [ ] **Step 4: Run db test**

```bash
npm run test:server -- --testPathPattern=tests/db
```

Expected: PASS

- [ ] **Step 5: Create lib/r2.js**

```js
// lib/r2.js
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.R2_BUCKET;

async function upload(key, buffer, contentType) {
  await client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));
}

async function download(key) {
  const res = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const chunks = [];
  for await (const chunk of res.Body) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function remove(key) {
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

module.exports = { upload, download, remove };
```

- [ ] **Step 6: Delete tests/db.test.js** (it was a scaffold test, not needed long term)

```bash
git rm tests/db.test.js
```

- [ ] **Step 7: Commit**

```bash
git add lib/db.js lib/r2.js
git commit -m "feat: add pg pool and R2 client"
```

---

### Task 3: Create scripts/migrate.js and scripts/seed.js

**Files:**
- Create: `scripts/migrate.js`
- Create: `scripts/seed.js`

- [ ] **Step 1: Create scripts/ directory and migrate.js**

```bash
mkdir -p scripts
```

Create `scripts/migrate.js`:

```js
// scripts/migrate.js
require('dotenv').config();
const pool = require('../lib/db');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email         TEXT UNIQUE NOT NULL,
        username      TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role          TEXT NOT NULL DEFAULT 'user',
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT role_check CHECK (role IN ('user', 'admin'))
      );

      CREATE TABLE IF NOT EXISTS books (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        is_shared   BOOLEAN NOT NULL DEFAULT FALSE,
        title       TEXT NOT NULL,
        word_count  INTEGER NOT NULL DEFAULT 0,
        has_warning BOOLEAN NOT NULL DEFAULT FALSE,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS progress (
        user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        book_id     UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        word_index  INTEGER NOT NULL DEFAULT 0,
        wpm         INTEGER NOT NULL DEFAULT 300,
        updated_at  TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (user_id, book_id)
      );

      CREATE INDEX IF NOT EXISTS books_owner_idx  ON books(owner_id);
      CREATE INDEX IF NOT EXISTS books_shared_idx ON books(is_shared);
      CREATE INDEX IF NOT EXISTS progress_user_idx ON progress(user_id);
    `);
    console.log('Migration complete');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Create scripts/seed.js**

```js
// scripts/seed.js
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../lib/db');

async function seed() {
  const { ADMIN_EMAIL, ADMIN_USERNAME, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_USERNAME || !ADMIN_PASSWORD) {
    console.error('Set ADMIN_EMAIL, ADMIN_USERNAME, ADMIN_PASSWORD env vars before seeding');
    process.exit(1);
  }
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const { rowCount } = await pool.query(
    `INSERT INTO users (email, username, password_hash, role)
     VALUES ($1, $2, $3, 'admin')
     ON CONFLICT (email) DO NOTHING`,
    [ADMIN_EMAIL, ADMIN_USERNAME, hash]
  );
  console.log(rowCount ? `Admin ${ADMIN_USERNAME} created` : 'Admin already exists');
  await pool.end();
}

seed().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 3: Run migrate against your Neon database**

```bash
npm run migrate
```

Expected output: `Migration complete`

If you get a connection error, double-check `DATABASE_URL` in `.env` matches the Neon connection string exactly (must include `?sslmode=require`).

- [ ] **Step 4: Run seed to create your admin account**

Add to `.env` temporarily:
```
ADMIN_EMAIL=you@example.com
ADMIN_USERNAME=admin
ADMIN_PASSWORD=choose-a-strong-password
```

```bash
npm run seed
```

Expected: `Admin admin created`

Remove `ADMIN_EMAIL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` from `.env` after seeding.

- [ ] **Step 5: Commit**

```bash
git add scripts/
git commit -m "feat: add migrate and seed scripts"
```

---

### Task 4: Update lib/extract.js to accept a buffer

**Files:**
- Modify: `lib/extract.js`

The current `extractWords(pdfFilePath)` reads from disk. Changing to `extractWords(buffer)` so multer can use memory storage and hand bytes straight to this function and to R2, with no temp files on the server.

- [ ] **Step 1: Verify existing extract tests still pass before touching anything**

```bash
npm run test:server -- --testPathPattern=tests/extract
```

Expected: PASS (3 describe blocks, all pass)

- [ ] **Step 2: Update lib/extract.js**

Replace the entire file:

```js
// lib/extract.js

async function extractRawText(buffer) {
  const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
  pdfjsLib.GlobalWorkerOptions.workerSrc = false;
  const data = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({ data }).promise;
  let text = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(item => item.str).join(' ') + '\n';
  }
  return text;
}

function cleanText(rawText) {
  return rawText
    .replace(/(\w)-\n(\w)/g, '$1$2')
    .replace(/^\s*\d+\s*$/gm, '')
    .trim();
}

function textToWords(text) {
  return text
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length > 0);
}

function enrichText(words) {
  return words;
}

async function extractWords(buffer) {
  const raw = await extractRawText(buffer);
  const cleaned = cleanText(raw);
  const words = textToWords(cleaned);
  return enrichText(words);
}

module.exports = { extractWords, cleanText, enrichText, textToWords };
```

- [ ] **Step 3: Run extract tests — they must still pass**

```bash
npm run test:server -- --testPathPattern=tests/extract
```

Expected: PASS — `cleanText`, `textToWords`, `enrichText` tests are unchanged and pass.

- [ ] **Step 4: Commit**

```bash
git add lib/extract.js
git commit -m "feat: extractWords accepts buffer instead of file path"
```

---

### Task 5: Rewrite lib/storage.js

**Files:**
- Modify: `lib/storage.js`

Replace the synchronous filesystem implementation with async pg + R2 calls.

- [ ] **Step 1: Replace lib/storage.js entirely**

```js
// lib/storage.js
const db = require('./db');
const r2 = require('./r2');

async function listBooks(userId) {
  const { rows } = await db.query(
    `SELECT b.id, b.title,
            b.word_count  AS "wordCount",
            b.has_warning AS "hasWarning",
            b.is_shared   AS "isShared",
            b.created_at  AS "createdAt",
            (b.owner_id = $1)          AS "isOwner",
            COALESCE(p.word_index, 0)  AS progress,
            COALESCE(p.wpm, 300)       AS "savedWpm"
     FROM books b
     LEFT JOIN progress p ON p.book_id = b.id AND p.user_id = $1
     WHERE b.owner_id = $1 OR b.is_shared = TRUE
     ORDER BY b.created_at DESC`,
    [userId]
  );
  return rows;
}

async function saveBook(ownerId, { id, title, wordCount, hasWarning }) {
  const { rows } = await db.query(
    `INSERT INTO books (id, owner_id, title, word_count, has_warning)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, title,
               word_count  AS "wordCount",
               has_warning AS "hasWarning",
               is_shared   AS "isShared",
               created_at  AS "createdAt"`,
    [id, ownerId, title, wordCount, hasWarning]
  );
  return rows[0];
}

async function getBook(id) {
  const { rows } = await db.query('SELECT * FROM books WHERE id = $1', [id]);
  return rows[0] || null;
}

async function canAccessBook(userId, bookId) {
  const { rows } = await db.query(
    'SELECT 1 FROM books WHERE id = $1 AND (owner_id = $2 OR is_shared = TRUE)',
    [bookId, userId]
  );
  return rows.length > 0;
}

async function isOwner(userId, bookId) {
  const { rows } = await db.query(
    'SELECT 1 FROM books WHERE id = $1 AND owner_id = $2',
    [bookId, userId]
  );
  return rows.length > 0;
}

async function deleteBook(id) {
  await db.query('DELETE FROM books WHERE id = $1', [id]);
  await Promise.allSettled([
    r2.remove(`pdfs/${id}.pdf`),
    r2.remove(`cache/${id}.json`),
  ]);
}

async function saveWords(id, words) {
  await r2.upload(`cache/${id}.json`, Buffer.from(JSON.stringify(words)), 'application/json');
}

async function readWords(id) {
  try {
    const buf = await r2.download(`cache/${id}.json`);
    return JSON.parse(buf.toString());
  } catch {
    return null;
  }
}

async function uploadPdf(id, buffer) {
  await r2.upload(`pdfs/${id}.pdf`, buffer, 'application/pdf');
}

async function saveProgress(userId, bookId, wordIndex, wpm) {
  await db.query(
    `INSERT INTO progress (user_id, book_id, word_index, wpm, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (user_id, book_id) DO UPDATE
     SET word_index = $3, wpm = $4, updated_at = NOW()`,
    [userId, bookId, wordIndex, wpm]
  );
}

async function getProgress(userId, bookId) {
  const { rows } = await db.query(
    'SELECT word_index AS "wordIndex", wpm FROM progress WHERE user_id = $1 AND book_id = $2',
    [userId, bookId]
  );
  return rows[0] || { wordIndex: 0, wpm: 300 };
}

module.exports = {
  listBooks, saveBook, getBook, canAccessBook, isOwner,
  deleteBook, saveWords, readWords, uploadPdf,
  saveProgress, getProgress,
};
```

- [ ] **Step 2: Commit**

```bash
git add lib/storage.js
git commit -m "feat: rewrite storage to use pg + R2"
```

---

### Task 6: Create middleware/auth.js

**Files:**
- Create: `middleware/auth.js`

- [ ] **Step 1: Write failing test**

Create `tests/auth-middleware.test.js`:

```js
process.env.JWT_SECRET = 'test-secret';
const jwt = require('jsonwebtoken');
const { requireAuth, requireAdmin } = require('../middleware/auth');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('requireAuth', () => {
  test('calls next() with valid token cookie', () => {
    const token = jwt.sign({ sub: 'u1', role: 'user' }, 'test-secret');
    const req = { cookies: { token } };
    const res = mockRes();
    const next = jest.fn();
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user.sub).toBe('u1');
  });

  test('returns 401 with no cookie', () => {
    const req = { cookies: {} };
    const res = mockRes();
    requireAuth(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('returns 401 with invalid token', () => {
    const req = { cookies: { token: 'bad-token' } };
    const res = mockRes();
    requireAuth(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('requireAdmin', () => {
  test('calls next() for admin role', () => {
    const token = jwt.sign({ sub: 'u1', role: 'admin' }, 'test-secret');
    const req = { cookies: { token } };
    const res = mockRes();
    const next = jest.fn();
    requireAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('returns 403 for user role', () => {
    const token = jwt.sign({ sub: 'u1', role: 'user' }, 'test-secret');
    const req = { cookies: { token } };
    const res = mockRes();
    requireAdmin(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm run test:server -- --testPathPattern=tests/auth-middleware
```

Expected: FAIL — "Cannot find module '../middleware/auth'"

- [ ] **Step 3: Create middleware/auth.js**

```bash
mkdir -p middleware
```

```js
// middleware/auth.js
const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    next();
  });
}

module.exports = { requireAuth, requireAdmin };
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npm run test:server -- --testPathPattern=tests/auth-middleware
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add middleware/auth.js tests/auth-middleware.test.js
git commit -m "feat: add requireAuth and requireAdmin middleware"
```

---

### Task 7: Create routes/auth.js and tests/auth.test.js

**Files:**
- Create: `routes/auth.js`
- Create: `tests/auth.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/auth.test.js`:

```js
process.env.JWT_SECRET = 'test-secret';

jest.mock('../lib/db', () => ({ query: jest.fn() }));
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

const request = require('supertest');
const bcrypt = require('bcryptjs');
const db = require('../lib/db');
const app = require('../server');

const FAKE_USER = {
  id: 'user-1',
  email: 'test@example.com',
  username: 'testuser',
  password_hash: 'hashed',
  role: 'user',
};

describe('POST /api/auth/login', () => {
  test('returns 400 when email or password missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com' });
    expect(res.status).toBe(400);
  });

  test('returns 401 for unknown email', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'no@example.com', password: 'pw' });
    expect(res.status).toBe(401);
  });

  test('returns 401 for wrong password', async () => {
    db.query.mockResolvedValueOnce({ rows: [FAKE_USER] });
    bcrypt.compare.mockResolvedValueOnce(false);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  test('sets cookie and returns user on valid credentials', async () => {
    db.query.mockResolvedValueOnce({ rows: [FAKE_USER] });
    bcrypt.compare.mockResolvedValueOnce(true);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'correct' });
    expect(res.status).toBe(200);
    expect(res.body.username).toBe('testuser');
    expect(res.headers['set-cookie']).toBeDefined();
  });
});

describe('POST /api/auth/logout', () => {
  test('returns 204 and clears cookie', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(204);
    expect(res.headers['set-cookie']).toBeDefined();
  });
});

describe('GET /api/auth/me', () => {
  test('returns 401 without auth', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('returns user with valid token', async () => {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ sub: 'user-1', role: 'user' }, 'test-secret');
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'user-1', username: 'testuser', email: 'test@example.com', role: 'user' }],
    });
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', `token=${token}`);
    expect(res.status).toBe(200);
    expect(res.body.username).toBe('testuser');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test:server -- --testPathPattern=tests/auth.test
```

Expected: FAIL — "Cannot find module '../routes/auth'" (or similar)

- [ ] **Step 3: Create routes/auth.js**

```js
// routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../lib/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const COOKIE_NAME = 'token';
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
  res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
  res.json({ id: user.id, username: user.username, role: user.role });
});

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { ...COOKIE_OPTS, maxAge: 0 });
  res.status(204).end();
});

router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await db.query(
    'SELECT id, username, email, role FROM users WHERE id = $1',
    [req.user.sub]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

module.exports = router;
```

- [ ] **Step 4: Mount the route in server.js (temporary — full server.js update is Task 10)**

Add this line to `server.js` after the existing `app.use('/api/books', ...)` line:

```js
app.use('/api/auth', require('./routes/auth'));
```

Also add `cookie-parser` to server.js:

```js
const cookieParser = require('cookie-parser');
// ...
app.use(cookieParser());
```

Add both lines before the route registrations.

- [ ] **Step 5: Run auth tests**

```bash
npm run test:server -- --testPathPattern=tests/auth.test
```

Expected: PASS (6 tests)

- [ ] **Step 6: Commit**

```bash
git add routes/auth.js tests/auth.test.js server.js
git commit -m "feat: add auth routes (login, logout, me)"
```

---

### Task 8: Rewrite routes/books.js and update tests/books.test.js

**Files:**
- Modify: `routes/books.js`
- Modify: `tests/books.test.js`

- [ ] **Step 1: Rewrite tests/books.test.js**

Replace the entire file:

```js
// tests/books.test.js
process.env.JWT_SECRET = 'test-secret';

jest.mock('../lib/storage', () => ({
  listBooks: jest.fn(),
  saveBook: jest.fn(),
  getBook: jest.fn(),
  canAccessBook: jest.fn(),
  isOwner: jest.fn(),
  deleteBook: jest.fn(),
  saveWords: jest.fn(),
  readWords: jest.fn(),
  uploadPdf: jest.fn(),
  saveProgress: jest.fn(),
  getProgress: jest.fn(),
}));

jest.mock('../lib/db', () => ({ query: jest.fn() }));

jest.mock('../lib/extract', () => ({
  extractWords: jest.fn().mockResolvedValue(['hello', 'world', 'foo']),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const storage = require('../lib/storage');
const app = require('../server');

const USER_ID = 'user-1';
const userToken = jwt.sign({ sub: USER_ID, role: 'user' }, 'test-secret');
const authCookie = `token=${userToken}`;

beforeEach(() => jest.clearAllMocks());

describe('GET /api/books', () => {
  test('returns 401 without auth', async () => {
    const res = await request(app).get('/api/books');
    expect(res.status).toBe(401);
  });

  test('returns book list for authenticated user', async () => {
    storage.listBooks.mockResolvedValue([
      { id: 'abc', title: 'Test Book', wordCount: 3, hasWarning: false,
        isOwner: true, isShared: false, progress: 0, savedWpm: 300 },
    ]);
    const res = await request(app).get('/api/books').set('Cookie', authCookie);
    expect(res.status).toBe(200);
    expect(res.body[0].id).toBe('abc');
    expect(storage.listBooks).toHaveBeenCalledWith(USER_ID);
  });
});

describe('GET /api/books/:id/words', () => {
  test('returns 401 without auth', async () => {
    const res = await request(app).get('/api/books/abc/words');
    expect(res.status).toBe(401);
  });

  test('returns word array for accessible book', async () => {
    storage.canAccessBook.mockResolvedValue(true);
    storage.readWords.mockResolvedValue(['hello', 'world', 'foo']);
    const res = await request(app).get('/api/books/abc/words').set('Cookie', authCookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(['hello', 'world', 'foo']);
  });

  test('returns 404 for inaccessible book', async () => {
    storage.canAccessBook.mockResolvedValue(false);
    const res = await request(app).get('/api/books/unknown/words').set('Cookie', authCookie);
    expect(res.status).toBe(404);
  });

  test('returns 404 when words cache missing', async () => {
    storage.canAccessBook.mockResolvedValue(true);
    storage.readWords.mockResolvedValue(null);
    const res = await request(app).get('/api/books/abc/words').set('Cookie', authCookie);
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/books/:id/progress', () => {
  test('returns 401 without auth', async () => {
    const res = await request(app).put('/api/books/abc/progress').send({ index: 5 });
    expect(res.status).toBe(401);
  });

  test('saves progress for accessible book', async () => {
    storage.canAccessBook.mockResolvedValue(true);
    storage.saveProgress.mockResolvedValue();
    const res = await request(app)
      .put('/api/books/abc/progress')
      .set('Cookie', authCookie)
      .send({ index: 42, wpm: 350 });
    expect(res.status).toBe(204);
    expect(storage.saveProgress).toHaveBeenCalledWith(USER_ID, 'abc', 42, 350);
  });

  test('returns 400 when index missing', async () => {
    const res = await request(app)
      .put('/api/books/abc/progress')
      .set('Cookie', authCookie)
      .send({ wpm: 300 });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/books/:id', () => {
  test('returns 401 without auth', async () => {
    const res = await request(app).delete('/api/books/abc');
    expect(res.status).toBe(401);
  });

  test('returns 204 when owner deletes own book', async () => {
    storage.getBook.mockResolvedValue({ id: 'abc', owner_id: USER_ID });
    storage.isOwner.mockResolvedValue(true);
    storage.deleteBook.mockResolvedValue();
    const res = await request(app).delete('/api/books/abc').set('Cookie', authCookie);
    expect(res.status).toBe(204);
  });

  test('returns 403 when non-owner tries to delete', async () => {
    storage.getBook.mockResolvedValue({ id: 'abc', owner_id: 'someone-else' });
    storage.isOwner.mockResolvedValue(false);
    const res = await request(app).delete('/api/books/abc').set('Cookie', authCookie);
    expect(res.status).toBe(403);
  });

  test('returns 404 for unknown book', async () => {
    storage.getBook.mockResolvedValue(null);
    const res = await request(app).delete('/api/books/unknown').set('Cookie', authCookie);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test:server -- --testPathPattern=tests/books
```

Expected: FAIL — several failures because routes lack auth

- [ ] **Step 3: Rewrite routes/books.js**

```js
// routes/books.js
const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const storage = require('../lib/storage');
const { extractWords } = require('../lib/extract');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isPdf = file.mimetype === 'application/pdf' || file.originalname.endsWith('.pdf');
    cb(null, isPdf);
  },
});

router.use(requireAuth);

// GET /api/books
router.get('/', async (req, res) => {
  const books = await storage.listBooks(req.user.sub);
  res.json(books);
});

// POST /api/books
router.post('/', upload.single('pdf'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File must be a PDF' });

  const id = uuidv4();
  const title = path.basename(req.file.originalname, '.pdf');
  const buffer = req.file.buffer;

  let words = [];
  let hasWarning = false;

  try {
    words = await extractWords(buffer);
    if (words.length === 0) hasWarning = true;
  } catch (err) {
    console.error('PDF extraction failed:', err);
    hasWarning = true;
  }

  await storage.uploadPdf(id, buffer);

  if (words.length > 0) {
    await storage.saveWords(id, words);
  }

  const book = await storage.saveBook(req.user.sub, {
    id,
    title,
    wordCount: words.length,
    hasWarning,
  });

  res.status(201).json({ ...book, isOwner: true });
});

// GET /api/books/:id/words
router.get('/:id/words', async (req, res) => {
  const accessible = await storage.canAccessBook(req.user.sub, req.params.id);
  if (!accessible) return res.status(404).json({ error: 'Not found' });

  const words = await storage.readWords(req.params.id);
  if (!words) return res.status(404).json({ error: 'Not found' });

  res.json(words);
});

// PUT /api/books/:id/progress
router.put('/:id/progress', async (req, res) => {
  const { index, wpm } = req.body;
  if (typeof index !== 'number') return res.status(400).json({ error: 'index required' });

  const accessible = await storage.canAccessBook(req.user.sub, req.params.id);
  if (!accessible) return res.status(404).json({ error: 'Not found' });

  await storage.saveProgress(req.user.sub, req.params.id, index, wpm || 300);
  res.status(204).end();
});

// DELETE /api/books/:id
router.delete('/:id', async (req, res) => {
  const book = await storage.getBook(req.params.id);
  if (!book) return res.status(404).json({ error: 'Not found' });

  const owned = await storage.isOwner(req.user.sub, req.params.id);
  if (!owned && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

  await storage.deleteBook(req.params.id);
  res.status(204).end();
});

module.exports = router;
```

- [ ] **Step 4: Run tests**

```bash
npm run test:server -- --testPathPattern=tests/books
```

Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
git add routes/books.js tests/books.test.js
git commit -m "feat: user-scope books routes, memory upload, auth required"
```

---

### Task 9: Create routes/admin.js and tests/admin.test.js

**Files:**
- Create: `routes/admin.js`
- Create: `tests/admin.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/admin.test.js`:

```js
process.env.JWT_SECRET = 'test-secret';

jest.mock('../lib/db', () => ({ query: jest.fn() }));
jest.mock('../lib/storage', () => ({
  getBook: jest.fn(),
  deleteBook: jest.fn(),
}));
jest.mock('bcryptjs', () => ({ hash: jest.fn().mockResolvedValue('hashed') }));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('../lib/db');
const storage = require('../lib/storage');
const app = require('../server');

const adminToken = jwt.sign({ sub: 'admin-1', role: 'admin' }, 'test-secret');
const userToken  = jwt.sign({ sub: 'user-1',  role: 'user'  }, 'test-secret');
const adminCookie = `token=${adminToken}`;
const userCookie  = `token=${userToken}`;

beforeEach(() => jest.clearAllMocks());

describe('Admin routes — access control', () => {
  test('GET /api/admin/users returns 401 without auth', async () => {
    const res = await request(app).get('/api/admin/users');
    expect(res.status).toBe(401);
  });

  test('GET /api/admin/users returns 403 for non-admin', async () => {
    const res = await request(app).get('/api/admin/users').set('Cookie', userCookie);
    expect(res.status).toBe(403);
  });
});

describe('GET /api/admin/users', () => {
  test('returns user list for admin', async () => {
    db.query.mockResolvedValueOnce({ rows: [
      { id: 'u1', email: 'a@b.com', username: 'alice', role: 'user', createdAt: '2026-01-01' },
    ]});
    const res = await request(app).get('/api/admin/users').set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(res.body[0].username).toBe('alice');
  });
});

describe('POST /api/admin/users', () => {
  test('returns 400 when fields missing', async () => {
    const res = await request(app)
      .post('/api/admin/users')
      .set('Cookie', adminCookie)
      .send({ email: 'x@y.com' });
    expect(res.status).toBe(400);
  });

  test('creates user and returns 201', async () => {
    db.query.mockResolvedValueOnce({ rows: [
      { id: 'u2', email: 'b@c.com', username: 'bob', role: 'user', createdAt: '2026-01-01' },
    ]});
    const res = await request(app)
      .post('/api/admin/users')
      .set('Cookie', adminCookie)
      .send({ email: 'b@c.com', username: 'bob', password: 'pw123' });
    expect(res.status).toBe(201);
    expect(res.body.username).toBe('bob');
  });
});

describe('DELETE /api/admin/users/:id', () => {
  test('returns 400 when trying to delete own account', async () => {
    const res = await request(app)
      .delete('/api/admin/users/admin-1')
      .set('Cookie', adminCookie);
    expect(res.status).toBe(400);
  });

  test('deletes user and returns 204', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 'u1' }] }) // SELECT check
      .mockResolvedValueOnce({ rowCount: 1 });          // DELETE
    const res = await request(app)
      .delete('/api/admin/users/u1')
      .set('Cookie', adminCookie);
    expect(res.status).toBe(204);
  });
});

describe('PUT /api/admin/books/:id/share', () => {
  test('marks book shared', async () => {
    db.query.mockResolvedValueOnce({ rowCount: 1 });
    const res = await request(app)
      .put('/api/admin/books/book-1/share')
      .set('Cookie', adminCookie);
    expect(res.status).toBe(204);
  });

  test('returns 404 for unknown book', async () => {
    db.query.mockResolvedValueOnce({ rowCount: 0 });
    const res = await request(app)
      .put('/api/admin/books/bad-id/share')
      .set('Cookie', adminCookie);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test:server -- --testPathPattern=tests/admin
```

Expected: FAIL — "Cannot find module '../routes/admin'"

- [ ] **Step 3: Create routes/admin.js**

```js
// routes/admin.js
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../lib/db');
const storage = require('../lib/storage');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAdmin);

// GET /api/admin/users
router.get('/users', async (req, res) => {
  const { rows } = await db.query(
    `SELECT id, email, username, role, created_at AS "createdAt"
     FROM users ORDER BY created_at DESC`
  );
  res.json(rows);
});

// POST /api/admin/users
router.post('/users', async (req, res) => {
  const { email, username, password, role = 'user' } = req.body;
  if (!email || !username || !password) {
    return res.status(400).json({ error: 'email, username and password required' });
  }
  if (!['user', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'role must be user or admin' });
  }
  const hash = await bcrypt.hash(password, 12);
  try {
    const { rows } = await db.query(
      `INSERT INTO users (email, username, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, username, role, created_at AS "createdAt"`,
      [email, username, hash, role]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email or username already exists' });
    }
    throw err;
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', async (req, res) => {
  if (req.params.id === req.user.sub) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  const { rows } = await db.query('SELECT id FROM users WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  await db.query('DELETE FROM users WHERE id = $1', [req.params.id]);
  res.status(204).end();
});

// PUT /api/admin/users/:id/password
router.put('/users/:id/password', async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'password required' });
  const hash = await bcrypt.hash(password, 12);
  const { rowCount } = await db.query(
    'UPDATE users SET password_hash = $1 WHERE id = $2',
    [hash, req.params.id]
  );
  if (!rowCount) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

// GET /api/admin/books
router.get('/books', async (req, res) => {
  const { rows } = await db.query(
    `SELECT b.id, b.title,
            b.word_count  AS "wordCount",
            b.has_warning AS "hasWarning",
            b.is_shared   AS "isShared",
            b.created_at  AS "createdAt",
            u.username    AS "ownerUsername"
     FROM books b
     JOIN users u ON u.id = b.owner_id
     ORDER BY b.created_at DESC`
  );
  res.json(rows);
});

// DELETE /api/admin/books/:id
router.delete('/books/:id', async (req, res) => {
  const book = await storage.getBook(req.params.id);
  if (!book) return res.status(404).json({ error: 'Not found' });
  await storage.deleteBook(req.params.id);
  res.status(204).end();
});

// PUT /api/admin/books/:id/share
router.put('/books/:id/share', async (req, res) => {
  const { rowCount } = await db.query(
    'UPDATE books SET is_shared = TRUE WHERE id = $1',
    [req.params.id]
  );
  if (!rowCount) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

// DELETE /api/admin/books/:id/share
router.delete('/books/:id/share', async (req, res) => {
  const { rowCount } = await db.query(
    'UPDATE books SET is_shared = FALSE WHERE id = $1',
    [req.params.id]
  );
  if (!rowCount) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

module.exports = router;
```

- [ ] **Step 4: Run admin tests**

```bash
npm run test:server -- --testPathPattern=tests/admin
```

Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add routes/admin.js tests/admin.test.js
git commit -m "feat: add admin routes for user and book management"
```

---

### Task 10: Update server.js and run full test suite

**Files:**
- Modify: `server.js`

- [ ] **Step 1: Replace server.js entirely**

```js
// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts, try again later' },
});

app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', require('./routes/auth'));
app.use('/api/books', require('./routes/books'));
app.use('/api/admin', require('./routes/admin'));

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

module.exports = app;
```

Note: static file serving is removed — the frontend will be hosted on Cloudflare Pages.

- [ ] **Step 2: Run the full server test suite**

```bash
npm run test:server
```

Expected: All tests pass. If any fail, check that `process.env.JWT_SECRET` is set in each test file that needs it.

- [ ] **Step 3: Smoke-test the server locally**

```bash
npm run server:dev
```

Then in a second terminal:

```bash
# Should return 401 (auth required)
curl -s http://localhost:3000/api/books | jq .

# Login with your admin account
curl -s -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"your-admin-password"}' | jq .

# Should return your user info
curl -s -b cookies.txt http://localhost:3000/api/auth/me | jq .

# Should return empty array (no books yet)
curl -s -b cookies.txt http://localhost:3000/api/books | jq .
```

- [ ] **Step 4: Commit**

```bash
git add server.js
git commit -m "feat: finalize server with helmet, cors, rate-limit, all routes"
```
