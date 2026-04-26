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
