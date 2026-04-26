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
