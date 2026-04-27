// lib/extract.js

async function extractRawTextFromPdf(buffer) {
  const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
  pdfjsLib.GlobalWorkerOptions.workerSrc = false;
  const data = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({ data }).promise;
  let text = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(item => item.str).join(' ') + '\n';
  }
  return text;
}

async function extractRawTextFromEpub(buffer) {
  const JSZip = require('jszip');
  const { XMLParser } = require('fast-xml-parser');

  const zip = await JSZip.loadAsync(buffer);
  const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });

  const containerFile = zip.file('META-INF/container.xml');
  if (!containerFile) throw new Error('Invalid EPUB: missing container.xml');
  const container = xml.parse(await containerFile.async('string'));
  const opfPath = container.container.rootfiles.rootfile['full-path'];

  const opfFile = zip.file(opfPath);
  if (!opfFile) throw new Error('Invalid EPUB: missing OPF file');
  const opf = xml.parse(await opfFile.async('string'));

  const manifestItems = [].concat(opf.package.manifest.item);
  const manifestById = Object.fromEntries(
    manifestItems.map(it => [it.id, { href: it.href, properties: it.properties || '' }])
  );

  const spineItems = [].concat(opf.package.spine.itemref);
  const opfDir = opfPath.includes('/') ? opfPath.replace(/\/[^/]+$/, '/') : '';

  const SKIP_HREF = /(^|\/)(nav|toc|cover|title|titlepage|copyright|colophon|frontmatter|index)[^/]*\.x?html?$/i;

  const chapterTexts = [];
  for (const ref of spineItems) {
    if (ref.linear === 'no') continue;
    const item = manifestById[ref.idref];
    if (!item) continue;
    if (item.properties.includes('nav')) continue;
    if (SKIP_HREF.test(item.href)) continue;

    const file = zip.file(opfDir + item.href);
    if (!file) continue;
    const html = await file.async('string');
    const text = stripHtml(html).replace(/\s+/g, ' ').trim();
    if (text.length < 50) continue;

    chapterTexts.push(text);
  }

  return chapterTexts.join('\n');
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function cleanText(rawText) {
  return rawText
    .replace(/(\w)-\n(\w)/g, '$1$2')
    .replace(/^\s*\d+\s*$/gm, '')
    .trim();
}

function textToWords(text) {
  return text
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length > 0);
}

function enrichText(words) {
  return words;
}

function detectFormat(buffer) {
  if (buffer.length >= 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return 'pdf';
  }
  if (buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b) {
    return 'epub';
  }
  return 'unknown';
}

async function extractWords(buffer) {
  const format = detectFormat(buffer);
  let raw;
  if (format === 'pdf') {
    raw = await extractRawTextFromPdf(buffer);
  } else if (format === 'epub') {
    raw = await extractRawTextFromEpub(buffer);
  } else {
    throw new Error('Unsupported file format');
  }
  const cleaned = cleanText(raw);
  const words = textToWords(cleaned);
  return enrichText(words);
}

module.exports = { extractWords, cleanText, enrichText, textToWords, stripHtml, detectFormat };
