/**
 * Validates every content file against the Zod schemas, plus a few structural rules
 * the schemas alone cannot express.
 *
 * Runs in CI before the build. A malformed item should fail here, not appear halfway
 * through a timed drill.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { BLOCKS, TIER_ORDER } from '../src/config/amirnet';
import { ALL_TOPICS } from '../src/config/blueprint';
import {
  englishItemSchema,
  essayPromptSchema,
  lessonSchema,
  petItemSchema,
  rubricCriterionSchema,
  vocabEntrySchema,
  type EnglishItem,
} from '../src/content/schema';

const ROOT = join(import.meta.dirname, '..');
const CONTENT = join(ROOT, 'src/content');

const errors: string[] = [];
const warnings: string[] = [];

function fail(file: string, message: string) {
  errors.push(`${relative(ROOT, file)}: ${message}`);
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : full.endsWith('.json') ? [full] : [];
  });
}

// --- per-file validation ------------------------------------------------------------

const allIds = new Set<string>();
const petItems: unknown[] = [];
const englishItems: EnglishItem[] = [];

for (const file of walk(CONTENT)) {
  const data = readJson(file);
  const rel = relative(CONTENT, file);

  if (rel.startsWith('items/english')) {
    if (!Array.isArray(data)) { fail(file, 'expected an array of items'); continue; }
    data.forEach((raw, idx) => {
      const parsed = englishItemSchema.safeParse(raw);
      if (!parsed.success) {
        fail(file, `item ${idx}: ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`);
        return;
      }
      englishItems.push(parsed.data);
    });
  } else if (rel.startsWith('items/')) {
    if (!Array.isArray(data)) { fail(file, 'expected an array of items'); continue; }
    data.forEach((raw, idx) => {
      const parsed = petItemSchema.safeParse(raw);
      if (!parsed.success) {
        fail(file, `item ${idx}: ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`);
        return;
      }
      petItems.push(parsed.data);
    });
  } else if (rel.startsWith('lessons/')) {
    if (!Array.isArray(data)) { fail(file, 'expected an array of lessons'); continue; }
    data.forEach((raw, idx) => {
      const parsed = lessonSchema.safeParse(raw);
      if (!parsed.success) {
        fail(file, `lesson ${idx}: ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`);
      }
    });
  } else if (rel.startsWith('vocab/')) {
    if (!Array.isArray(data)) { fail(file, 'expected an array of vocabulary entries'); continue; }
    data.forEach((raw, idx) => {
      const parsed = vocabEntrySchema.safeParse(raw);
      if (!parsed.success) {
        fail(file, `entry ${idx}: ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`);
      }
    });
  } else if (rel.endsWith('prompts.json') || rel.endsWith('writing-prompts.json')) {
    const doc = data as { prompts?: unknown[]; rubric?: unknown[] };
    (doc.prompts ?? []).forEach((raw, idx) => {
      const parsed = essayPromptSchema.safeParse(raw);
      if (!parsed.success) fail(file, `prompt ${idx}: ${parsed.error.issues.map((i) => i.message).join('; ')}`);
    });
    (doc.rubric ?? []).forEach((raw, idx) => {
      const parsed = rubricCriterionSchema.safeParse(raw);
      if (!parsed.success) fail(file, `rubric ${idx}: ${parsed.error.issues.map((i) => i.message).join('; ')}`);
    });
  }

  // Duplicate ids across the whole bank would make SRS cards and attempt logs collide.
  if (Array.isArray(data)) {
    data.forEach((raw) => {
      const id = (raw as { id?: string }).id;
      if (!id) return;
      if (allIds.has(id)) fail(file, `duplicate id "${id}"`);
      allIds.add(id);
    });
  }
}

// --- structural rules ---------------------------------------------------------------

/**
 * The correct option must never be explained as a trap, and every wrong option must be.
 * A missing trap explanation silently degrades the review screen from a technique
 * lesson into a bare right/wrong readout.
 */
[...petItems, ...englishItems].forEach((raw) => {
  const item = raw as { id: string; correctIndex: number; trapExplanations: Record<string, string> };
  for (let i = 0; i < 4; i += 1) {
    const has = item.trapExplanations[String(i)] !== undefined;
    if (i === item.correctIndex && has) {
      errors.push(`item ${item.id}: correct option ${i} should not have a trap explanation`);
    }
    if (i !== item.correctIndex && !has) {
      errors.push(`item ${item.id}: missing trap explanation for wrong option ${i}`);
    }
  }
});

/** Every PET topic in the blueprint needs items, or its skill-tree node dead-ends. */
ALL_TOPICS.forEach((topic) => {
  const count = (petItems as { topic: string }[]).filter((i) => i.topic === topic.id).length;
  if (count === 0) errors.push(`topic "${topic.id}" has no items`);
  else if (count < 6) warnings.push(`topic "${topic.id}" has only ${count} items`);
});

/**
 * AMIRNET block assembly needs a full block's worth of items at EVERY tier for every
 * adaptive block type. A thin tier would force `assembleBlock` to widen and quietly
 * distort the routing that the whole simulation depends on.
 */
BLOCKS.forEach((block) => {
  TIER_ORDER.forEach((tier) => {
    const count = englishItems.filter((i) => i.topic === block.topic && i.blockTier === tier).length;
    if (count < block.questionCount) {
      errors.push(
        `AMIRNET: topic "${block.topic}" tier "${tier}" has ${count} items but block ` +
          `"${block.id}" needs ${block.questionCount} — routing would be distorted`,
      );
    }
  });
});

/** Listening items are spoken by the Web Speech API and need text to speak. */
englishItems
  .filter((i) => i.topic === 'listening' && !i.audioText)
  .forEach((i) => errors.push(`listening item ${i.id} has no audioText`));

// --- report -------------------------------------------------------------------------

warnings.forEach((w) => console.warn(`warning: ${w}`));

if (errors.length > 0) {
  console.error(`\ncontent validation failed with ${errors.length} error(s):\n`);
  errors.forEach((e) => console.error(`  ${e}`));
  process.exit(1);
}

console.log(
  `content OK — ${petItems.length} PET items, ${englishItems.length} AMIRNET items, ` +
    `${allIds.size} unique ids`,
);
