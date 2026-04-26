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
