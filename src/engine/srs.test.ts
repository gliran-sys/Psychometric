import { describe, expect, it } from 'vitest';
import { dueCards, gradeFrom, isDue, MIN_EASE, newCard, review } from './srs';

const TODAY = '2026-08-16';

describe('grading from drill results', () => {
  it('fails any incorrect answer', () => {
    expect(gradeFrom(false, 30, 60)).toBeLessThan(3);
    expect(gradeFrom(false, 120, 60)).toBeLessThan(3);
  });

  it('rewards a fast correct answer above a slow one', () => {
    expect(gradeFrom(true, 30, 60)).toBeGreaterThan(gradeFrom(true, 120, 60));
  });

  it('still passes a slow but correct answer', () => {
    expect(gradeFrom(true, 120, 60)).toBeGreaterThanOrEqual(3);
  });
});

describe('review scheduling', () => {
  it('brings a missed item back tomorrow', () => {
    // A missed item you never see again is a missed item you will miss on test day.
    const card = review(newCard('x', 'item', TODAY), 1, TODAY);
    expect(card.intervalDays).toBe(1);
    expect(card.due).toBe('2026-08-17');
    expect(card.lapses).toBe(1);
  });

  it('expands the interval across successive correct reviews', () => {
    let card = newCard('x', 'item', TODAY);
    card = review(card, 5, TODAY);
    expect(card.intervalDays).toBe(1);

    card = review(card, 5, '2026-08-17');
    expect(card.intervalDays).toBe(6);

    const third = review(card, 5, '2026-08-23');
    expect(third.intervalDays).toBeGreaterThan(6);
  });

  it('resets progress but keeps the lapse count on a relapse', () => {
    let card = newCard('x', 'item', TODAY);
    card = review(card, 5, TODAY);
    card = review(card, 5, '2026-08-17');
    expect(card.reps).toBe(2);

    const lapsed = review(card, 0, '2026-08-23');
    expect(lapsed.reps).toBe(0);
    expect(lapsed.intervalDays).toBe(1);
    expect(lapsed.lapses).toBe(1);
  });

  it('never lets ease fall below the floor', () => {
    let card = newCard('x', 'item', TODAY);
    for (let i = 0; i < 20; i += 1) card = review(card, 0, TODAY);
    expect(card.ease).toBeGreaterThanOrEqual(MIN_EASE);
  });

  it('lowers ease after a miss and raises it after a perfect recall', () => {
    const base = newCard('x', 'item', TODAY);
    expect(review(base, 0, TODAY).ease).toBeLessThan(base.ease);
    expect(review(base, 5, TODAY).ease).toBeGreaterThan(base.ease);
  });
});

describe('the daily queue', () => {
  it('treats a card due today as due', () => {
    expect(isDue(newCard('x', 'item', TODAY), TODAY)).toBe(true);
  });

  it('surfaces the most-lapsed cards first', () => {
    // The cards that keep beating you are the ones worth the limited daily time.
    const easy = { ...newCard('easy', 'item', TODAY), lapses: 0 };
    const stubborn = { ...newCard('stubborn', 'item', TODAY), lapses: 4 };

    const queue = dueCards({ easy, stubborn }, TODAY);
    expect(queue[0].id).toBe('stubborn');
  });

  it('excludes cards scheduled for the future', () => {
    const future = { ...newCard('later', 'vocab', TODAY), due: '2026-09-01' };
    expect(dueCards({ later: future }, TODAY)).toHaveLength(0);
  });
});
