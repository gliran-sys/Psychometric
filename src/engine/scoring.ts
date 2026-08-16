import {
  DOMAIN_WEIGHTS,
  ESSAY_SHARE_OF_VERBAL,
  SCORE_SCALE,
  type Domain,
} from '../config/blueprint';

/**
 * Estimates a PET score under the two-domain (December 2026) format.
 *
 * The published facts this is built on:
 *   - Domain scores run 50-150 with a mean near 100.
 *   - The general score runs 200-800 with a mean near 550.
 *   - With English removed, Verbal and Quantitative are weighted 50/50.
 *   - The writing task is scored inside Verbal and is worth a quarter of it.
 *
 * NITE's actual equating is unpublished and form-specific, so the accuracy -> domain
 * mapping below is a linear approximation. It is calibrated to be honest about
 * direction and magnitude, not to predict your exact score.
 */

export const DOMAIN_SCALE = { min: 50, max: 150 } as const;

/** Mean domain score; also the anchor for the general-score conversion. */
const DOMAIN_MEAN = 100;

/** Mean general score, and points of general score per point of domain score. */
const GENERAL_MEAN = 550;
const GENERAL_PER_DOMAIN_POINT = 5;

const clampDomain = (v: number) =>
  Math.min(DOMAIN_SCALE.max, Math.max(DOMAIN_SCALE.min, v));

/** Raw accuracy (0-1) -> domain score (50-150). 50% correct maps to the mean. */
export function accuracyToDomainScore(accuracy: number): number {
  return clampDomain(DOMAIN_SCALE.min + accuracy * (DOMAIN_SCALE.max - DOMAIN_SCALE.min));
}

/**
 * The essay is self-scored on NITE's two dimensions, content and language, 1-6 each.
 * Their average maps onto the same 50-150 domain scale so it can be blended into Verbal.
 */
export function essayToDomainScore(contentScore: number, languageScore: number): number {
  const avg = (contentScore + languageScore) / 2;
  return clampDomain(DOMAIN_SCALE.min + ((avg - 1) / 5) * (DOMAIN_SCALE.max - DOMAIN_SCALE.min));
}

/**
 * Verbal blends the multiple-choice sections with the writing task at 75/25.
 * With no essay scored yet, the MC score stands alone rather than being penalised —
 * an unwritten essay is missing data, not a zero.
 */
export function verbalDomainScore(mcAccuracy: number, essayDomain: number | null): number {
  const mc = accuracyToDomainScore(mcAccuracy);
  if (essayDomain === null) return mc;
  return clampDomain(mc * (1 - ESSAY_SHARE_OF_VERBAL) + essayDomain * ESSAY_SHARE_OF_VERBAL);
}

/** Weighted domain scores -> general score (200-800). */
export function generalScore(domainScores: Record<Domain, number>): number {
  const weighted =
    domainScores.verbal * DOMAIN_WEIGHTS.verbal + domainScores.quant * DOMAIN_WEIGHTS.quant;

  const general = GENERAL_MEAN + (weighted - DOMAIN_MEAN) * GENERAL_PER_DOMAIN_POINT;

  return Math.round(Math.min(SCORE_SCALE.max, Math.max(SCORE_SCALE.min, general)));
}

export interface ScoreProjection {
  general: number;
  verbal: number;
  quant: number;
  /** True when the projection is based on too little practice to mean much yet. */
  provisional: boolean;
}

/**
 * The dashboard's headline number. Built from accumulated drill accuracy per domain
 * plus the most recent self-scored essay.
 */
export function projectScore(input: {
  verbalCorrect: number;
  verbalAttempts: number;
  quantCorrect: number;
  quantAttempts: number;
  latestEssay: { contentScore: number; languageScore: number } | null;
}): ScoreProjection {
  const verbalAccuracy = input.verbalAttempts > 0 ? input.verbalCorrect / input.verbalAttempts : 0.5;
  const quantAccuracy = input.quantAttempts > 0 ? input.quantCorrect / input.quantAttempts : 0.5;

  const essayDomain = input.latestEssay
    ? essayToDomainScore(input.latestEssay.contentScore, input.latestEssay.languageScore)
    : null;

  const verbal = verbalDomainScore(verbalAccuracy, essayDomain);
  const quant = accuracyToDomainScore(quantAccuracy);

  return {
    general: generalScore({ verbal, quant }),
    verbal: Math.round(verbal),
    quant: Math.round(quant),
    // Under ~30 attempts per domain the estimate is mostly noise; the UI says so.
    provisional: input.verbalAttempts < 30 || input.quantAttempts < 30,
  };
}

/** Where a general score sits on the 200-800 bar, as a 0-1 fraction, for the meter UI. */
export function scaleFraction(score: number): number {
  return (score - SCORE_SCALE.min) / (SCORE_SCALE.max - SCORE_SCALE.min);
}

/**
 * Approximate percentile for a general score. Assumes the roughly normal published
 * distribution (mean ~550, sd ~100) — indicative only.
 */
export function approximatePercentile(general: number): number {
  const z = (general - GENERAL_MEAN) / 100;
  // Abramowitz & Stegun normal CDF approximation.
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  const cdf = z > 0 ? 1 - p : p;
  return Math.round(cdf * 100);
}
