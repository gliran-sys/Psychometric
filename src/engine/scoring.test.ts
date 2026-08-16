import { describe, expect, it } from 'vitest';
import {
  accuracyToDomainScore,
  essayToDomainScore,
  generalScore,
  projectScore,
  verbalDomainScore,
} from './scoring';
import { DOMAIN_WEIGHTS, ESSAY_SHARE_OF_VERBAL } from '../config/blueprint';

describe('domain scoring', () => {
  it('maps 50% accuracy to the mean domain score', () => {
    expect(accuracyToDomainScore(0.5)).toBe(100);
  });

  it('maps the accuracy extremes to the ends of the 50-150 scale', () => {
    expect(accuracyToDomainScore(0)).toBe(50);
    expect(accuracyToDomainScore(1)).toBe(150);
  });
});

describe('general score under the two-domain format', () => {
  it('weights verbal and quantitative equally', () => {
    // The whole point of the December 2026 reform for scoring purposes: with English
    // gone, the two domains split the score 50/50 instead of 40/40/20.
    expect(DOMAIN_WEIGHTS.verbal).toBe(0.5);
    expect(DOMAIN_WEIGHTS.quant).toBe(0.5);

    // Swapping the two domain scores must not change the general score.
    expect(generalScore({ verbal: 120, quant: 80 })).toBe(generalScore({ verbal: 80, quant: 120 }));
  });

  it('puts an average performance near the middle of the 200-800 scale', () => {
    expect(generalScore({ verbal: 100, quant: 100 })).toBe(550);
  });

  it('reaches the top of the scale at maximum domain scores', () => {
    expect(generalScore({ verbal: 150, quant: 150 })).toBe(800);
  });

  it('never leaves the published 200-800 bounds', () => {
    expect(generalScore({ verbal: 50, quant: 50 })).toBeGreaterThanOrEqual(200);
    expect(generalScore({ verbal: 150, quant: 150 })).toBeLessThanOrEqual(800);
  });
});

describe('the writing task inside the verbal domain', () => {
  it('is worth a quarter of verbal', () => {
    expect(ESSAY_SHARE_OF_VERBAL).toBe(0.25);
  });

  it('blends the essay with the multiple-choice sections at 75/25', () => {
    const mcOnly = verbalDomainScore(0.5, null); // 100
    const withPerfectEssay = verbalDomainScore(0.5, 150);
    expect(withPerfectEssay).toBeCloseTo(100 * 0.75 + 150 * 0.25, 5);
    expect(withPerfectEssay).toBeGreaterThan(mcOnly);
  });

  it('treats an unwritten essay as missing data rather than a zero', () => {
    // Penalising a not-yet-attempted essay would make the projection lie downward for
    // weeks and discourage exactly the practice that is most valuable.
    expect(verbalDomainScore(0.8, null)).toBe(accuracyToDomainScore(0.8));
  });

  it('maps the 1-6 rubric onto the domain scale', () => {
    expect(essayToDomainScore(1, 1)).toBe(50);
    expect(essayToDomainScore(6, 6)).toBe(150);
    expect(essayToDomainScore(3, 4)).toBeGreaterThan(50);
  });

  it('carries 12.5% of the weight of the composite score', () => {
    // Essay = 25% of verbal, verbal = 50% of the total, so the essay alone carries
    // 12.5% of the weight. This is the claim the Essay Workshop makes to the user.
    const essayWeight = ESSAY_SHARE_OF_VERBAL * DOMAIN_WEIGHTS.verbal;
    expect(essayWeight).toBeCloseTo(0.125, 5);

    // Verify it against the scoring path: moving the essay across its full 50-150 range
    // must shift the weighted domain score by exactly that share of the domain range.
    const worstVerbal = verbalDomainScore(0.5, 50);
    const bestVerbal = verbalDomainScore(0.5, 150);
    const weightedShift = (bestVerbal - worstVerbal) * DOMAIN_WEIGHTS.verbal;
    expect(weightedShift / (150 - 50)).toBeCloseTo(essayWeight, 5);
  });

  it('translates that weight into a real swing on the 200-800 scale', () => {
    // The weight share and the share of the *displayed* range are not the same number:
    // a domain point is worth 5 general points, but the general range (600) is wider
    // than 5x the domain range (500). The honest figure for "how many points is the
    // essay worth to me" is the swing itself, not a percentage of the bar.
    const worst = generalScore({ verbal: verbalDomainScore(0.5, 50), quant: 100 });
    const best = generalScore({ verbal: verbalDomainScore(0.5, 150), quant: 100 });

    expect(best - worst).toBeGreaterThan(50);
  });
});

describe('projectScore', () => {
  it('flags a projection as provisional until there is enough evidence', () => {
    const thin = projectScore({
      verbalCorrect: 5, verbalAttempts: 8, quantCorrect: 4, quantAttempts: 8, latestEssay: null,
    });
    expect(thin.provisional).toBe(true);

    const thick = projectScore({
      verbalCorrect: 20, verbalAttempts: 30, quantCorrect: 18, quantAttempts: 30, latestEssay: null,
    });
    expect(thick.provisional).toBe(false);
  });

  it('assumes an average starting point with no attempts at all', () => {
    const blank = projectScore({
      verbalCorrect: 0, verbalAttempts: 0, quantCorrect: 0, quantAttempts: 0, latestEssay: null,
    });
    expect(blank.general).toBe(550);
  });
});
