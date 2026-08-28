/**
 * Item-level adaptive selection for Track A (PET) drills.
 *
 * Elo, not IRT: with a hand-authored bank there is no calibration data to fit a real
 * item-response model, and Elo converges usefully within a few dozen attempts, which
 * is the timescale that matters here.
 *
 * NOTE: this is deliberately NOT what AMIRNET does. AMIRNET adapts per *block*; see
 * `mst.ts`. Using this engine to simulate AMIRNET would teach the wrong exam strategy.
 */

export const STARTING_RATING = 1000;

/** How far a single result moves the rating. High enough to converge fast on a small bank. */
const K_FACTOR = 32;

/**
 * Maps an authored difficulty (1-5) onto the Elo scale. A level-3 item sits at the
 * starting rating, so a fresh user meets medium items first.
 */
export function itemRating(difficulty: number): number {
  return STARTING_RATING + (difficulty - 3) * 180;
}

/** Probability the user answers an item of this rating correctly. */
export function expectedScore(userRating: number, itemDifficultyRating: number): number {
  return 1 / (1 + 10 ** ((itemDifficultyRating - userRating) / 400));
}

export function updateRating(userRating: number, difficulty: number, correct: boolean): number {
  const expected = expectedScore(userRating, itemRating(difficulty));
  return Math.round(userRating + K_FACTOR * ((correct ? 1 : 0) - expected));
}

/**
 * Target success rate for served items. Kept below 1 and well above 0.5: too easy and
 * nothing is learned, too hard and the drill just demoralises. ~0.72 keeps the user in
 * the productive-struggle band while still finishing most items.
 */
const TARGET_SUCCESS = 0.72;

/** The item rating that yields TARGET_SUCCESS for this user. */
export function targetItemRating(userRating: number): number {
  return userRating - 400 * Math.log10(TARGET_SUCCESS / (1 - TARGET_SUCCESS));
}

export interface Selectable {
  id: string;
  difficulty: number;
}

export interface SelectOptions {
  /** Never serve this item — used to avoid repeating a question back to back. */
  avoidId?: string;
  /** Injectable for deterministic tests. */
  rng?: () => number;
}

/**
 * Picks the next item: closest to the target rating, excluding anything already seen
 * in this session. Falls back to reusing seen items only when the pool is exhausted,
 * so a thin topic still drills rather than dead-ends.
 *
 * Among items that are *equally* close to the target, the choice is random. Difficulty
 * is quantised to five levels, so a topic usually offers several equally suitable
 * items and picking the first every time made each drill session replay the previous
 * one in the same order. Randomising the tie does not touch adaptivity — every
 * candidate here sits at the same distance from the target rating.
 */
export function selectNextItem<T extends Selectable>(
  pool: T[],
  userRating: number,
  seenIds: Set<string>,
  { avoidId, rng = Math.random }: SelectOptions = {},
): T | null {
  const allowed = avoidId === undefined ? pool : pool.filter((i) => i.id !== avoidId);
  if (allowed.length === 0) return null;

  const unseen = allowed.filter((i) => !seenIds.has(i.id));
  const candidates = unseen.length > 0 ? unseen : allowed;
  const target = targetItemRating(userRating);

  const distance = (item: T) => Math.abs(itemRating(item.difficulty) - target);
  const closest = Math.min(...candidates.map(distance));
  const tied = candidates.filter((item) => distance(item) === closest);

  return tied[Math.floor(rng() * tied.length)] ?? tied[0];
}

/** Rough mastery readout (0-1) for the skill tree, blending rating and sample size. */
export function masteryOf(ability: { rating: number; attempts: number; correct: number }): number {
  if (ability.attempts === 0) return 0;
  // Ratings span roughly 600-1600 in practice; normalise that band onto 0-1.
  const ratingComponent = Math.min(1, Math.max(0, (ability.rating - 700) / 700));
  // Discount until there is enough evidence — 12 attempts is treated as full confidence.
  const confidence = Math.min(1, ability.attempts / 12);
  return ratingComponent * confidence;
}
