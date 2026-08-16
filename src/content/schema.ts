import { z } from 'zod';

/**
 * Every piece of exam content is data validated at build time, so the bank can grow
 * without touching app code. `npm run validate:content` runs these schemas over every
 * JSON file — a malformed item fails CI rather than appearing mid-drill.
 */

export const difficultySchema = z.number().int().min(1).max(5);

/**
 * `trapExplanations` is required, not optional. Knowing why a wrong answer LOOKS right
 * is what converts a review session into a technique lesson — it is the highest-value
 * field in the whole bank, so the schema refuses items without it.
 */
const baseItem = {
  id: z.string().min(1),
  topic: z.string().min(1),
  subtopic: z.string().optional(),
  difficulty: difficultySchema,
  stem: z.string().min(1),
  /** Passage shared by a reading-comprehension set; repeated on each of its items. */
  passage: z.string().optional(),
  options: z.array(z.string().min(1)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  solutionSteps: z.array(z.string().min(1)).min(1),
  techniqueTags: z.array(z.string()).default([]),
  targetTimeSec: z.number().int().positive(),
  trapExplanations: z.record(z.string(), z.string()),
};

export const petItemSchema = z.object({
  ...baseItem,
  domain: z.enum(['verbal', 'quant']),
});

export const englishItemSchema = z.object({
  ...baseItem,
  domain: z.literal('english'),
  /**
   * Which rung of the adaptive ladder this item belongs to. Required for AMIRNET
   * because the simulation must assemble whole blocks at a single tier — without it
   * the block routing cannot be reproduced faithfully.
   */
  blockTier: z.enum(['easy', 'medium', 'hard']),
  /**
   * Listening items only. Spoken via the browser's Web Speech API rather than hosted
   * audio, mirroring the text-to-speech NITE rolled out in April 2026 and keeping the
   * app fully static.
   */
  audioText: z.string().optional(),
});

export const itemSchema = z.union([petItemSchema, englishItemSchema]);

export const vocabEntrySchema = z.object({
  id: z.string().min(1),
  term: z.string().min(1),
  meaning: z.string().min(1),
  example: z.string().optional(),
  /** Words that show up as distractors for this one — the actual test difficulty. */
  confusableWith: z.array(z.string()).default([]),
  difficulty: difficultySchema,
});

export const lessonSchema = z.object({
  id: z.string().min(1),
  track: z.enum(['pet', 'amirnet']),
  topic: z.string().min(1),
  title: z.string().min(1),
  /** Lessons are capped at 7 minutes by design: technique download, not a textbook. */
  minutes: z.number().int().min(1).max(7),
  /** The fixed procedure to apply — the thing that actually transfers to the test. */
  procedure: z.array(z.string().min(1)).min(1),
  body: z.string().min(1),
  drillItemIds: z.array(z.string()).default([]),
});

export const essayPromptSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  /** Framing text as it appears on the test, e.g. a short quoted position. */
  context: z.string().optional(),
  difficulty: difficultySchema,
});

export const rubricCriterionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  /** NITE scores content and language separately; each criterion belongs to one. */
  dimension: z.enum(['content', 'language']),
  description: z.string().min(1),
});

export type PetItem = z.infer<typeof petItemSchema>;
export type EnglishItem = z.infer<typeof englishItemSchema>;
export type Item = PetItem | EnglishItem;
export type VocabEntry = z.infer<typeof vocabEntrySchema>;
export type Lesson = z.infer<typeof lessonSchema>;
export type EssayPrompt = z.infer<typeof essayPromptSchema>;
export type RubricCriterion = z.infer<typeof rubricCriterionSchema>;

export function isEnglishItem(item: Item): item is EnglishItem {
  return item.domain === 'english';
}
