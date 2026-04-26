// client/src/components/ProgressBar.jsx
export default function ProgressBar({ index, total, onSeek }) {
  const pct = total > 1 ? (index / (total - 1)) * 100 : 0;

  function handleClick(e) {
    if (total < 2) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(Math.round(ratio * (total - 1)));
  }

  return (
    <div className="progress-bar" onClick={handleClick} role="progressbar" aria-valuenow={index} aria-valuemax={total}>
      <div className="progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}
