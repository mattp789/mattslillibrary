export const initialState = {
  words: [],
  index: 0,
  wpm: 300,
  effectiveWpm: 300,
  playing: false,
  fontSize: 'md',
};

export function readerReducer(state, action) {
  switch (action.type) {
    case 'SET_WORDS':
      return { ...state, words: action.words, index: 0, playing: false };
    case 'PLAY':
      return { ...state, playing: true, effectiveWpm: Math.max(50, state.wpm - 100) };
    case 'PAUSE':
      return { ...state, playing: false, effectiveWpm: state.wpm };
    case 'TICK': {
      if (state.index >= state.words.length - 1) {
        return { ...state, playing: false, effectiveWpm: state.wpm };
      }
      const nextEffective = state.effectiveWpm < state.wpm
        ? Math.min(state.wpm, state.effectiveWpm + 2)
        : state.wpm;
      return { ...state, index: state.index + 1, effectiveWpm: nextEffective };
    }
    case 'SEEK':
      return { ...state, index: action.index };
    case 'REWIND':
      return { ...state, playing: false, effectiveWpm: state.wpm, index: Math.max(0, state.index - state.wpm) };
    case 'SET_WPM': {
      const clamped = Math.max(50, Math.min(1000, action.wpm));
      return { ...state, wpm: clamped, effectiveWpm: clamped };
    }
    case 'SET_FONT_SIZE':
      return { ...state, fontSize: action.fontSize };
    default:
      return state;
  }
}
