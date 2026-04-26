# RSVP Speed Reader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-network RSVP speed reading web app — PDFs uploaded to a PC, text extracted server-side, word-by-word display with ORP highlighting accessible from a mobile browser.

**Architecture:** Express.js serves the React SPA as static files and exposes a REST API. PDFs are stored on the PC filesystem; extracted word arrays are cached as JSON. React manages all reader state via `useReducer`. In dev, Vite proxies `/api` to Express.

**Tech Stack:** Node.js + Express 4, multer, pdfjs-dist v3 (CommonJS), uuid; React 18 + Vite 5; Vitest + jsdom (client tests); Jest + Supertest (server tests); concurrently (dev startup).

---

## File Map

```
rsvp-reader/
├── package.json                      ← server deps + root scripts
├── server.js                         ← Express entry point
├── routes/
│   └── books.js                      ← /api/books route handlers
├── lib/
│   ├── extract.js                    ← PDF extraction + cleanText + enrichText
│   └── storage.js                    ← filesystem helpers (uploads/, cache/)
├── tests/
│   ├── extract.test.js               ← pure-function unit tests
│   └── books.test.js                 ← API route tests via supertest
├── uploads/                          ← gitignored — raw PDF files
├── cache/                            ← gitignored — word array JSON files
├── client/
│   ├── package.json
│   ├── vite.config.js                ← proxy + vitest config
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx                   ← screen routing (library ↔ reader)
│       ├── index.css                 ← dark theme + all styles
│       ├── api.js                    ← fetch wrappers for backend
│       ├── reducers/
│       │   └── readerReducer.js      ← reducer + initialState (exported for tests)
│       ├── screens/
│       │   ├── LibraryScreen.jsx
│       │   └── ReaderScreen.jsx
│       ├── components/
│       │   ├── BookCard.jsx
│       │   ├── ControlBar.jsx
│       │   ├── ORPDisplay.jsx
│       │   ├── ProgressBar.jsx
│       │   └── Toast.jsx
│       └── __tests__/
│           ├── ORPDisplay.test.js
│           └── readerReducer.test.js
└── .gitignore
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `server.js` (stub)
- Create: `client/` (via Vite CLI)
- Create: `.gitignore`

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "rsvp-reader",
  "version": "1.0.0",
  "scripts": {
    "dev": "concurrently \"npm run server:dev\" \"npm run client:dev\"",
    "server:dev": "node --watch server.js",
    "client:dev": "npm --prefix client run dev",
    "build": "npm --prefix client run build",
    "start": "cross-env NODE_ENV=production node server.js",
    "test:server": "jest --testPathPattern=tests/",
    "test:client": "npm --prefix client run test"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "multer": "^1.4.5-lts.1",
    "pdfjs-dist": "3.11.174",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "concurrently": "^8.2.2",
    "cross-env": "^7.0.3",
    "jest": "^29.7.0",
    "supertest": "^6.3.4"
  },
  "jest": {
    "testEnvironment": "node"
  }
}
```

- [ ] **Step 2: Install root dependencies**

```bash
cd /c/Users/matth/repos/rsvp-reader
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 3: Scaffold Vite React client**

```bash
cd /c/Users/matth/repos/rsvp-reader
npm create vite@latest client -- --template react
cd client && npm install
```

Expected: `client/src/` created with App.jsx, main.jsx, etc.

- [ ] **Step 4: Add client test dependencies**

```bash
cd /c/Users/matth/repos/rsvp-reader/client
npm install -D vitest @testing-library/react @testing-library/user-event jsdom @vitejs/plugin-react
```

- [ ] **Step 5: Replace client/vite.config.js**

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
```

- [ ] **Step 6: Add test script to client/package.json**

Open `client/package.json` and add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 7: Create stub server.js**

```js
const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/books', require('./routes/books'));

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/dist/index.html'));
  });
}

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
    console.log(`Local network: http://YOUR_PC_IP:${PORT}`);
  });
}

module.exports = app;
```

- [ ] **Step 8: Create stub routes/books.js**

```bash
mkdir -p /c/Users/matth/repos/rsvp-reader/routes
```

```js
// routes/books.js
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => res.json([]));

module.exports = router;
```

- [ ] **Step 9: Create .gitignore**

```
node_modules/
client/node_modules/
client/dist/
uploads/
cache/
*.log
```

- [ ] **Step 10: Create uploads and cache directories**

```bash
mkdir -p /c/Users/matth/repos/rsvp-reader/uploads
mkdir -p /c/Users/matth/repos/rsvp-reader/cache
touch /c/Users/matth/repos/rsvp-reader/uploads/.gitkeep
touch /c/Users/matth/repos/rsvp-reader/cache/.gitkeep
```

- [ ] **Step 11: Verify dev server starts**

```bash
cd /c/Users/matth/repos/rsvp-reader
npm run server:dev
```

Expected: `Server running at http://0.0.0.0:3001` printed.
Open browser to `http://localhost:3001/api/books` — should return `[]`.

- [ ] **Step 12: Commit**

```bash
cd /c/Users/matth/repos/rsvp-reader
git add .
git commit -m "chore: scaffold project"
```

---

## Task 2: Text Extraction Pipeline

**Files:**
- Create: `lib/extract.js`
- Create: `tests/extract.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/extract.test.js`:

```js
const { cleanText, textToWords, enrichText } = require('../lib/extract');

describe('cleanText', () => {
  test('rejoins hyphenated line breaks', () => {
    expect(cleanText('read-\ning')).toBe('reading');
  });

  test('strips standalone page numbers', () => {
    const input = 'Hello world\n42\nAnother paragraph';
    const result = cleanText(input);
    expect(result).toContain('Hello world');
    expect(result).toContain('Another paragraph');
    expect(result).not.toMatch(/\n42\n/);
  });

  test('strips leading/trailing whitespace', () => {
    expect(cleanText('  hello  ')).toBe('hello');
  });

  test('preserves normal text unchanged', () => {
    expect(cleanText('The quick brown fox')).toBe('The quick brown fox');
  });
});

describe('textToWords', () => {
  test('splits on whitespace', () => {
    expect(textToWords('hello world  foo')).toEqual(['hello', 'world', 'foo']);
  });

  test('filters empty tokens', () => {
    expect(textToWords('  \n  ')).toEqual([]);
  });

  test('trims individual words', () => {
    expect(textToWords('hello\nworld')).toEqual(['hello', 'world']);
  });
});

describe('enrichText', () => {
  test('is a passthrough no-op', () => {
    const words = ['a', 'b', 'c'];
    expect(enrichText(words)).toBe(words);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /c/Users/matth/repos/rsvp-reader
npx jest tests/extract.test.js
```

Expected: `Cannot find module '../lib/extract'`

- [ ] **Step 3: Create lib/extract.js**

```bash
mkdir -p /c/Users/matth/repos/rsvp-reader/lib
```

```js
// lib/extract.js
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
pdfjsLib.GlobalWorkerOptions.workerSrc = false;

async function extractRawText(pdfFilePath) {
  const fs = require('fs');
  const data = new Uint8Array(fs.readFileSync(pdfFilePath));
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
    .replace(/(\w)-\n(\w)/g, '$1$2')        // rejoin hyphenated line breaks
    .replace(/^\s*\d+\s*$/gm, '')           // strip standalone page numbers
    .trim();
}

function enrichText(words) {
  // No-op: hook for future AI enrichment pass
  return words;
}

function textToWords(text) {
  return text
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length > 0);
}

async function extractWords(pdfFilePath) {
  const raw = await extractRawText(pdfFilePath);
  const cleaned = cleanText(raw);
  const words = textToWords(cleaned);
  return enrichText(words);
}

module.exports = { extractWords, cleanText, enrichText, textToWords };
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest tests/extract.test.js
```

Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/extract.js tests/extract.test.js
git commit -m "feat: text extraction pipeline with cleanText"
```

---

## Task 3: Storage Helpers

**Files:**
- Create: `lib/storage.js`

- [ ] **Step 1: Create lib/storage.js**

```js
// lib/storage.js
const fs = require('fs');
const path = require('path');

const UPLOADS_DIR = path.join(__dirname, '../uploads');
const CACHE_DIR = path.join(__dirname, '../cache');

function ensureDirs() {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function metaPath(id) {
  return path.join(UPLOADS_DIR, `${id}.meta.json`);
}

function pdfPath(id) {
  return path.join(UPLOADS_DIR, `${id}.pdf`);
}

function cachePath(id) {
  return path.join(CACHE_DIR, `${id}.json`);
}

function listBooks() {
  ensureDirs();
  const files = fs.readdirSync(UPLOADS_DIR).filter(f => f.endsWith('.meta.json'));
  return files
    .map(f => {
      const id = f.replace('.meta.json', '');
      return JSON.parse(fs.readFileSync(metaPath(id), 'utf8'));
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

function saveBook(id, meta) {
  ensureDirs();
  fs.writeFileSync(metaPath(id), JSON.stringify(meta));
}

function getBook(id) {
  const p = metaPath(id);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function saveWords(id, words) {
  ensureDirs();
  fs.writeFileSync(cachePath(id), JSON.stringify(words));
}

function readWords(id) {
  const p = cachePath(id);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function deleteBook(id) {
  [metaPath(id), pdfPath(id), cachePath(id)].forEach(p => {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  });
}

module.exports = {
  ensureDirs,
  listBooks,
  saveBook,
  getBook,
  saveWords,
  readWords,
  deleteBook,
  pdfPath,
};
```

- [ ] **Step 2: Commit**

```bash
git add lib/storage.js
git commit -m "feat: filesystem storage helpers"
```

---

## Task 4: Express API Routes

**Files:**
- Modify: `routes/books.js`
- Create: `tests/books.test.js`

- [ ] **Step 1: Write failing API tests**

Create `tests/books.test.js`:

```js
const request = require('supertest');

// Mock storage and extract before requiring app
jest.mock('../lib/storage', () => ({
  ensureDirs: jest.fn(),
  listBooks: jest.fn().mockReturnValue([
    { id: 'abc', title: 'Test Book', wordCount: 3, hasWarning: false, createdAt: 1000 },
  ]),
  saveBook: jest.fn(),
  getBook: jest.fn((id) => id === 'abc'
    ? { id: 'abc', title: 'Test Book', wordCount: 3, hasWarning: false, createdAt: 1000 }
    : null),
  saveWords: jest.fn(),
  readWords: jest.fn((id) => id === 'abc' ? ['hello', 'world', 'foo'] : null),
  deleteBook: jest.fn(),
  pdfPath: jest.fn().mockReturnValue('/tmp/fake.pdf'),
}));

jest.mock('../lib/extract', () => ({
  extractWords: jest.fn().mockResolvedValue(['hello', 'world', 'foo']),
}));

const app = require('../server');

describe('GET /api/books', () => {
  test('returns list of books', async () => {
    const res = await request(app).get('/api/books');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: 'abc', title: 'Test Book', wordCount: 3, hasWarning: false, createdAt: 1000 },
    ]);
  });
});

describe('GET /api/books/:id/words', () => {
  test('returns word array for valid id', async () => {
    const res = await request(app).get('/api/books/abc/words');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(['hello', 'world', 'foo']);
  });

  test('returns 404 for unknown id', async () => {
    const res = await request(app).get('/api/books/unknown/words');
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/books/:id', () => {
  test('returns 204 for valid id', async () => {
    const res = await request(app).delete('/api/books/abc');
    expect(res.status).toBe(204);
  });

  test('returns 404 for unknown id', async () => {
    const res = await request(app).delete('/api/books/unknown');
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest tests/books.test.js
```

Expected: route tests fail (stub returns empty array, no 404 handling).

- [ ] **Step 3: Replace routes/books.js with full implementation**

```js
// routes/books.js
const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const storage = require('../lib/storage');
const { extractWords } = require('../lib/extract');

const router = express.Router();

const upload = multer({
  dest: path.join(__dirname, '../uploads'),
  fileFilter: (req, file, cb) => {
    const isPdf = file.mimetype === 'application/pdf' || file.originalname.endsWith('.pdf');
    cb(null, isPdf);
  },
});

// GET /api/books
router.get('/', (req, res) => {
  res.json(storage.listBooks());
});

// POST /api/books
router.post('/', upload.single('pdf'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'File must be a PDF' });
  }

  const id = uuidv4();
  const title = path.basename(req.file.originalname, '.pdf');
  const finalPath = storage.pdfPath(id);

  fs.renameSync(req.file.path, finalPath);

  let words = [];
  let hasWarning = false;

  try {
    words = await extractWords(finalPath);
    if (words.length === 0) hasWarning = true;
  } catch {
    hasWarning = true;
  }

  const meta = { id, title, wordCount: words.length, hasWarning, createdAt: Date.now() };
  storage.saveBook(id, meta);

  if (words.length > 0) {
    storage.saveWords(id, words);
  }

  res.status(201).json(meta);
});

// GET /api/books/:id/words
router.get('/:id/words', (req, res) => {
  const words = storage.readWords(req.params.id);
  if (!words) return res.status(404).json({ error: 'Not found' });
  res.json(words);
});

// DELETE /api/books/:id
router.delete('/:id', (req, res) => {
  const book = storage.getBook(req.params.id);
  if (!book) return res.status(404).json({ error: 'Not found' });
  storage.deleteBook(req.params.id);
  res.status(204).end();
});

module.exports = router;
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest tests/books.test.js
```

Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add routes/books.js tests/books.test.js
git commit -m "feat: Express API routes for books"
```

---

## Task 5: Frontend API Client

**Files:**
- Create: `client/src/api.js`
- Create: `client/src/__tests__/api.test.js`

- [ ] **Step 1: Create client/src/__tests__ directory**

```bash
mkdir -p /c/Users/matth/repos/rsvp-reader/client/src/__tests__
```

- [ ] **Step 2: Write failing test**

Create `client/src/__tests__/api.test.js`:

```js
import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => mockFetch.mockReset());

// Import after setting up mock
const { listBooks, uploadBook, getWords, deleteBook } = await import('../api.js');

describe('listBooks', () => {
  test('GET /api/books and returns JSON', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [{ id: '1' }] });
    const result = await listBooks();
    expect(mockFetch).toHaveBeenCalledWith('/api/books');
    expect(result).toEqual([{ id: '1' }]);
  });

  test('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    await expect(listBooks()).rejects.toThrow('Failed to fetch books');
  });
});

describe('getWords', () => {
  test('GET /api/books/:id/words', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ['hello', 'world'] });
    const result = await getWords('abc');
    expect(mockFetch).toHaveBeenCalledWith('/api/books/abc/words');
    expect(result).toEqual(['hello', 'world']);
  });
});

describe('deleteBook', () => {
  test('DELETE /api/books/:id', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    await deleteBook('abc');
    expect(mockFetch).toHaveBeenCalledWith('/api/books/abc', { method: 'DELETE' });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd /c/Users/matth/repos/rsvp-reader/client
npm test
```

Expected: `Cannot find module '../api.js'`

- [ ] **Step 4: Create client/src/api.js**

```js
// client/src/api.js
const BASE = '/api';

export async function listBooks() {
  const res = await fetch(`${BASE}/books`);
  if (!res.ok) throw new Error('Failed to fetch books');
  return res.json();
}

export async function uploadBook(file) {
  const fd = new FormData();
  fd.append('pdf', file);
  const res = await fetch(`${BASE}/books`, { method: 'POST', body: fd });
  if (!res.ok) throw new Error('Upload failed');
  return res.json();
}

export async function getWords(id) {
  const res = await fetch(`${BASE}/books/${id}/words`);
  if (!res.ok) throw new Error('Failed to load book');
  return res.json();
}

export async function deleteBook(id) {
  const res = await fetch(`${BASE}/books/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Delete failed');
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /c/Users/matth/repos/rsvp-reader/client
npm test
```

Expected: all 4 tests pass.

- [ ] **Step 6: Commit**

```bash
cd /c/Users/matth/repos/rsvp-reader
git add client/src/api.js client/src/__tests__/api.test.js
git commit -m "feat: frontend API client"
```

---

## Task 6: ORP Display Component

**Files:**
- Create: `client/src/components/ORPDisplay.jsx`
- Create: `client/src/__tests__/ORPDisplay.test.js`

- [ ] **Step 1: Write failing tests**

Create `client/src/__tests__/ORPDisplay.test.js`:

```js
import { describe, test, expect } from 'vitest';
import { getOrpIndex, splitWord } from '../components/ORPDisplay.jsx';

describe('getOrpIndex', () => {
  test('returns 0 for single character', () => {
    expect(getOrpIndex('a')).toBe(0);
  });

  test('returns floor(length * 0.35)', () => {
    expect(getOrpIndex('hi')).toBe(0);        // floor(2*0.35) = 0
    expect(getOrpIndex('cat')).toBe(1);        // floor(3*0.35) = 1
    expect(getOrpIndex('hello')).toBe(1);      // floor(5*0.35) = 1
    expect(getOrpIndex('reading')).toBe(2);    // floor(7*0.35) = 2
    expect(getOrpIndex('international')).toBe(4); // floor(13*0.35) = 4
  });
});

describe('splitWord', () => {
  test('splits single char: orp is the char, before/after empty', () => {
    expect(splitWord('a')).toEqual({ before: '', orp: 'a', after: '' });
  });

  test('splits "cat" at index 1', () => {
    expect(splitWord('cat')).toEqual({ before: 'c', orp: 'a', after: 't' });
  });

  test('splits "hello" at index 1', () => {
    expect(splitWord('hello')).toEqual({ before: 'h', orp: 'e', after: 'llo' });
  });

  test('splits "reading" at index 2', () => {
    expect(splitWord('reading')).toEqual({ before: 're', orp: 'a', after: 'ding' });
  });

  test('handles empty string gracefully', () => {
    const result = splitWord('');
    expect(result.orp).toBe('');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /c/Users/matth/repos/rsvp-reader/client
npm test
```

Expected: `Cannot find module '../components/ORPDisplay.jsx'`

- [ ] **Step 3: Create client/src/components/ORPDisplay.jsx**

```bash
mkdir -p /c/Users/matth/repos/rsvp-reader/client/src/components
```

```jsx
// client/src/components/ORPDisplay.jsx

export function getOrpIndex(word) {
  if (!word || word.length <= 1) return 0;
  return Math.floor(word.length * 0.35);
}

export function splitWord(word) {
  if (!word) return { before: '', orp: '', after: '' };
  const idx = getOrpIndex(word);
  return {
    before: word.slice(0, idx),
    orp: word[idx] ?? '',
    after: word.slice(idx + 1),
  };
}

const FONT_SIZES = { sm: '2rem', md: '3rem', lg: '4.5rem' };

export default function ORPDisplay({ word = '', fontSize = 'md' }) {
  const { before, orp, after } = splitWord(word);

  return (
    <div className="orp-wrapper" style={{ fontSize: FONT_SIZES[fontSize] || FONT_SIZES.md }}>
      <div className="guide-line" />
      <div className="word-row">
        <span className="orp-before">{before}</span>
        <span className="orp-letter">{orp}</span>
        <span className="orp-after">{after}</span>
      </div>
      <div className="guide-line" />
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /c/Users/matth/repos/rsvp-reader/client
npm test
```

Expected: all 7 ORP tests pass.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/matth/repos/rsvp-reader
git add client/src/components/ORPDisplay.jsx client/src/__tests__/ORPDisplay.test.js
git commit -m "feat: ORP display component"
```

---

## Task 7: Reader Reducer

**Files:**
- Create: `client/src/reducers/readerReducer.js`
- Create: `client/src/__tests__/readerReducer.test.js`

- [ ] **Step 1: Write failing tests**

Create `client/src/__tests__/readerReducer.test.js`:

```js
import { describe, test, expect } from 'vitest';
import { readerReducer, initialState } from '../reducers/readerReducer.js';

describe('readerReducer', () => {
  test('SET_WORDS resets index to 0 and stops playback', () => {
    const state = { ...initialState, index: 50, playing: true };
    const next = readerReducer(state, { type: 'SET_WORDS', words: ['a', 'b', 'c'] });
    expect(next.index).toBe(0);
    expect(next.playing).toBe(false);
    expect(next.words).toEqual(['a', 'b', 'c']);
  });

  test('PLAY sets playing to true', () => {
    expect(readerReducer(initialState, { type: 'PLAY' }).playing).toBe(true);
  });

  test('PAUSE sets playing to false', () => {
    const state = { ...initialState, playing: true };
    expect(readerReducer(state, { type: 'PAUSE' }).playing).toBe(false);
  });

  test('TICK increments index', () => {
    const state = { ...initialState, words: ['a', 'b', 'c'], index: 0, playing: true };
    expect(readerReducer(state, { type: 'TICK' }).index).toBe(1);
  });

  test('TICK at last word stops playback and keeps index', () => {
    const state = { ...initialState, words: ['a', 'b'], index: 1, playing: true };
    const next = readerReducer(state, { type: 'TICK' });
    expect(next.playing).toBe(false);
    expect(next.index).toBe(1);
  });

  test('SEEK sets index', () => {
    const state = { ...initialState, words: ['a', 'b', 'c'] };
    expect(readerReducer(state, { type: 'SEEK', index: 2 }).index).toBe(2);
  });

  test('SET_WPM clamps to 50-1000', () => {
    expect(readerReducer(initialState, { type: 'SET_WPM', wpm: 10 }).wpm).toBe(50);
    expect(readerReducer(initialState, { type: 'SET_WPM', wpm: 9999 }).wpm).toBe(1000);
    expect(readerReducer(initialState, { type: 'SET_WPM', wpm: 400 }).wpm).toBe(400);
  });

  test('SET_FONT_SIZE updates fontSize', () => {
    expect(readerReducer(initialState, { type: 'SET_FONT_SIZE', fontSize: 'lg' }).fontSize).toBe('lg');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /c/Users/matth/repos/rsvp-reader/client
npm test
```

Expected: `Cannot find module '../reducers/readerReducer.js'`

- [ ] **Step 3: Create client/src/reducers/readerReducer.js**

```bash
mkdir -p /c/Users/matth/repos/rsvp-reader/client/src/reducers
```

```js
// client/src/reducers/readerReducer.js

export const initialState = {
  words: [],
  index: 0,
  wpm: 300,
  playing: false,
  fontSize: 'md',
};

export function readerReducer(state, action) {
  switch (action.type) {
    case 'SET_WORDS':
      return { ...state, words: action.words, index: 0, playing: false };
    case 'PLAY':
      return { ...state, playing: true };
    case 'PAUSE':
      return { ...state, playing: false };
    case 'TICK':
      if (state.index >= state.words.length - 1) {
        return { ...state, playing: false };
      }
      return { ...state, index: state.index + 1 };
    case 'SEEK':
      return { ...state, index: action.index };
    case 'SET_WPM':
      return { ...state, wpm: Math.max(50, Math.min(1000, action.wpm)) };
    case 'SET_FONT_SIZE':
      return { ...state, fontSize: action.fontSize };
    default:
      return state;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /c/Users/matth/repos/rsvp-reader/client
npm test
```

Expected: all 8 reducer tests pass.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/matth/repos/rsvp-reader
git add client/src/reducers/readerReducer.js client/src/__tests__/readerReducer.test.js
git commit -m "feat: reader state reducer"
```

---

## Task 8: Dark Theme + App Skeleton

**Files:**
- Modify: `client/src/main.jsx`
- Modify: `client/src/App.jsx`
- Create: `client/src/index.css` (replace existing)

- [ ] **Step 1: Replace client/src/main.jsx**

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 2: Replace client/src/App.jsx**

```jsx
import { useState } from 'react';
import LibraryScreen from './screens/LibraryScreen.jsx';
import ReaderScreen from './screens/ReaderScreen.jsx';

export default function App() {
  const [currentBook, setCurrentBook] = useState(null);

  if (currentBook) {
    return <ReaderScreen book={currentBook} onBack={() => setCurrentBook(null)} />;
  }
  return <LibraryScreen onOpen={setCurrentBook} />;
}
```

- [ ] **Step 3: Replace client/src/index.css with dark theme**

```css
:root {
  --bg: #0f0f0f;
  --surface: #1a1a1a;
  --border: #2a2a2a;
  --text: #e0e0e0;
  --text-muted: rgba(224, 224, 224, 0.45);
  --accent: #f59e0b;
  --danger: #ef4444;
  --radius: 8px;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: var(--bg);
  color: var(--text);
  font-family: system-ui, -apple-system, sans-serif;
  min-height: 100dvh;
}

button { font-family: inherit; cursor: pointer; }

/* ── Library ── */
.library-screen {
  max-width: 860px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.library-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2rem;
}

.library-header h1 { font-size: 1.8rem; }

.upload-btn {
  display: inline-block;
  background: var(--accent);
  color: #000;
  padding: 0.6rem 1.2rem;
  border-radius: var(--radius);
  font-weight: 600;
  cursor: pointer;
  font-size: 0.95rem;
  border: none;
}

.upload-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.book-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1rem;
}

.book-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1rem;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.book-card.has-warning { border-color: #713f12; }

.warning-badge {
  position: absolute;
  top: 0.5rem;
  right: 0.75rem;
  color: var(--accent);
  font-size: 1rem;
}

.book-title {
  font-size: 0.95rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-right: 1.5rem;
}

.word-count {
  color: var(--text-muted);
  font-size: 0.8rem;
  flex: 1;
}

.warning-msg {
  font-size: 0.78rem;
  color: var(--accent);
  line-height: 1.4;
}

.book-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.book-actions button {
  flex: 1;
  padding: 0.45rem 0;
  border-radius: 5px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  font-size: 0.85rem;
}

.book-actions .btn-read {
  background: var(--accent);
  color: #000;
  border-color: var(--accent);
  font-weight: 600;
}

.book-actions button:disabled { opacity: 0.4; cursor: not-allowed; }

.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 4rem 2rem;
  color: var(--text-muted);
}

/* ── Toast ── */
.toast {
  position: fixed;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 0.75rem 1.5rem;
  border-radius: var(--radius);
  z-index: 999;
  white-space: nowrap;
  font-size: 0.9rem;
}

/* ── Reader ── */
.reader-screen {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  padding: 0.75rem 1rem;
}

.reader-top-bar {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.back-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 0.9rem;
  padding: 0;
}

.book-title-bar {
  font-size: 0.85rem;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.finished-badge {
  text-align: center;
  color: var(--accent);
  font-size: 0.85rem;
  font-weight: 600;
  padding: 0.25rem 0;
}

.orp-stage {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

/* ── ORP Display ── */
.orp-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

.guide-line {
  width: 2px;
  height: 0.55em;
  background: rgba(245, 158, 11, 0.3);
  border-radius: 1px;
}

.word-row {
  display: flex;
  align-items: baseline;
  width: 92vw;
  max-width: 960px;
  font-family: 'Courier New', 'Courier', monospace;
  font-weight: 700;
  line-height: 1;
}

.orp-before {
  flex: 1;
  text-align: right;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
}

.orp-letter {
  color: var(--accent);
  flex-shrink: 0;
  min-width: 0.6ch;
  text-align: center;
}

.orp-after {
  flex: 1;
  text-align: left;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
}

/* ── Progress Bar ── */
.progress-bar {
  height: 6px;
  background: var(--border);
  border-radius: 3px;
  cursor: pointer;
  margin: 0.6rem 0;
  position: relative;
}

.progress-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 3px;
  pointer-events: none;
  transition: width 0.1s linear;
}

/* ── Control Bar ── */
.control-bar {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 0 0.25rem;
  flex-wrap: wrap;
}

.play-btn {
  background: var(--accent);
  color: #000;
  border: none;
  border-radius: 50%;
  width: 2.8rem;
  height: 2.8rem;
  font-size: 1.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.wpm-control {
  flex: 1;
  min-width: 140px;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.wpm-label {
  font-size: 0.78rem;
  color: var(--text-muted);
}

.wpm-control input[type=range] {
  width: 100%;
  accent-color: var(--accent);
}

.font-size-btns {
  display: flex;
  gap: 0.3rem;
}

.font-size-btns button {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-muted);
  padding: 0.4rem 0.6rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.font-size-btns button.active {
  background: var(--accent);
  color: #000;
  border-color: var(--accent);
}

/* ── Error state ── */
.reader-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100dvh;
  gap: 1.2rem;
  padding: 2rem;
  text-align: center;
}

.reader-error p { color: var(--text-muted); }

.reader-error button {
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 0.7rem 1.5rem;
  border-radius: var(--radius);
}
```

- [ ] **Step 4: Create stub screens so App compiles**

```bash
mkdir -p /c/Users/matth/repos/rsvp-reader/client/src/screens
```

Create `client/src/screens/LibraryScreen.jsx` (stub):
```jsx
export default function LibraryScreen({ onOpen }) {
  return <div className="library-screen"><h1>Library</h1></div>;
}
```

Create `client/src/screens/ReaderScreen.jsx` (stub):
```jsx
export default function ReaderScreen({ book, onBack }) {
  return <div className="reader-screen"><button onClick={onBack}>← Back</button><p>{book.title}</p></div>;
}
```

- [ ] **Step 5: Verify client builds without error**

```bash
cd /c/Users/matth/repos/rsvp-reader/client
npm run dev
```

Expected: Vite starts on port 5173, no console errors in browser.

- [ ] **Step 6: Commit**

```bash
cd /c/Users/matth/repos/rsvp-reader
git add client/src/
git commit -m "feat: dark theme, app skeleton, stub screens"
```

---

## Task 9: Supporting Components

**Files:**
- Create: `client/src/components/BookCard.jsx`
- Create: `client/src/components/Toast.jsx`
- Create: `client/src/components/ControlBar.jsx`
- Create: `client/src/components/ProgressBar.jsx`

- [ ] **Step 1: Create client/src/components/BookCard.jsx**

```jsx
// client/src/components/BookCard.jsx
export default function BookCard({ book, onOpen, onDelete }) {
  return (
    <div className={`book-card${book.hasWarning ? ' has-warning' : ''}`}>
      {book.hasWarning && <span className="warning-badge" title="Text extraction failed">⚠</span>}
      <p className="book-title">{book.title}</p>
      <p className="word-count">{book.wordCount.toLocaleString()} words</p>
      {book.hasWarning && (
        <p className="warning-msg">Could not extract text. PDF may be scanned or image-based.</p>
      )}
      <div className="book-actions">
        <button className="btn-read" onClick={onOpen} disabled={book.hasWarning}>Read</button>
        <button onClick={onDelete}>Delete</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create client/src/components/Toast.jsx**

```jsx
// client/src/components/Toast.jsx
export default function Toast({ message }) {
  return <div className="toast">{message}</div>;
}
```

- [ ] **Step 3: Create client/src/components/ControlBar.jsx**

```jsx
// client/src/components/ControlBar.jsx
export default function ControlBar({ playing, wpm, fontSize, onPlay, onPause, onWpmChange, onFontSizeChange }) {
  return (
    <div className="control-bar">
      <button className="play-btn" onClick={playing ? onPause : onPlay} aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? '⏸' : '▶'}
      </button>

      <label className="wpm-control">
        <span className="wpm-label">{wpm} WPM</span>
        <input
          type="range"
          min={50}
          max={1000}
          step={10}
          value={wpm}
          onChange={e => onWpmChange(Number(e.target.value))}
        />
      </label>

      <div className="font-size-btns">
        {['sm', 'md', 'lg'].map(size => (
          <button
            key={size}
            className={fontSize === size ? 'active' : ''}
            onClick={() => onFontSizeChange(size)}
          >
            {size === 'sm' ? 'S' : size === 'md' ? 'M' : 'L'}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create client/src/components/ProgressBar.jsx**

```jsx
// client/src/components/ProgressBar.jsx
export default function ProgressBar({ index, total, onSeek }) {
  const pct = total > 1 ? (index / (total - 1)) * 100 : 0;

  function handleClick(e) {
    if (total < 2) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(Math.round(ratio * (total - 1)));
  }

  return (
    <div className="progress-bar" onClick={handleClick} role="progressbar" aria-valuenow={index} aria-valuemax={total}>
      <div className="progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
cd /c/Users/matth/repos/rsvp-reader
git add client/src/components/
git commit -m "feat: BookCard, Toast, ControlBar, ProgressBar components"
```

---

## Task 10: Library Screen

**Files:**
- Modify: `client/src/screens/LibraryScreen.jsx`

- [ ] **Step 1: Replace stub LibraryScreen.jsx with full implementation**

```jsx
// client/src/screens/LibraryScreen.jsx
import { useState, useEffect } from 'react';
import { listBooks, uploadBook, deleteBook as apiDeleteBook } from '../api.js';
import BookCard from '../components/BookCard.jsx';
import Toast from '../components/Toast.jsx';

export default function LibraryScreen({ onOpen }) {
  const [books, setBooks] = useState([]);
  const [toast, setToast] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      setBooks(await listBooks());
    } catch {
      showToast('Failed to load library');
    }
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleFileChange(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!file.name.endsWith('.pdf') && file.type !== 'application/pdf') {
      return showToast('Please select a PDF file');
    }
    setUploading(true);
    try {
      await uploadBook(file);
      await load();
    } catch {
      showToast('Upload failed. Try again.');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id) {
    try {
      await apiDeleteBook(id);
      setBooks(prev => prev.filter(b => b.id !== id));
    } catch {
      showToast('Delete failed');
    }
  }

  return (
    <div className="library-screen">
      <div className="library-header">
        <h1>Library</h1>
        <label className={`upload-btn${uploading ? ' disabled' : ''}`}>
          {uploading ? 'Uploading…' : 'Upload PDF'}
          <input type="file" accept=".pdf,application/pdf" onChange={handleFileChange} hidden disabled={uploading} />
        </label>
      </div>

      <div className="book-grid">
        {books.map(book => (
          <BookCard
            key={book.id}
            book={book}
            onOpen={() => onOpen(book)}
            onDelete={() => handleDelete(book.id)}
          />
        ))}
        {books.length === 0 && !uploading && (
          <p className="empty-state">No books yet — upload a PDF to get started.</p>
        )}
      </div>

      {toast && <Toast message={toast} />}
    </div>
  );
}
```

- [ ] **Step 2: Verify library screen renders in browser**

Start both servers: `npm run dev` from project root.
Open `http://localhost:5173` — should show "Library" heading and "Upload PDF" button.
Upload a PDF — should appear in the grid.

- [ ] **Step 3: Commit**

```bash
cd /c/Users/matth/repos/rsvp-reader
git add client/src/screens/LibraryScreen.jsx
git commit -m "feat: library screen with upload, list, and delete"
```

---

## Task 11: Reader Screen

**Files:**
- Modify: `client/src/screens/ReaderScreen.jsx`

- [ ] **Step 1: Replace stub ReaderScreen.jsx with full implementation**

```jsx
// client/src/screens/ReaderScreen.jsx
import { useReducer, useEffect, useRef, useState, useCallback } from 'react';
import { getWords } from '../api.js';
import { readerReducer, initialState } from '../reducers/readerReducer.js';
import ORPDisplay from '../components/ORPDisplay.jsx';
import ControlBar from '../components/ControlBar.jsx';
import ProgressBar from '../components/ProgressBar.jsx';

export default function ReaderScreen({ book, onBack }) {
  const [state, dispatch] = useReducer(readerReducer, initialState);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  // Load words on mount
  useEffect(() => {
    getWords(book.id)
      .then(words => dispatch({ type: 'SET_WORDS', words }))
      .catch(() => setError('Failed to load book.'));
  }, [book.id]);

  // Drive playback with setInterval
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (state.playing) {
      intervalRef.current = setInterval(
        () => dispatch({ type: 'TICK' }),
        Math.round(60000 / state.wpm)
      );
    }
    return () => clearInterval(intervalRef.current);
  }, [state.playing, state.wpm]);

  const handleRetry = useCallback(() => {
    setError(null);
    getWords(book.id)
      .then(words => dispatch({ type: 'SET_WORDS', words }))
      .catch(() => setError('Failed to load book.'));
  }, [book.id]);

  const handleBack = () => {
    dispatch({ type: 'PAUSE' });
    onBack();
  };

  if (error) {
    return (
      <div className="reader-error">
        <p>{error}</p>
        <button onClick={handleRetry}>Retry</button>
        <button onClick={onBack}>← Back to Library</button>
      </div>
    );
  }

  const currentWord = state.words[state.index] || '';
  const finished = state.words.length > 0 && !state.playing && state.index >= state.words.length - 1;

  return (
    <div className="reader-screen">
      <div className="reader-top-bar">
        <button className="back-btn" onClick={handleBack}>← Library</button>
        <span className="book-title-bar">{book.title}</span>
      </div>

      {finished && <div className="finished-badge">✓ Finished</div>}

      <div className="orp-stage">
        <ORPDisplay word={currentWord} fontSize={state.fontSize} />
      </div>

      <ProgressBar
        index={state.index}
        total={state.words.length}
        onSeek={index => dispatch({ type: 'SEEK', index })}
      />

      <ControlBar
        playing={state.playing}
        wpm={state.wpm}
        fontSize={state.fontSize}
        onPlay={() => dispatch({ type: 'PLAY' })}
        onPause={() => dispatch({ type: 'PAUSE' })}
        onWpmChange={wpm => dispatch({ type: 'SET_WPM', wpm })}
        onFontSizeChange={fontSize => dispatch({ type: 'SET_FONT_SIZE', fontSize })}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify reader screen works end-to-end in browser**

With both dev servers running (`npm run dev` from project root):
1. Upload a PDF from the library screen
2. Tap/click "Read" — reader screen should appear
3. Tap ▶ — words should flash one at a time
4. Drag the progress bar — position should jump
5. Adjust WPM slider — speed should change
6. Toggle font size S/M/L — word size should change
7. Tap ← Library — return to library screen

- [ ] **Step 3: Commit**

```bash
cd /c/Users/matth/repos/rsvp-reader
git add client/src/screens/ReaderScreen.jsx
git commit -m "feat: reader screen with RSVP playback, ORP display, controls"
```

---

## Task 12: Production Build

**Files:**
- Modify: `package.json` (verify start script)

- [ ] **Step 1: Build the client**

```bash
cd /c/Users/matth/repos/rsvp-reader
npm run build
```

Expected: `client/dist/` directory created with `index.html` and bundled assets. No errors.

- [ ] **Step 2: Start in production mode**

```bash
NODE_ENV=production node server.js
```

Expected: `Server running at http://0.0.0.0:3001` printed.
Open `http://localhost:3001` in browser — full app should load from Express (not Vite).

- [ ] **Step 3: Find your PC's local IP and test from mobile**

```bash
# Windows
ipconfig | grep "IPv4"
```

Note the IP (e.g., `192.168.1.42`).
On your phone, open `http://192.168.1.42:3001` — full app should load.
Upload a PDF, tap Read, verify RSVP playback works on mobile.

- [ ] **Step 4: Add convenience start instructions to a README (optional)**

If desired, note in conversation — do not create docs unless user asks.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/matth/repos/rsvp-reader
git add .
git commit -m "feat: production build verified"
```

---

## Self-Review Notes

- **Spec coverage:**
  - ✅ PDF upload → extraction → cache
  - ✅ Library view (grid, title, word count, warning badge, delete)
  - ✅ Reader with ORP, fixed letter position, guide lines
  - ✅ WPM slider 50–1000, default 300
  - ✅ Font size S/M/L
  - ✅ Progress bar + position scrubber
  - ✅ Play/pause, end-of-book "Finished" indicator
  - ✅ Error states: bad upload (toast), empty extraction (warning badge), network error (retry button)
  - ✅ `enrichText` no-op hook wired
  - ✅ Dark mode only
  - ✅ Accessible on local network via `0.0.0.0` binding

- **No placeholders found** — all steps have complete code.

- **Type consistency:** `readerReducer` and `initialState` defined in Task 7, imported in Task 11 ✅. `getOrpIndex`/`splitWord` defined in Task 6, referenced in tests ✅.
