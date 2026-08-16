import { BLOCKS, ROUTING, TIER_ORDER, type BlockBlueprint, type BlockTier } from '../config/amirnet';
import type { EnglishItem } from '../content/schema';

/**
 * AMIRNET block-adaptive (multi-stage) routing.
 *
 * The real test does NOT adapt question by question. It serves a whole block at one
 * difficulty, scores that block as a unit, and uses the result to pick the difficulty
 * of the NEXT block. You cannot go back.
 *
 * Reproducing that faithfully matters for more than realism: it changes optimal
 * strategy. Because the first blocks decide which ladder you spend the rest of the
 * test on, early accuracy is worth more than late accuracy — a lesson an item-adaptive
 * simulation would quietly teach you wrong.
 */

export interface RoutedBlock {
  blueprint: BlockBlueprint;
  tier: BlockTier;
  items: EnglishItem[];
}

export interface BlockOutcome {
  blockId: string;
  tier: BlockTier;
  correct: number;
  total: number;
}

function tierIndex(tier: BlockTier): number {
  return TIER_ORDER.indexOf(tier);
}

function shiftTier(tier: BlockTier, delta: number): BlockTier {
  const next = Math.min(TIER_ORDER.length - 1, Math.max(0, tierIndex(tier) + delta));
  return TIER_ORDER[next];
}

/**
 * The routing decision after one block: a clean block promotes, a weak block demotes,
 * the middle band holds. Thresholds live in `config/amirnet.ts`.
 */
export function nextTier(currentTier: BlockTier, correct: number, total: number): BlockTier {
  if (total === 0) return currentTier;
  const accuracy = correct / total;
  if (accuracy >= ROUTING.promoteAtOrAbove) return shiftTier(currentTier, +1);
  if (accuracy < ROUTING.demoteBelow) return shiftTier(currentTier, -1);
  return currentTier;
}

/**
 * Draws `count` items of a topic at a tier. If that tier is thin, it widens to the
 * nearest tiers rather than serving a short block — a short block would silently
 * distort the routing maths. `validate:content` asserts every tier is deep enough that
 * this fallback stays a safety net rather than the normal path.
 */
export function assembleBlock(
  pool: EnglishItem[],
  blueprint: BlockBlueprint,
  tier: BlockTier,
  excludeIds: Set<string> = new Set(),
): EnglishItem[] {
  const byTopic = pool.filter((i) => i.topic === blueprint.topic && !excludeIds.has(i.id));

  const exact = byTopic.filter((i) => i.blockTier === tier);
  if (exact.length >= blueprint.questionCount) {
    return exact.slice(0, blueprint.questionCount);
  }

  // Widen outward from the requested tier, nearest first.
  const ordered = [...byTopic].sort(
    (a, b) =>
      Math.abs(tierIndex(a.blockTier) - tierIndex(tier)) -
      Math.abs(tierIndex(b.blockTier) - tierIndex(tier)),
  );
  return ordered.slice(0, blueprint.questionCount);
}

/**
 * Given the outcomes so far, returns the tier the next block should run at.
 * Exposed separately from `assembleBlock` so the simulation screen can route
 * incrementally as the user finishes each block, exactly as the real test does.
 */
export function tierForBlock(outcomes: BlockOutcome[]): BlockTier {
  return outcomes.reduce<BlockTier>(
    (tier, o) => nextTier(tier, o.correct, o.total),
    ROUTING.startingTier,
  );
}

/** The full ordered block list for a sitting. */
export function blockSequence(): BlockBlueprint[] {
  return BLOCKS;
}

/**
 * Where the routing turned against you — the single most useful piece of feedback
 * from a sitting, and something a flat percentage score cannot show.
 */
export function routingSummary(outcomes: BlockOutcome[]): {
  peakTier: BlockTier;
  finalTier: BlockTier;
  demotions: number;
  promotions: number;
  firstDemotionAt: number | null;
} {
  let tier = ROUTING.startingTier;
  let peak = tier;
  let demotions = 0;
  let promotions = 0;
  let firstDemotionAt: number | null = null;

  outcomes.forEach((o, idx) => {
    const next = nextTier(tier, o.correct, o.total);
    if (tierIndex(next) > tierIndex(tier)) promotions += 1;
    if (tierIndex(next) < tierIndex(tier)) {
      demotions += 1;
      if (firstDemotionAt === null) firstDemotionAt = idx;
    }
    tier = next;
    if (tierIndex(tier) > tierIndex(peak)) peak = tier;
  });

  return { peakTier: peak, finalTier: tier, demotions, promotions, firstDemotionAt };
}
