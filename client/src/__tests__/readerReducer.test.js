import { describe, test, expect } from 'vitest';
import { readerReducer, initialState } from '../reducers/readerReducer.js';

describe('readerReducer', () => {
  test('SET_WORDS resets index to 0 and stops playback', () => {
    const state = { ...initialState, index: 50, playing: true };
    const next = readerReducer(state, { type: 'SET_WORDS', words: ['a', 'b', 'c'] });
    expect(next.index).toBe(0);
    expect(next.playing).toBe(false);
    expect(next.words).toEqual(['a', 'b', 'c']);
  });

  test('PLAY sets playing to true', () => {
    expect(readerReducer(initialState, { type: 'PLAY' }).playing).toBe(true);
  });

  test('PAUSE sets playing to false', () => {
    const state = { ...initialState, playing: true };
    expect(readerReducer(state, { type: 'PAUSE' }).playing).toBe(false);
  });

  test('TICK increments index', () => {
    const state = { ...initialState, words: ['a', 'b', 'c'], index: 0, playing: true };
    expect(readerReducer(state, { type: 'TICK' }).index).toBe(1);
  });

  test('TICK at last word stops playback and keeps index', () => {
    const state = { ...initialState, words: ['a', 'b'], index: 1, playing: true };
    const next = readerReducer(state, { type: 'TICK' });
    expect(next.playing).toBe(false);
    expect(next.index).toBe(1);
  });

  test('SEEK sets index', () => {
    const state = { ...initialState, words: ['a', 'b', 'c'] };
    expect(readerReducer(state, { type: 'SEEK', index: 2 }).index).toBe(2);
  });

  test('SET_WPM clamps to 50-1000', () => {
    expect(readerReducer(initialState, { type: 'SET_WPM', wpm: 10 }).wpm).toBe(50);
    expect(readerReducer(initialState, { type: 'SET_WPM', wpm: 9999 }).wpm).toBe(1000);
    expect(readerReducer(initialState, { type: 'SET_WPM', wpm: 400 }).wpm).toBe(400);
  });

  test('SET_FONT_SIZE updates fontSize', () => {
    expect(readerReducer(initialState, { type: 'SET_FONT_SIZE', fontSize: 'lg' }).fontSize).toBe('lg');
  });
});
