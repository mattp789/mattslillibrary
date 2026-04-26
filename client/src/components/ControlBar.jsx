export default function ControlBar({ playing, wpm, effectiveWpm, fontSize, onPlay, onPause, onRewind, onWpmChange, onFontSizeChange }) {
  const ramping = playing && effectiveWpm < wpm;

  return (
    <div className="control-bar">
      <button className="rewind-btn" onClick={onRewind} aria-label="Rewind 1 minute">⏮ 1m</button>

      <button className="play-btn" onClick={playing ? onPause : onPlay} aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? '⏸' : '▶'}
      </button>

      <label className="wpm-control">
        <span className="wpm-label">
          {ramping ? `${effectiveWpm}↑${wpm} WPM` : `${wpm} WPM`}
        </span>
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
