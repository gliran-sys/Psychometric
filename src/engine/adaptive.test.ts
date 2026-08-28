import { describe, expect, it } from 'vitest';
import {
  expectedScore,
  itemRating,
  masteryOf,
  ACCEPTABLE_BAND,
  PRACTICE_BAND,
  selectNextItem,
  STARTING_RATING,
  targetItemRating,
  updateRating,
} from './adaptive';

describe('rating updates', () => {
  it('raises the rating on a correct answer and lowers it on a miss', () => {
    expect(updateRating(STARTING_RATING, 3, true)).toBeGreaterThan(STARTING_RATING);
    expect(updateRating(STARTING_RATING, 3, false)).toBeLessThan(STARTING_RATING);
  });

  it('rewards a hard item more than an easy one', () => {
    const hardGain = updateRating(STARTING_RATING, 5, true) - STARTING_RATING;
    const easyGain = updateRating(STARTING_RATING, 1, true) - STARTING_RATING;
    expect(hardGain).toBeGreaterThan(easyGain);
  });

  it('punishes missing an easy item more than missing a hard one', () => {
    const easyLoss = STARTING_RATING - updateRating(STARTING_RATING, 1, false);
    const hardLoss = STARTING_RATING - updateRating(STARTING_RATING, 5, false);
    expect(easyLoss).toBeGreaterThan(hardLoss);
  });

  it('converges upward over a run of correct answers', () => {
    let rating = STARTING_RATING;
    for (let i = 0; i < 10; i += 1) rating = updateRating(rating, 3, true);
    expect(rating).toBeGreaterThan(STARTING_RATING + 50);
  });
});

describe('expected score', () => {
  it('is even money against an equally rated item', () => {
    expect(expectedScore(1000, 1000)).toBeCloseTo(0.5, 5);
  });

  it('rises against easier items and falls against harder ones', () => {
    expect(expectedScore(1200, 1000)).toBeGreaterThan(0.5);
    expect(expectedScore(800, 1000)).toBeLessThan(0.5);
  });

  it('places a level-3 item at the starting rating so new users meet medium items', () => {
    expect(itemRating(3)).toBe(STARTING_RATING);
    expect(itemRating(5)).toBeGreaterThan(itemRating(1));
  });
});

describe('item selection', () => {
  const pool = [1, 2, 3, 4, 5].map((difficulty) => ({ id: `d${difficulty}`, difficulty }));

  it('serves harder items to a stronger user', () => {
    const weak = selectNextItem(pool, 500, new Set());
    const strong = selectNextItem(pool, 1600, new Set());
    expect(strong!.difficulty).toBeGreaterThan(weak!.difficulty);
  });

  it('aims at a success rate in the productive-struggle band', () => {
    const target = targetItemRating(STARTING_RATING);
    const probability = expectedScore(STARTING_RATING, target);
    expect(probability).toBeGreaterThan(0.6);
    expect(probability).toBeLessThan(0.85);
  });

  it('skips items already seen this session', () => {
    const seen = new Set(pool.slice(0, 4).map((i) => i.id));
    expect(selectNextItem(pool, STARTING_RATING, seen)!.id).toBe('d5');
  });

  it('reuses seen items rather than dead-ending an exhausted topic', () => {
    const seen = new Set(pool.map((i) => i.id));
    expect(selectNextItem(pool, STARTING_RATING, seen)).not.toBeNull();
  });

  it('returns null only when there is nothing to serve', () => {
    expect(selectNextItem([], STARTING_RATING, new Set())).toBeNull();
  });

  it('never serves the item it was told to avoid', () => {
    const exhausted = new Set(pool.map((i) => i.id));
    for (const item of pool) {
      const served = selectNextItem(pool, STARTING_RATING, exhausted, { avoidId: item.id });
      expect(served!.id).not.toBe(item.id);
    }
  });

  it('varies the order between sessions instead of replaying the same one', () => {
    // Difficulty has only five levels, so a topic usually offers many equally suitable
    // items. Picking the first every time made each drill session an exact rerun of the
    // last, which is not what a question bank this size is for.
    const sameLevel = Array.from({ length: 8 }, (_, i) => ({ id: `x${i}`, difficulty: 3 }));
    const picks = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      picks.add(selectNextItem(sameLevel, STARTING_RATING, new Set())!.id);
    }
    expect(picks.size).toBe(sameLevel.length);
  });

  it('draws on more than one difficulty so the effective pool is not one tier', () => {
    // The point of the band. Serving only the nearest tier left a drill cycling roughly
    // nine items in a typical topic, which is what made questions feel repetitive.
    const wide = [1, 2, 3, 4, 5].map((difficulty) => ({ id: `d${difficulty}`, difficulty }));
    const served = new Set<string>();
    for (let i = 0; i < 300; i += 1) {
      served.add(selectNextItem(wide, STARTING_RATING, new Set())!.id);
    }
    expect(served.size).toBeGreaterThan(1);
  });

  it('never serves an item the user would almost certainly miss or certainly get', () => {
    const wide = [1, 2, 3, 4, 5].map((difficulty) => ({ id: `d${difficulty}`, difficulty }));
    for (const rating of [700, 850, 1000, 1150, 1300]) {
      for (let i = 0; i < 60; i += 1) {
        const item = selectNextItem(wide, rating, new Set())!;
        const p = expectedScore(rating, itemRating(item.difficulty));
        expect(p).toBeGreaterThanOrEqual(ACCEPTABLE_BAND.min);
        expect(p).toBeLessThanOrEqual(ACCEPTABLE_BAND.max);
      }
    }
  });

  it('stays inside the tighter practice band when the topic is deep enough', () => {
    // Reaching outwards is only for thin pools. With plenty of material at each level
    // there is no reason to serve anything outside the productive band.
    const deep = [1, 2, 3, 4, 5].flatMap((difficulty) =>
      Array.from({ length: 8 }, (_, i) => ({ id: `d${difficulty}-${i}`, difficulty })),
    );
    for (const rating of [900, 1000, 1100, 1200]) {
      for (let i = 0; i < 60; i += 1) {
        const item = selectNextItem(deep, rating, new Set())!;
        const p = expectedScore(rating, itemRating(item.difficulty));
        expect(p).toBeGreaterThanOrEqual(PRACTICE_BAND.min);
        expect(p).toBeLessThanOrEqual(PRACTICE_BAND.max);
      }
    }
  });

  it('widens a band that is too thin to carry a session', () => {
    // Six items at one level is what a struggling user meets in analogies; without the
    // top-up the drill would cycle those six and nothing else.
    const thin = [
      ...Array.from({ length: 6 }, (_, i) => ({ id: `easy-${i}`, difficulty: 1 })),
      ...Array.from({ length: 14 }, (_, i) => ({ id: `mid-${i}`, difficulty: 2 })),
    ];
    const served = new Set<string>();
    for (let i = 0; i < 400; i += 1) served.add(selectNextItem(thin, 800, new Set())!.id);
    expect(served.size).toBeGreaterThanOrEqual(12);
  });

  it('falls back to the closest item when nothing sits in the band', () => {
    // A user far above the whole topic still has to be served something.
    const easyOnly = [{ id: 'e1', difficulty: 1 }];
    expect(selectNextItem(easyOnly, 2000, new Set())!.id).toBe('e1');
  });

  it('works through unseen items before repeating any', () => {
    const pool = Array.from({ length: 6 }, (_, i) => ({ id: `x${i}`, difficulty: 2 }));
    const lastSeen = new Map([['x0', 10], ['x1', 3]]);
    for (let i = 0; i < 100; i += 1) {
      const served = selectNextItem(pool, STARTING_RATING, new Set(), { lastSeen })!;
      expect(['x0', 'x1']).not.toContain(served.id);
    }
  });

  it('repeats the least recently seen item once everything has been seen', () => {
    const pool = Array.from({ length: 4 }, (_, i) => ({ id: `x${i}`, difficulty: 2 }));
    // x2 is the stalest; x0 was answered most recently.
    const lastSeen = new Map([['x0', 40], ['x1', 22], ['x2', 5], ['x3', 31]]);
    for (let i = 0; i < 50; i += 1) {
      expect(selectNextItem(pool, STARTING_RATING, new Set(), { lastSeen })!.id).toBe('x2');
    }
  });

  it('rotates the whole pool across sessions instead of resampling a few', () => {
    // Eight short sessions of three questions each, carrying attempt history between
    // them, must cover the topic rather than circling the same items.
    const pool = Array.from({ length: 12 }, (_, i) => ({ id: `x${i}`, difficulty: 2 }));
    const lastSeen = new Map<string, number>();
    let clock = 0;
    const covered = new Set<string>();

    for (let session = 0; session < 8; session += 1) {
      const seen = new Set<string>();
      for (let q = 0; q < 3; q += 1) {
        const item = selectNextItem(pool, STARTING_RATING, seen, { lastSeen })!;
        seen.add(item.id);
        lastSeen.set(item.id, (clock += 1));
        covered.add(item.id);
      }
    }
    expect(covered.size).toBe(pool.length);
  });

  it('is deterministic when given a seeded generator', () => {
    const sameLevel = Array.from({ length: 5 }, (_, i) => ({ id: `x${i}`, difficulty: 3 }));
    const first = selectNextItem(sameLevel, STARTING_RATING, new Set(), { rng: () => 0.6 });
    const again = selectNextItem(sameLevel, STARTING_RATING, new Set(), { rng: () => 0.6 });
    expect(first!.id).toBe(again!.id);
  });
});

describe('mastery', () => {
  it('is zero before any attempt', () => {
    expect(masteryOf({ rating: 1400, attempts: 0, correct: 0 })).toBe(0);
  });

  it('discounts a high rating built on very little evidence', () => {
    const thin = masteryOf({ rating: 1400, attempts: 2, correct: 2 });
    const proven = masteryOf({ rating: 1400, attempts: 20, correct: 17 });
    expect(proven).toBeGreaterThan(thin);
  });

  it('stays within 0 and 1', () => {
    expect(masteryOf({ rating: 3000, attempts: 100, correct: 100 })).toBeLessThanOrEqual(1);
    expect(masteryOf({ rating: 100, attempts: 100, correct: 0 })).toBeGreaterThanOrEqual(0);
  });
});
