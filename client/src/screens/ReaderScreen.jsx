// client/src/screens/ReaderScreen.jsx
import { useReducer, useEffect, useRef, useState, useCallback } from 'react';
import { getWords, saveProgress } from '../api.js';
import { readerReducer, initialState } from '../reducers/readerReducer.js';
import ORPDisplay from '../components/ORPDisplay.jsx';
import ControlBar from '../components/ControlBar.jsx';
import ProgressBar from '../components/ProgressBar.jsx';

export default function ReaderScreen({ book, onBack }) {
  const [state, dispatch] = useReducer(readerReducer, initialState);
  const [error, setError] = useState(null);
  const [focused, setFocused] = useState(false);
  const intervalRef = useRef(null);
  const saveTimerRef = useRef(null);

  const persistProgress = useCallback((index, wpm) => {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveProgress(book.id, index, wpm).catch(() => {});
    }, 2000);
  }, [book.id]);

  // Load words on mount, then resume saved position and WPM
  useEffect(() => {
    getWords(book.id)
      .then(words => {
        dispatch({ type: 'SET_WORDS', words });
        if (book.savedWpm) dispatch({ type: 'SET_WPM', wpm: book.savedWpm });
        const saved = book.progress || 0;
        if (saved > 0 && saved < words.length) {
          dispatch({ type: 'SEEK', index: saved });
        }
      })
      .catch(() => setError('Failed to load book.'));
  }, [book.id, book.progress, book.savedWpm]);

  // Persist position and WPM whenever either changes
  useEffect(() => {
    if (state.words.length > 0) {
      persistProgress(state.index, state.wpm);
    }
  }, [state.index, state.wpm, state.words.length, persistProgress]);

  // Drive playback — recreate interval whenever playing or effectiveWpm changes (ramp adjusts this per tick)
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (state.playing) {
      intervalRef.current = setInterval(
        () => dispatch({ type: 'TICK' }),
        Math.round(60000 / state.effectiveWpm)
      );
    }
    return () => clearInterval(intervalRef.current);
  }, [state.playing, state.effectiveWpm]);

  const handleRetry = useCallback(() => {
    setError(null);
    getWords(book.id)
      .then(words => {
        dispatch({ type: 'SET_WORDS', words });
        if (book.savedWpm) dispatch({ type: 'SET_WPM', wpm: book.savedWpm });
        const saved = book.progress || 0;
        if (saved > 0 && saved < words.length) {
          dispatch({ type: 'SEEK', index: saved });
        }
      })
      .catch(() => setError('Failed to load book.'));
  }, [book.id, book.progress, book.savedWpm]);

  const handleBack = () => {
    dispatch({ type: 'PAUSE' });
    clearTimeout(saveTimerRef.current);
    saveProgress(book.id, state.index, state.wpm).catch(() => {});
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
    <div className={`reader-screen${focused ? ' reader-focused' : ''}`}>
      {!focused && (
        <div className="reader-top-bar">
          <button className="back-btn" onClick={handleBack}>← Library</button>
          <span className="book-title-bar">{book.title}</span>
        </div>
      )}

      {!focused && finished && <div className="finished-badge">✓ Finished</div>}

      <div className="orp-stage" onClick={() => setFocused(f => !f)}>
        <ORPDisplay word={currentWord} fontSize={state.fontSize} />
      </div>

      {!focused && (
        <ProgressBar
          index={state.index}
          total={state.words.length}
          onSeek={index => dispatch({ type: 'SEEK', index })}
        />
      )}

      {!focused && <ControlBar
        playing={state.playing}
        wpm={state.wpm}
        effectiveWpm={state.effectiveWpm}
        fontSize={state.fontSize}
        onPlay={() => dispatch({ type: 'PLAY' })}
        onPause={() => dispatch({ type: 'PAUSE' })}
        onRewind={() => dispatch({ type: 'REWIND' })}
        onWpmChange={wpm => dispatch({ type: 'SET_WPM', wpm })}
        onFontSizeChange={fontSize => dispatch({ type: 'SET_FONT_SIZE', fontSize })}
      />}
    </div>
  );
}
