// client/src/components/ControlBar.jsx
export default function ControlBar({ playing, wpm, fontSize, onPlay, onPause, onWpmChange, onFontSizeChange }) {
  return (
    <div className="control-bar">
      <button className="play-btn" onClick={playing ? onPause : onPlay} aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? '⏸' : '▶'}
      </button>

      <label className="wpm-control">
        <span className="wpm-label">{wpm} WPM</span>
        <input
          type="range"
          min={50}
          max={1000}
          step={10}
          value={wpm}
          onChange={e => onWpmChange(Number(e.target.value))}
        />
      </label>

      <div className="font-size-btns">
        {['sm', 'md', 'lg'].map(size => (
          <button
            key={size}
            className={fontSize === size ? 'active' : ''}
            onClick={() => onFontSizeChange(size)}
          >
            {size === 'sm' ? 'S' : size === 'md' ? 'M' : 'L'}
          </button>
        ))}
      </div>
    </div>
  );
}
