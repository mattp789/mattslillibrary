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
