import { describe, expect, it } from 'vitest';
import { estimateScore, evaluate, scaleFraction } from './amirnetScoring';
import { AMIRNET_SCALE, EXEMPTION_SCORE, placementFor } from '../config/amirnet';
import type { BlockOutcome } from './mst';

describe('AMIRNET score estimation', () => {
  it('stays inside the published 50-150 scale', () => {
    const floor = estimateScore([{ blockId: 'a', tier: 'easy', correct: 0, total: 4 }]);
    const ceiling = estimateScore([{ blockId: 'a', tier: 'hard', correct: 4, total: 4 }]);

    expect(floor).toBeGreaterThanOrEqual(AMIRNET_SCALE.min);
    expect(ceiling).toBeLessThanOrEqual(AMIRNET_SCALE.max);
  });

  it('rewards accuracy on a hard block more than accuracy on an easy one', () => {
    // This is the property that makes the estimate faithful to a multi-stage test:
    // 4/4 on an easy block demonstrates less ability than 3/4 on a hard one.
    const easyPerfect = estimateScore([{ blockId: 'a', tier: 'easy', correct: 4, total: 4 }]);
    const hardMostly = estimateScore([{ blockId: 'a', tier: 'hard', correct: 3, total: 4 }]);

    expect(hardMostly).toBeGreaterThan(easyPerfect);
  });

  it('weights blocks by how many questions they contain', () => {
    const longBlockDominates = estimateScore([
      { blockId: 'long', tier: 'hard', correct: 10, total: 10 },
      { blockId: 'short', tier: 'easy', correct: 0, total: 1 },
    ]);
    const shortBlockDominates = estimateScore([
      { blockId: 'short', tier: 'hard', correct: 1, total: 1 },
      { blockId: 'long', tier: 'easy', correct: 0, total: 10 },
    ]);

    expect(longBlockDominates).toBeGreaterThan(shortBlockDominates);
  });

  it('handles an empty path without producing a nonsense score', () => {
    expect(estimateScore([])).toBe(AMIRNET_SCALE.min);
  });
});

describe('placement ladder', () => {
  it('puts 133 and 134 on opposite sides of the exemption line', () => {
    // The single number the whole English track exists to clear.
    expect(EXEMPTION_SCORE).toBe(134);
    expect(placementFor(133).exempt).toBe(false);
    expect(placementFor(134).exempt).toBe(true);
  });

  it('covers the whole scale with no gaps', () => {
    for (let score = AMIRNET_SCALE.min; score <= AMIRNET_SCALE.max; score += 1) {
      expect(placementFor(score)).toBeDefined();
    }
  });
});

describe('evaluate', () => {
  it('reports the distance still to go', () => {
    const path: BlockOutcome[] = [{ blockId: 'a', tier: 'medium', correct: 2, total: 4 }];
    const result = evaluate(path, EXEMPTION_SCORE);

    expect(result.exempt).toBe(false);
    expect(result.pointsToTarget).toBe(EXEMPTION_SCORE - result.score);
  });

  it('reports zero distance once the target is cleared', () => {
    const path: BlockOutcome[] = [{ blockId: 'a', tier: 'hard', correct: 4, total: 4 }];
    const result = evaluate(path, EXEMPTION_SCORE);

    expect(result.exempt).toBe(true);
    expect(result.pointsToTarget).toBe(0);
  });

  it('honours an institution-specific threshold', () => {
    const path: BlockOutcome[] = [{ blockId: 'a', tier: 'medium', correct: 4, total: 4 }];
    const score = estimateScore(path);

    expect(evaluate(path, score).exempt).toBe(true);
    expect(evaluate(path, score + 5).exempt).toBe(false);
  });
});

describe('scaleFraction', () => {
  it('maps the scale ends onto 0 and 1 for the meter', () => {
    expect(scaleFraction(AMIRNET_SCALE.min)).toBe(0);
    expect(scaleFraction(AMIRNET_SCALE.max)).toBe(1);
  });
});
