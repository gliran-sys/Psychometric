/**
 * Single source of truth for AMIRNET — the English proficiency test that, from the
 * December 2026 PET administration onward, is the ONLY measure Israeli institutions
 * use to assess English.
 *
 * Key facts driving this config:
 *   - AMIRNET replaced AMIR (paper) and AMIRAM (computerized) in May 2024.
 *   - It is BLOCK-ADAPTIVE (multi-stage), not item-adaptive: it opens with a block of
 *     moderate difficulty, scores that block as a unit, and picks the DIFFICULTY OF THE
 *     NEXT BLOCK from your performance. You cannot return to a completed block.
 *   - Question types: sentence completion, restatement, reading comprehension — with
 *     vocabulary embedded across all three rather than tested on its own.
 *   - Experimental/expanding components: listening, grammar, an auto-scored writing task.
 *     Text-to-speech of texts and questions became available to all examinees in April 2026.
 *   - Offered year-round with no fixed dates; retake permitted after 35 days.
 *   - Scored 50-150.
 *
 * Block sizes and timings below come from prep-provider reporting, not from NITE, and
 * are the numbers most likely to need correcting. They live here so nothing else has to.
 */

export type EnglishTopic =
  | 'sentence-completion'
  | 'restatement'
  | 'reading'
  | 'grammar'
  | 'listening';

/** The three rungs of the adaptive ladder a block can be drawn from. */
export type BlockTier = 'easy' | 'medium' | 'hard';

export const TIER_ORDER: BlockTier[] = ['easy', 'medium', 'hard'];

export const AMIRNET_SCALE = { min: 50, max: 150 } as const;

/**
 * The number that decides whether you take English courses for a year or none at all.
 * Institutions set their own cutoffs, so this is the default and the user can override
 * it with their target institution's threshold.
 */
export const EXEMPTION_SCORE = 134;

/** Minimum wait between sittings, in days. Drives the "eligible to retake" countdown. */
export const RETAKE_INTERVAL_DAYS = 35;

export interface BlockBlueprint {
  id: string;
  topic: EnglishTopic;
  label: string;
  questionCount: number;
  minutes: number;
  /**
   * Adaptive blocks have their tier chosen at runtime by the routing engine.
   * Non-adaptive blocks (the experimental ones) always run at medium tier.
   */
  adaptive: boolean;
  experimental: boolean;
}

/**
 * The routed sequence of a real sitting. The first block is always medium — that is
 * how a multi-stage test calibrates before it can route — which is exactly why early
 * accuracy matters disproportionately: it decides which ladder you spend the rest of
 * the test on.
 */
export const BLOCKS: BlockBlueprint[] = [
  { id: 'sc1', topic: 'sentence-completion', label: 'Sentence Completion I', questionCount: 4, minutes: 4, adaptive: true, experimental: false },
  { id: 'rs1', topic: 'restatement', label: 'Restatement I', questionCount: 3, minutes: 6, adaptive: true, experimental: false },
  { id: 'sc2', topic: 'sentence-completion', label: 'Sentence Completion II', questionCount: 4, minutes: 4, adaptive: true, experimental: false },
  { id: 'rc1', topic: 'reading', label: 'Reading Comprehension', questionCount: 5, minutes: 15, adaptive: true, experimental: false },
  { id: 'rs2', topic: 'restatement', label: 'Restatement II', questionCount: 3, minutes: 6, adaptive: true, experimental: false },
  { id: 'sc3', topic: 'sentence-completion', label: 'Sentence Completion III', questionCount: 4, minutes: 4, adaptive: true, experimental: false },
];

/** Components NITE is expanding into. Practised separately so they are not a surprise. */
export const EXPERIMENTAL_BLOCKS: BlockBlueprint[] = [
  { id: 'gr1', topic: 'grammar', label: 'Grammar', questionCount: 5, minutes: 5, adaptive: false, experimental: true },
  { id: 'ls1', topic: 'listening', label: 'Listening Comprehension', questionCount: 4, minutes: 8, adaptive: false, experimental: true },
];

export const TOTAL_MINUTES = BLOCKS.reduce((sum, b) => sum + b.minutes, 0);

export const ENGLISH_TOPIC_LABELS: Record<EnglishTopic, { en: string; he: string }> = {
  'sentence-completion': { en: 'Sentence Completion', he: 'השלמת משפטים' },
  restatement: { en: 'Restatement', he: 'ניסוח מחדש' },
  reading: { en: 'Reading Comprehension', he: 'הבנת הנקרא' },
  grammar: { en: 'Grammar', he: 'דקדוק' },
  listening: { en: 'Listening', he: 'הבנת הנשמע' },
};

/**
 * Routing thresholds: fraction of a block answered correctly that moves you up or down
 * a tier. A clean block promotes; a weak block demotes; the middle band holds.
 */
export const ROUTING = {
  promoteAtOrAbove: 0.75,
  demoteBelow: 0.4,
  startingTier: 'medium' as BlockTier,
};

export interface PlacementLevel {
  minScore: number;
  maxScore: number;
  he: string;
  en: string;
  /** What this placement actually costs you, which is the point of the whole track. */
  cost: string;
  exempt: boolean;
}

/**
 * The placement ladder. Exact cutoffs vary by institution — this is the common mapping
 * and the user can override the exemption threshold in settings.
 */
export const PLACEMENT_LADDER: PlacementLevel[] = [
  { minScore: 134, maxScore: 150, he: 'פטור', en: 'Full exemption', cost: 'אין קורסי אנגלית — היעד', exempt: true },
  { minScore: 120, maxScore: 133, he: 'מתקדמים ב׳', en: 'Advanced B', cost: 'קורס אחד, ~4 ש״ש', exempt: false },
  { minScore: 100, maxScore: 119, he: 'מתקדמים א׳', en: 'Advanced A', cost: '~2 קורסים, ~4 ש״ש', exempt: false },
  { minScore: 85, maxScore: 99, he: 'בסיסי', en: 'Basic', cost: '~3 קורסים, ~6 ש״ש', exempt: false },
  { minScore: 50, maxScore: 84, he: 'טרום-בסיסי', en: 'Pre-Basic', cost: '~6-8 ש״ש לאורך שנה', exempt: false },
];

export function placementFor(score: number): PlacementLevel {
  return (
    PLACEMENT_LADDER.find((l) => score >= l.minScore && score <= l.maxScore) ??
    PLACEMENT_LADDER[PLACEMENT_LADDER.length - 1]
  );
}
