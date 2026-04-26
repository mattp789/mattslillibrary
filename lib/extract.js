// lib/extract.js

async function extractRawText(buffer) {
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

async function extractWords(buffer) {
  const raw = await extractRawText(buffer);
  const cleaned = cleanText(raw);
  const words = textToWords(cleaned);
  return enrichText(words);
}

module.exports = { extractWords, cleanText, enrichText, textToWords };
