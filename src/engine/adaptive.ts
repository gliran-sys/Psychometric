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

/**
 * The success band an item must fall in to be worth serving.
 *
 * `targetItemRating` names the single ideal difficulty, but serving only the tier
 * closest to it collapses the effective pool to one difficulty band of one topic —
 * around nine items in a typical topic here — and no amount of shuffling hides that.
 * Admitting anything the user would get right between 55% and 90% of the time widens
 * that to two or three bands while staying inside productive struggle. On a
 * hand-authored bank, mild difficulty imprecision costs far less than repetition does.
 */
export const PRACTICE_BAND = { min: 0.55, max: 0.9 };

/**
 * The widest band selection will ever reach into, and only to fill out a thin pool.
 *
 * At the extremes of the rating range the practice band can collapse onto a single
 * difficulty level — a struggling user drilling analogies would be served from six
 * items and start repeating within one sitting. The fix is to reach outwards, but not
 * without limit: an item the user has a one-in-ten chance on teaches nothing and an
 * item they cannot miss wastes the question.
 */
export const ACCEPTABLE_BAND = { min: 0.35, max: 0.97 };

/** The smallest pool selection will work from before it starts reaching outwards. */
const MIN_POOL = 12;

export interface SelectOptions {
  /** Never serve this item — used to avoid repeating a question back to back. */
  avoidId?: string;
  /** Injectable for deterministic tests. */
  rng?: () => number;
  /**
   * Attempt recency by item id, higher meaning more recently answered. Supplying it
   * turns selection into a rotation: unseen items first, then least recently seen.
   */
  lastSeen?: Map<string, number>;
}

/**
 * Picks the next item to serve.
 *
 * Three filters in order: drop anything already seen in this session, keep what sits in
 * the productive success band, then rotate by recency so the bank is worked through
 * rather than sampled. Each stage falls back to the previous one rather than returning
 * nothing, so a thin topic still drills instead of dead-ending.
 */
export function selectNextItem<T extends Selectable>(
  pool: T[],
  userRating: number,
  seenIds: Set<string>,
  { avoidId, rng = Math.random, lastSeen }: SelectOptions = {},
): T | null {
  const allowed = avoidId === undefined ? pool : pool.filter((i) => i.id !== avoidId);
  if (allowed.length === 0) return null;

  const unseen = allowed.filter((i) => !seenIds.has(i.id));
  const candidates = unseen.length > 0 ? unseen : allowed;

  const within = (item: T, { min, max }: { min: number; max: number }) => {
    const p = expectedScore(userRating, itemRating(item.difficulty));
    return p >= min && p <= max;
  };

  const target = targetItemRating(userRating);
  const distance = (item: T) => Math.abs(itemRating(item.difficulty) - target);

  const preferred = candidates.filter((i) => within(i, PRACTICE_BAND));
  let band = preferred;

  if (band.length < MIN_POOL) {
    // Reach outwards, nearest first, but never past the acceptable band.
    const extra = candidates
      .filter((i) => !preferred.includes(i) && within(i, ACCEPTABLE_BAND))
      .sort((a, b) => distance(a) - distance(b));
    band = [...preferred, ...extra].slice(0, Math.max(MIN_POOL, preferred.length));
  }

  // Nothing acceptable at all: the user is far outside this topic's range, but the
  // drill still has to serve something.
  if (band.length === 0) {
    const closest = Math.min(...candidates.map(distance));
    band = candidates.filter((i) => distance(i) === closest);
  }

  const pick = (from: T[]) => from[Math.floor(rng() * from.length)] ?? from[0];
  if (!lastSeen) return pick(band);

  // Work through everything unseen before repeating anything, then repeat oldest-first.
  // Without this a drill re-samples the same handful across sessions while items the
  // user has never met sit untouched.
  const never = band.filter((i) => !lastSeen.has(i.id));
  if (never.length > 0) return pick(never);

  const oldest = Math.min(...band.map((i) => lastSeen.get(i.id)!));
  return pick(band.filter((i) => lastSeen.get(i.id) === oldest));
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
