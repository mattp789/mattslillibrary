// client/src/screens/ReaderScreen.jsx
import { useReducer, useEffect, useRef, useState, useCallback } from 'react';
import { getWords } from '../api.js';
import { readerReducer, initialState } from '../reducers/readerReducer.js';
import ORPDisplay from '../components/ORPDisplay.jsx';
import ControlBar from '../components/ControlBar.jsx';
import ProgressBar from '../components/ProgressBar.jsx';

export default function ReaderScreen({ book, onBack }) {
  const [state, dispatch] = useReducer(readerReducer, initialState);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  // Load words on mount
  useEffect(() => {
    getWords(book.id)
      .then(words => dispatch({ type: 'SET_WORDS', words }))
      .catch(() => setError('Failed to load book.'));
  }, [book.id]);

  // Drive playback with setInterval — recreate whenever playing or wpm changes
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (state.playing) {
      intervalRef.current = setInterval(
        () => dispatch({ type: 'TICK' }),
        Math.round(60000 / state.wpm)
      );
    }
    return () => clearInterval(intervalRef.current);
  }, [state.playing, state.wpm]);

  const handleRetry = useCallback(() => {
    setError(null);
    getWords(book.id)
      .then(words => dispatch({ type: 'SET_WORDS', words }))
      .catch(() => setError('Failed to load book.'));
  }, [book.id]);

  const handleBack = () => {
    dispatch({ type: 'PAUSE' });
    onBack();
  };

  if (error) {
    return (
      <div className="reader-error">
        <p>{error}</p>
        <button onClick={handleRetry}>Retry</button>
        <button onClick={onBack}>← Back to Library</button>
      </div>
    );
  }

  const currentWord = state.words[state.index] || '';
  const finished = state.words.length > 0 && !state.playing && state.index >= state.words.length - 1;

  return (
    <div className="reader-screen">
      <div className="reader-top-bar">
        <button className="back-btn" onClick={handleBack}>← Library</button>
        <span className="book-title-bar">{book.title}</span>
      </div>

      {finished && <div className="finished-badge">✓ Finished</div>}

      <div className="orp-stage">
        <ORPDisplay word={currentWord} fontSize={state.fontSize} />
      </div>

      <ProgressBar
        index={state.index}
        total={state.words.length}
        onSeek={index => dispatch({ type: 'SEEK', index })}
      />

      <ControlBar
        playing={state.playing}
        wpm={state.wpm}
        fontSize={state.fontSize}
        onPlay={() => dispatch({ type: 'PLAY' })}
        onPause={() => dispatch({ type: 'PAUSE' })}
        onWpmChange={wpm => dispatch({ type: 'SET_WPM', wpm })}
        onFontSizeChange={fontSize => dispatch({ type: 'SET_FONT_SIZE', fontSize })}
      />
    </div>
  );
}
