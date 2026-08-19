import { describe, expect, it } from 'vitest';
import analogies from '../content/items/verbal/analogies.json';
import verbalSentenceCompletion from '../content/items/verbal/sentence-completion.json';
import logic from '../content/items/verbal/logic.json';
import verbalReading from '../content/items/verbal/reading.json';
import algebra from '../content/items/quant/algebra.json';
import geometry from '../content/items/quant/geometry.json';
import wordProblems from '../content/items/quant/word-problems.json';
import ratiosPercents from '../content/items/quant/ratios-percents.json';
import dataInterpretation from '../content/items/quant/data-interpretation.json';
import enSentenceCompletion from '../content/items/english/sentence-completion.json';
import enRestatement from '../content/items/english/restatement.json';
import enReading from '../content/items/english/reading.json';
import enGrammar from '../content/items/english/grammar.json';
import enListening from '../content/items/english/listening.json';
import { PET_ITEMS, ENGLISH_ITEMS, itemById } from '../content';
import type { Item, PetItem } from '../content/schema';
import { PERMUTATIONS, hashId, permutationFor, presentItem } from './optionOrder';

/**
 * The bug this file exists to prevent: every item in the bank is authored with the
 * correct answer written first, and for a while the app served them that way — you
 * could score 100% on any drill, boss fight or mock by tapping option א without
 * reading a word. So these tests are not "does the shuffle run"; they check that the
 * answer genuinely moves, that it moves evenly, and that nothing rides along with it
 * into the wrong slot.
 *
 * Every assertion is deterministic. The permutation is a pure function of the item id,
 * so a distribution assertion either holds for a given bank or it does not — there is
 * no seed to get lucky with and nothing here can flake.
 */

/** The authored items, straight off disk — the pre-shuffle form. */
const RAW = [
  ...analogies,
  ...verbalSentenceCompletion,
  ...logic,
  ...verbalReading,
  ...algebra,
  ...geometry,
  ...wordProblems,
  ...ratiosPercents,
  ...dataInterpretation,
  ...enSentenceCompletion,
  ...enRestatement,
  ...enReading,
  ...enGrammar,
  ...enListening,
] as unknown as Item[];

const SERVED = [...PET_ITEMS, ...ENGLISH_ITEMS] as Item[];

function positionCounts(items: Item[]): number[] {
  const counts = [0, 0, 0, 0];
  for (const item of items) counts[item.correctIndex] += 1;
  return counts;
}

/** Pearson's chi-square against a uniform expectation over four positions. */
function chiSquare(counts: number[]): number {
  const n = counts.reduce((a, b) => a + b, 0);
  const expected = n / 4;
  return counts.reduce((sum, c) => sum + (c - expected) ** 2 / expected, 0);
}

describe('the authored bank', () => {
  it('really does put the correct answer first every time', () => {
    // Not a wish — a statement of fact about the JSON, and the reason the runtime
    // shuffle is load-bearing rather than decorative. If authoring ever changes, this
    // test should be updated, but the shuffle stays correct either way.
    expect(RAW.length).toBeGreaterThan(300);
    expect(RAW.every((item) => item.correctIndex === 0)).toBe(true);
  });
});

describe('permutations', () => {
  it('enumerates all 24 arrangements of four options exactly once', () => {
    expect(PERMUTATIONS).toHaveLength(24);
    expect(new Set(PERMUTATIONS.map((p) => p.join(''))).size).toBe(24);
    for (const p of PERMUTATIONS) expect([...p].sort()).toEqual([0, 1, 2, 3]);
  });

  it('is a pure function of the item id', () => {
    const first = permutationFor('al-001');
    for (let i = 0; i < 50; i += 1) expect(permutationFor('al-001')).toEqual(first);
    expect(hashId('al-001')).toBe(hashId('al-001'));
  });

  it('gives near-sequential ids unrelated arrangements', () => {
    // Ids in this bank differ only in their last characters. A weak hash would walk
    // through the permutation list in step with them, which is a pattern a test-taker
    // could learn even though each individual item looks shuffled.
    const seq = ['al-001', 'al-002', 'al-003', 'al-004', 'al-005', 'al-006'].map((id) =>
      permutationFor(id).join(''),
    );
    expect(new Set(seq).size).toBeGreaterThanOrEqual(5);
  });

  it('reaches every arrangement across a large id space', () => {
    const used = new Set<string>();
    for (let i = 0; i < 5000; i += 1) used.add(permutationFor(`itm-${i}`).join(''));
    expect(used.size).toBe(24);
  });
});

describe('presentItem', () => {
  const sample: PetItem = {
    id: 'test-042',
    domain: 'quant',
    topic: 'algebra',
    difficulty: 3,
    stem: 'stem',
    options: ['right', 'wrong-a', 'wrong-b', 'wrong-c'],
    correctIndex: 0,
    solutionSteps: ['step'],
    techniqueTags: [],
    targetTimeSec: 60,
    trapExplanations: { '1': 'why a', '2': 'why b', '3': 'why c' },
  };

  it('keeps the correct answer pointing at the same text', () => {
    const shown = presentItem(sample);
    expect(shown.options[shown.correctIndex]).toBe('right');
  });

  it('carries each trap explanation with the option it explains', () => {
    const shown = presentItem(sample);
    for (let i = 0; i < 4; i += 1) {
      if (i === shown.correctIndex) continue;
      const optionText = shown.options[i];
      const expected = { 'wrong-a': 'why a', 'wrong-b': 'why b', 'wrong-c': 'why c' }[optionText];
      expect(shown.trapExplanations[String(i)]).toBe(expected);
    }
  });

  it('leaves no explanation on the correct option', () => {
    const shown = presentItem(sample);
    expect(shown.trapExplanations[String(shown.correctIndex)]).toBeUndefined();
    expect(Object.keys(shown.trapExplanations)).toHaveLength(3);
  });

  it('does not mutate the item it was given', () => {
    const before = JSON.stringify(sample);
    presentItem(sample);
    expect(JSON.stringify(sample)).toBe(before);
  });

  it('is idempotent in output for the same id, so a review shows what the drill showed', () => {
    expect(presentItem(sample)).toEqual(presentItem(sample));
  });

  it('leaves every other field untouched', () => {
    const shown = presentItem(sample);
    expect(shown.stem).toBe(sample.stem);
    expect(shown.solutionSteps).toEqual(sample.solutionSteps);
    expect(shown.targetTimeSec).toBe(sample.targetTimeSec);
    expect(shown.difficulty).toBe(sample.difficulty);
  });
});

describe('the whole bank, as the app serves it', () => {
  it('preserves each item exactly, only reordered', () => {
    expect(SERVED).toHaveLength(RAW.length);
    const rawById = new Map(RAW.map((i) => [i.id, i]));

    for (const shown of SERVED) {
      const raw = rawById.get(shown.id);
      expect(raw, `no authored item for ${shown.id}`).toBeDefined();
      if (!raw) continue;

      // Same four options, in some order.
      expect([...shown.options].sort()).toEqual([...raw.options].sort());
      // The answer is still the answer.
      expect(shown.options[shown.correctIndex]).toBe(raw.options[raw.correctIndex]);
      // Every distractor kept its own explanation.
      expect(Object.keys(shown.trapExplanations)).toHaveLength(3);
      for (const [index, text] of Object.entries(shown.trapExplanations)) {
        const authoredIndex = raw.options.indexOf(shown.options[Number(index)]);
        expect(text).toBe(raw.trapExplanations[String(authoredIndex)]);
      }
      expect(shown.trapExplanations[String(shown.correctIndex)]).toBeUndefined();
    }
  });

  it('no longer answers to "always pick the first option"', () => {
    // The literal user-reported bug, as a regression test: the strategy that used to
    // score 100% must now score about a quarter.
    const alwaysFirst = SERVED.filter((i) => i.correctIndex === 0).length / SERVED.length;
    expect(alwaysFirst).toBeLessThan(0.35);
    expect(alwaysFirst).toBeGreaterThan(0.15);
  });

  it('uses all four positions at a rate close to a quarter each', () => {
    const counts = positionCounts(SERVED);
    for (const count of counts) {
      expect(count / SERVED.length).toBeGreaterThan(0.18);
      expect(count / SERVED.length).toBeLessThan(0.32);
    }
    // df = 3; 12.84 is the p = 0.005 critical value. A bank that trips this is skewed
    // enough that a test-taker could exploit it.
    expect(chiSquare(counts)).toBeLessThan(12.84);
  });

  it('is not skewed inside any one topic either', () => {
    // A per-topic skew matters even when the whole bank looks flat, because a drill
    // serves one topic at a time — that is exactly the screen the bug was found on.
    const byTopic = new Map<string, Item[]>();
    for (const item of SERVED) {
      byTopic.set(item.topic, [...(byTopic.get(item.topic) ?? []), item]);
    }

    for (const [topic, items] of byTopic) {
      if (items.length < 15) continue; // too few to say anything about
      const counts = positionCounts(items);
      const worst = Math.max(...counts) / items.length;
      expect(worst, `${topic} leans on one position (${counts.join('/')})`).toBeLessThan(0.5);
      expect(Math.min(...counts), `${topic} never uses one position`).toBeGreaterThan(0);
    }
  });

  it('converges on an exact quarter over a large synthetic bank', () => {
    // The real bank is only ~300 items, so sampling noise sets the tolerance above.
    // This checks the mechanism itself, where the law of large numbers applies.
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < 40000; i += 1) counts[permutationFor(`syn-${i}`).indexOf(0)] += 1;
    for (const count of counts) expect(count / 40000).toBeCloseTo(0.25, 2);
  });
});

describe('the served bank is what the rest of the app reads', () => {
  it('serves the shuffled item through itemById, so review matches the drill', () => {
    const served = SERVED[0];
    expect(itemById(served.id)?.options).toEqual(served.options);
    expect(itemById(served.id)?.correctIndex).toBe(served.correctIndex);
  });

  it('leaves no path back to the authored order', () => {
    // If these matched, some screen could still be rendering the raw arrangement.
    const moved = SERVED.filter((i) => i.correctIndex !== 0).length;
    expect(moved).toBeGreaterThan(SERVED.length * 0.6);
  });
});
