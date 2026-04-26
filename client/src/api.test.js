import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally
global.fetch = vi.fn();

beforeEach(() => vi.clearAllMocks());

describe('login', () => {
  test('POSTs credentials and returns user on success', async () => {
    const { login } = await import('./api.js');
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: '1', username: 'alice', role: 'user' }),
    });
    const user = await login('a@b.com', 'pw');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/login'),
      expect.objectContaining({ method: 'POST', credentials: 'include' })
    );
    expect(user.username).toBe('alice');
  });

  test('throws on non-ok response', async () => {
    const { login } = await import('./api.js');
    fetch.mockResolvedValueOnce({ ok: false });
    await expect(login('a@b.com', 'bad')).rejects.toThrow();
  });
});

describe('listBooks', () => {
  test('sends credentials', async () => {
    const { listBooks } = await import('./api.js');
    fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });
    await listBooks();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/books'),
      expect.objectContaining({ credentials: 'include' })
    );
  });
});
