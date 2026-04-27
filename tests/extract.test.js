const JSZip = require('jszip');
const { cleanText, textToWords, enrichText, stripHtml, detectFormat, extractWords } = require('../lib/extract');

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

describe('stripHtml', () => {
  test('removes tags', () => {
    expect(stripHtml('<p>hello <b>world</b></p>').trim()).toBe('hello  world');
  });

  test('decodes common entities', () => {
    expect(stripHtml('&amp; &lt; &gt; &quot; &#39; &#65;').trim()).toBe('& < > " \' A');
  });

  test('removes script and style blocks', () => {
    expect(stripHtml('<style>.x{}</style>hi<script>x()</script>there').trim()).toBe('hithere');
  });
});

describe('detectFormat', () => {
  test('identifies PDF by magic bytes', () => {
    const buf = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]);
    expect(detectFormat(buf)).toBe('pdf');
  });

  test('identifies EPUB (zip) by magic bytes', () => {
    const buf = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
    expect(detectFormat(buf)).toBe('epub');
  });

  test('returns unknown for plain text', () => {
    expect(detectFormat(Buffer.from('hello'))).toBe('unknown');
  });
});

describe('extractWords (EPUB)', () => {
  async function buildEpub({ chapters }) {
    const zip = new JSZip();
    zip.file('mimetype', 'application/epub+zip');
    zip.file('META-INF/container.xml',
      `<?xml version="1.0"?>
       <container xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
         <rootfiles>
           <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
         </rootfiles>
       </container>`);

    const manifestXml = chapters.map((_, i) =>
      `<item id="ch${i}" href="ch${i}.xhtml" media-type="application/xhtml+xml"/>`
    ).join('');
    const spineXml = chapters.map((_, i) => `<itemref idref="ch${i}"/>`).join('');

    zip.file('OEBPS/content.opf',
      `<?xml version="1.0"?>
       <package xmlns="http://www.idpf.org/2007/opf" version="3.0">
         <manifest>${manifestXml}</manifest>
         <spine>${spineXml}</spine>
       </package>`);

    chapters.forEach((html, i) => {
      zip.file(`OEBPS/ch${i}.xhtml`,
        `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><body>${html}</body></html>`);
    });

    return zip.generateAsync({ type: 'nodebuffer' });
  }

  test('extracts words from a multi-chapter EPUB in spine order', async () => {
    const buffer = await buildEpub({
      chapters: ['<p>Hello world</p>', '<p>Second chapter here</p>'],
    });
    const words = await extractWords(buffer);
    expect(words).toEqual(['Hello', 'world', 'Second', 'chapter', 'here']);
  });

  test('decodes HTML entities in EPUB chapters', async () => {
    const buffer = await buildEpub({
      chapters: ['<p>Tom &amp; Jerry</p>'],
    });
    const words = await extractWords(buffer);
    expect(words).toEqual(['Tom', '&', 'Jerry']);
  });

  test('rejects unsupported file format', async () => {
    await expect(extractWords(Buffer.from('not a real file'))).rejects.toThrow('Unsupported file format');
  });
});
