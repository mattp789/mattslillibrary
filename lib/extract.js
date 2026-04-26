// lib/extract.js

async function extractRawText(pdfFilePath) {
  // Lazy-load pdfjs-dist inside the function so module-level require failures
  // don't break the pure-function exports used by tests.
  const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
  pdfjsLib.GlobalWorkerOptions.workerSrc = false;

  const fs = require('fs');
  const data = new Uint8Array(fs.readFileSync(pdfFilePath));
  const doc = await pdfjsLib.getDocument({ data }).promise;
  let text = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(item => item.str).join(' ') + '\n';
  }
  return text;
}

function cleanText(rawText) {
  return rawText
    .replace(/(\w)-\n(\w)/g, '$1$2')   // rejoin hyphenated line breaks
    .replace(/^\s*\d+\s*$/gm, '')      // strip standalone page numbers
    .trim();
}

function textToWords(text) {
  return text
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length > 0);
}

function enrichText(words) {
  // No-op: hook for future AI enrichment pass
  return words;
}

async function extractWords(pdfFilePath) {
  const raw = await extractRawText(pdfFilePath);
  const cleaned = cleanText(raw);
  const words = textToWords(cleaned);
  return enrichText(words);
}

module.exports = { extractWords, cleanText, enrichText, textToWords };
