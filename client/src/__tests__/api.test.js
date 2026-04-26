import { describe, test, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => mockFetch.mockReset());

const { listBooks, uploadBook, getWords, deleteBook } = await import('../api.js');

describe('listBooks', () => {
  test('GETs /api/books and returns JSON', async () => {
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
  test('GETs /api/books/:id/words', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ['hello', 'world'] });
    const result = await getWords('abc');
    expect(mockFetch).toHaveBeenCalledWith('/api/books/abc/words');
    expect(result).toEqual(['hello', 'world']);
  });
});

describe('deleteBook', () => {
  test('DELETEs /api/books/:id', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    await deleteBook('abc');
    expect(mockFetch).toHaveBeenCalledWith('/api/books/abc', { method: 'DELETE' });
  });
});
