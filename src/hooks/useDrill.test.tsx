import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useDrill } from './useDrill';
import { petItemsByTopic } from '../content';
import { useStore } from '../state/store';
import type { Item } from '../content/schema';

/**
 * Regression tests for two bugs found in real use of the analogies drill: questions
 * repeating several times in a row, and answering a question sometimes jumping to the
 * next one with an answer already selected on it.
 *
 * Both came from the same place. The served item was derived with `useMemo` from the
 * pool and the seen set. Grading an answer updates the ability rating; the rating moves
 * the target difficulty; and because the topic pool was rebuilt on every render the memo
 * re-ran and, when the target crossed a difficulty boundary, handed back a *different*
 * item — while `selected` and `revealed` still described the previous one.
 *
 * These tests drive the real hook against the real content bank, because the defect only
 * appears in the interaction between the store, the pool and the render cycle. Testing
 * `selectNextItem` alone cannot see it.
 */

const RESET = useStore.getState();

afterEach(() => {
  act(() => {
    useStore.setState({ ...RESET, abilities: {}, attempts: [], srs: {}, xp: 0 }, true);
  });
});

/** Seeds the rating for a topic so a single answer crosses a difficulty boundary. */
function seedRating(topic: string, rating: number) {
  act(() => {
    useStore.setState({ abilities: { [topic]: { rating, attempts: 5, correct: 3 } } });
  });
}

/**
 * The pool is looked up *inside* the render, exactly as Drill.tsx does it. This is not
 * incidental: hoisting the call out of the callback hands the hook a stable array and
 * hides the bug entirely, because the original `useMemo` only re-ran when the pool
 * changed identity.
 */
function drill(topic = 'analogies') {
  return renderHook(() => useDrill(petItemsByTopic(topic), 'pet', topic));
}

describe('the served question', () => {
  it('does not change when answering moves the ability rating across a difficulty step', () => {
    // At rating 1070 the target sits just under the level-2/level-3 boundary, so one
    // correct answer used to re-select a level-3 item mid-question. This is the exact
    // condition the user hit.
    seedRating('analogies', 1070);
    const { result } = drill();

    const shown = result.current.current as Item;
    expect(shown).toBeTruthy();

    act(() => result.current.answer(shown.correctIndex));

    expect(result.current.current?.id).toBe(shown.id);
    expect(result.current.revealed).toBe(true);
    expect(result.current.selected).toBe(shown.correctIndex);
  });

  it('stays put through a wrong answer too', () => {
    seedRating('analogies', 894);
    const { result } = drill();
    const shown = result.current.current as Item;
    const wrong = (shown.correctIndex + 1) % 4;

    act(() => result.current.answer(wrong));

    expect(result.current.current?.id).toBe(shown.id);
    expect(result.current.selected).toBe(wrong);
  });

  it('arrives at the next question unanswered', () => {
    seedRating('analogies', 1070);
    const { result } = drill();
    const first = result.current.current as Item;

    act(() => result.current.answer(first.correctIndex));
    act(() => result.current.next());

    expect(result.current.current?.id).not.toBe(first.id);
    expect(result.current.selected).toBeNull();
    expect(result.current.revealed).toBe(false);
    expect(result.current.errorType).toBeNull();
  });
});

describe('question repetition', () => {
  it('never serves the same question twice in one session', () => {
    seedRating('analogies', 1070);
    const { result } = drill();
    const pool = petItemsByTopic('analogies');

    const served: string[] = [];
    for (let i = 0; i < pool.length; i += 1) {
      const item = result.current.current;
      if (!item) break;
      served.push(item.id);
      act(() => result.current.answer(item.correctIndex));
      act(() => result.current.next());
    }

    expect(served.length).toBeGreaterThan(10);
    expect(new Set(served).size).toBe(served.length);
  });

  it('does not repeat when answers keep pushing the rating back and forth', () => {
    // Alternating right and wrong walks the rating across a boundary repeatedly, which
    // is what produced runs of the same question.
    seedRating('analogies', 1070);
    const { result } = drill();

    const served: string[] = [];
    for (let i = 0; i < 15; i += 1) {
      const item = result.current.current;
      if (!item) break;
      served.push(item.id);
      const choice = i % 2 === 0 ? item.correctIndex : (item.correctIndex + 1) % 4;
      act(() => result.current.answer(choice));
      act(() => result.current.next());
    }

    expect(new Set(served).size).toBe(served.length);
  });

  it('ends the session once every question in the topic has been answered', () => {
    const pool = petItemsByTopic('analogies');
    const { result } = drill();

    for (let i = 0; i < pool.length + 2; i += 1) {
      if (!result.current.current) break;
      const item = result.current.current;
      act(() => result.current.answer(item.correctIndex));
      act(() => result.current.next());
    }

    expect(result.current.current).toBeNull();
    expect(result.current.stats.answered).toBe(pool.length);
  });
});

describe('grading', () => {
  it('counts the answer against the question that was on screen', () => {
    seedRating('analogies', 1070);
    const { result } = drill();
    const shown = result.current.current as Item;

    act(() => result.current.answer(shown.correctIndex));

    const attempt = useStore.getState().attempts.at(-1);
    expect(attempt?.itemId).toBe(shown.id);
    expect(attempt?.correct).toBe(true);
    expect(result.current.stats.correct).toBe(1);
  });

  it('files the answered question into spaced repetition, not a substituted one', () => {
    seedRating('analogies', 1070);
    const { result } = drill();
    const shown = result.current.current as Item;

    act(() => result.current.answer((shown.correctIndex + 1) % 4));

    expect(Object.keys(useStore.getState().srs)).toEqual([shown.id]);
  });
});

describe('switching topics', () => {
  it('serves questions from the requested topic only', () => {
    const { result } = drill('geometry');
    const ids = new Set(petItemsByTopic('geometry').map((i) => i.id));
    expect(ids.has(result.current.current!.id)).toBe(true);
  });
});
