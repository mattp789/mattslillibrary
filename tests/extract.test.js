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
