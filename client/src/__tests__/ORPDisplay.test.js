import { describe, test, expect } from 'vitest';
import { getOrpIndex, splitWord } from '../components/ORPDisplay.jsx';

describe('getOrpIndex', () => {
  test('returns 0 for single character', () => {
    expect(getOrpIndex('a')).toBe(0);
  });

  test('returns floor(length * 0.35)', () => {
    expect(getOrpIndex('hi')).toBe(0);           // floor(2*0.35) = 0
    expect(getOrpIndex('cat')).toBe(1);           // floor(3*0.35) = 1
    expect(getOrpIndex('hello')).toBe(1);         // floor(5*0.35) = 1
    expect(getOrpIndex('reading')).toBe(2);       // floor(7*0.35) = 2
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
