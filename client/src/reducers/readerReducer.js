export const initialState = {
  words: [],
  index: 0,
  wpm: 300,
  playing: false,
  fontSize: 'md',
};

export function readerReducer(state, action) {
  switch (action.type) {
    case 'SET_WORDS':
      return { ...state, words: action.words, index: 0, playing: false };
    case 'PLAY':
      return { ...state, playing: true };
    case 'PAUSE':
      return { ...state, playing: false };
    case 'TICK':
      if (state.index >= state.words.length - 1) {
        return { ...state, playing: false };
      }
      return { ...state, index: state.index + 1 };
    case 'SEEK':
      return { ...state, index: action.index };
    case 'SET_WPM':
      return { ...state, wpm: Math.max(50, Math.min(1000, action.wpm)) };
    case 'SET_FONT_SIZE':
      return { ...state, fontSize: action.fontSize };
    default:
      return state;
  }
}
