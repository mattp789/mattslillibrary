// client/src/components/ORPDisplay.jsx

export function getOrpIndex(word) {
  if (!word || word.length <= 1) return 0;
  return Math.floor(word.length * 0.35);
}

export function splitWord(word) {
  if (!word) return { before: '', orp: '', after: '' };
  const idx = getOrpIndex(word);
  return {
    before: word.slice(0, idx),
    orp: word[idx] ?? '',
    after: word.slice(idx + 1),
  };
}

const FONT_SIZES = { sm: '2rem', md: '3rem', lg: '4.5rem' };

export default function ORPDisplay({ word = '', fontSize = 'md' }) {
  const { before, orp, after } = splitWord(word);

  return (
    <div className="orp-wrapper" style={{ fontSize: FONT_SIZES[fontSize] || FONT_SIZES.md }}>
      <div className="guide-line" />
      <div className="word-row">
        <span className="orp-before">{before}</span>
        <span className="orp-letter">{orp}</span>
        <span className="orp-after">{after}</span>
      </div>
      <div className="guide-line" />
    </div>
  );
}
