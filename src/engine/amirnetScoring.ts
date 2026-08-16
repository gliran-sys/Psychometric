import { AMIRNET_SCALE, placementFor, type BlockTier, type PlacementLevel } from '../config/amirnet';
import type { BlockOutcome } from './mst';

/**
 * Estimates an AMIRNET score (50-150) from a routed block path.
 *
 * NITE does not publish its scoring function, and on a multi-stage test the score
 * depends on WHICH blocks you were routed into, not just how many questions you got
 * right — 4/4 on an easy block is worth less than 3/4 on a hard one. This model
 * reproduces that shape: each block scores around its tier's centre, adjusted by
 * accuracy within the block, then weighted by question count.
 *
 * It is an estimate for tracking progress, not an official score.
 */

/** Centre of the score band each tier can demonstrate. */
const TIER_CENTRE: Record<BlockTier, number> = {
  easy: 76,
  medium: 104,
  hard: 132,
};

/** How far accuracy within a block can move it off that centre. */
const TIER_SPREAD = 34;

export function scoreBlock(outcome: BlockOutcome): number {
  if (outcome.total === 0) return TIER_CENTRE[outcome.tier];
  const accuracy = outcome.correct / outcome.total;
  return TIER_CENTRE[outcome.tier] + (accuracy - 0.5) * TIER_SPREAD;
}

export function estimateScore(path: BlockOutcome[]): number {
  if (path.length === 0) return AMIRNET_SCALE.min;

  const totalQuestions = path.reduce((sum, b) => sum + b.total, 0);
  if (totalQuestions === 0) return AMIRNET_SCALE.min;

  const weighted = path.reduce((sum, b) => sum + scoreBlock(b) * b.total, 0) / totalQuestions;

  return Math.round(
    Math.min(AMIRNET_SCALE.max, Math.max(AMIRNET_SCALE.min, weighted)),
  );
}

export interface AmirnetEstimate {
  score: number;
  placement: PlacementLevel;
  /** Points still needed for exemption; 0 once cleared. */
  pointsToTarget: number;
  exempt: boolean;
}

export function evaluate(path: BlockOutcome[], targetScore: number): AmirnetEstimate {
  const score = estimateScore(path);
  return {
    score,
    placement: placementFor(score),
    pointsToTarget: Math.max(0, targetScore - score),
    exempt: score >= targetScore,
  };
}

/** Where the score sits on the 50-150 bar, as a 0-1 fraction, for the meter UI. */
export function scaleFraction(score: number): number {
  return (score - AMIRNET_SCALE.min) / (AMIRNET_SCALE.max - AMIRNET_SCALE.min);
}
