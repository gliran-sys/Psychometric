import { describe, expect, it } from 'vitest';
import { assembleBlock, nextTier, routingSummary, tierForBlock, type BlockOutcome } from './mst';
import { BLOCKS, ROUTING } from '../config/amirnet';
import { ENGLISH_ITEMS } from '../content';

/**
 * These tests guard the thing that makes AMIRNET different from the PET: adaptation
 * happens per BLOCK, and the early blocks decide which difficulty ladder the rest of
 * the test runs on. If routing breaks, the simulation silently teaches wrong strategy.
 */

describe('block routing', () => {
  it('promotes a tier after a clean block', () => {
    expect(nextTier('medium', 4, 4)).toBe('hard');
    expect(nextTier('easy', 3, 4)).toBe('medium');
  });

  it('demotes a tier after a weak block', () => {
    expect(nextTier('medium', 1, 4)).toBe('easy');
    expect(nextTier('hard', 0, 4)).toBe('medium');
  });

  it('holds the tier in the middle band', () => {
    expect(nextTier('medium', 2, 4)).toBe('medium');
  });

  it('cannot route beyond the ends of the ladder', () => {
    expect(nextTier('hard', 4, 4)).toBe('hard');
    expect(nextTier('easy', 0, 4)).toBe('easy');
  });

  it('starts at the calibration tier before any evidence exists', () => {
    // A multi-stage test has to open somewhere neutral — that is why the first block
    // is always medium, and why early accuracy matters disproportionately.
    expect(tierForBlock([])).toBe(ROUTING.startingTier);
  });

  it('compounds routing decisions across blocks', () => {
    const perfect: BlockOutcome[] = [
      { blockId: 'sc1', tier: 'medium', correct: 4, total: 4 },
      { blockId: 'rs1', tier: 'hard', correct: 3, total: 3 },
    ];
    expect(tierForBlock(perfect)).toBe('hard');

    const collapsing: BlockOutcome[] = [
      { blockId: 'sc1', tier: 'medium', correct: 1, total: 4 },
      { blockId: 'rs1', tier: 'easy', correct: 0, total: 3 },
    ];
    expect(tierForBlock(collapsing)).toBe('easy');
  });
});

describe('routingSummary', () => {
  it('reports where the routing first turned against you', () => {
    const path: BlockOutcome[] = [
      { blockId: 'sc1', tier: 'medium', correct: 4, total: 4 }, // promote
      { blockId: 'rs1', tier: 'hard', correct: 0, total: 3 },   // demote
      { blockId: 'sc2', tier: 'medium', correct: 2, total: 4 }, // hold
    ];
    const summary = routingSummary(path);

    expect(summary.promotions).toBe(1);
    expect(summary.demotions).toBe(1);
    expect(summary.peakTier).toBe('hard');
    expect(summary.finalTier).toBe('medium');
    expect(summary.firstDemotionAt).toBe(1);
  });

  it('reports no demotion on a clean run', () => {
    const summary = routingSummary([{ blockId: 'sc1', tier: 'medium', correct: 4, total: 4 }]);
    expect(summary.firstDemotionAt).toBeNull();
  });
});

describe('block assembly against the real content bank', () => {
  it('fills every block at every tier without falling back', () => {
    // `validate:content` enforces the same rule at build time; this asserts it holds
    // through the assembly path the simulation actually uses.
    BLOCKS.forEach((blueprint) => {
      (['easy', 'medium', 'hard'] as const).forEach((tier) => {
        const block = assembleBlock(ENGLISH_ITEMS, blueprint, tier);
        expect(block).toHaveLength(blueprint.questionCount);
        block.forEach((item) => {
          expect(item.topic).toBe(blueprint.topic);
          expect(item.blockTier).toBe(tier);
        });
      });
    });
  });

  it('does not reuse items already served earlier in the sitting', () => {
    const blueprint = BLOCKS[0];
    const first = assembleBlock(ENGLISH_ITEMS, blueprint, 'medium');
    const used = new Set(first.map((i) => i.id));
    const second = assembleBlock(ENGLISH_ITEMS, blueprint, 'medium', used);

    second.forEach((item) => expect(used.has(item.id)).toBe(false));
  });
});
