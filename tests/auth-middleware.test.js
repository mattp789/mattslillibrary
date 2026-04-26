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
