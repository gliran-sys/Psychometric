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
import { ALL_TOPICS, SECTIONS, TOPICS } from '../src/config/blueprint';
import { permutationFor } from '../src/engine/optionOrder';
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

/**
 * Two options with identical text means the item has two correct answers (or two
 * identical wrong ones) — a defect that is invisible in review but fatal in a drill.
 */
[...petItems, ...englishItems].forEach((raw) => {
  const item = raw as { id: string; options: string[] };
  const normalised = item.options.map((o) => o.trim());
  const unique = new Set(normalised);
  if (unique.size !== normalised.length) {
    errors.push(`item ${item.id}: duplicate answer options`);
  }
});

/**
 * A repeated stem usually means an item was copy-pasted and only half-edited, which
 * silently halves the variety of a section that draws from that topic.
 */
const stems = new Map<string, string>();
[...petItems, ...englishItems].forEach((raw) => {
  const item = raw as { id: string; stem: string; passage?: string };
  // Reading sets legitimately share a passage, so key on the question itself.
  const key = item.stem.trim();
  const existing = stems.get(key);
  if (existing) errors.push(`item ${item.id}: stem duplicates ${existing}`);
  else stems.set(key, item.id);
});

/** Every PET topic in the blueprint needs items, or its skill-tree node dead-ends. */
ALL_TOPICS.forEach((topic) => {
  const count = (petItems as { topic: string }[]).filter((i) => i.topic === topic.id).length;
  if (count === 0) errors.push(`topic "${topic.id}" has no items`);
  else if (count < 6) warnings.push(`topic "${topic.id}" has only ${count} items`);
});

/**
 * AMIRNET tier depth.
 *
 * The requirement is not one block's worth per tier — it is a whole SITTING's worth.
 * Routing can hold the same tier for every block of a topic (three sentence-completion
 * blocks all at medium, say), and `assembleBlock` excludes items already served earlier
 * in the sitting. If the tier runs dry mid-sitting it widens to neighbouring tiers,
 * which silently distorts the difficulty the score is derived from.
 */
const blocksPerTopic = new Map<string, number>();
BLOCKS.forEach((b) => blocksPerTopic.set(b.topic, (blocksPerTopic.get(b.topic) ?? 0) + 1));

BLOCKS.forEach((block) => {
  const needed = block.questionCount * (blocksPerTopic.get(block.topic) ?? 1);
  TIER_ORDER.forEach((tier) => {
    const count = englishItems.filter((i) => i.topic === block.topic && i.blockTier === tier).length;
    if (count < needed) {
      errors.push(
        `AMIRNET: topic "${block.topic}" tier "${tier}" has ${count} items but a full ` +
          `sitting can need ${needed} at one tier — routing would be distorted`,
      );
    }
  });
});

/** Listening items are spoken by the Web Speech API and need text to speak. */
englishItems
  .filter((i) => i.topic === 'listening' && !i.audioText)
  .forEach((i) => errors.push(`listening item ${i.id} has no audioText`));

// --- non-repeating mock capacity ----------------------------------------------------

/**
 * How many full mocks can be sat before an item has to be served twice.
 *
 * This is the number that decides whether repeated practice feels like a new exam, and
 * it is governed by the THINNEST topic rather than the total bank size — a large bank
 * with shallow reading comprehension still repeats reading passages immediately.
 */
const perMockNeed = new Map<string, number>();
SECTIONS.forEach((section) => {
  TOPICS[section.domain].forEach((topic) => {
    perMockNeed.set(topic.id, (perMockNeed.get(topic.id) ?? 0) + topic.questionsPerSection);
  });
});

let mockCapacity = Infinity;
let bottleneck = '';
perMockNeed.forEach((need, topic) => {
  const have = (petItems as { topic: string }[]).filter((i) => i.topic === topic).length;
  const mocks = have / need;
  if (mocks < mockCapacity) {
    mockCapacity = mocks;
    bottleneck = topic;
  }
});

const fullMocks = Math.floor(mockCapacity);
if (fullMocks < 2) {
  warnings.push(
    `bank supports only ${fullMocks} fully non-repeating mock(s); "${bottleneck}" is the ` +
      `bottleneck at ${mockCapacity.toFixed(1)}. Add items to that topic first.`,
  );
}

/**
 * Where the correct answer actually lands once the bank is served.
 *
 * Items are authored answer-first and shuffled by `src/engine/optionOrder.ts` on the
 * way out of the content boundary, so the authored `correctIndex` says nothing about
 * what the user sees. What matters is the served distribution, and it is checked here
 * rather than only in tests because the failure mode is silent: an item bank that
 * happens to lean on one position turns every drill into a guessing game the user can
 * win without reading. This is the check whose absence let an all-answers-first bank
 * ship.
 */
const servedPosition = (item: { id: string; correctIndex: number }) =>
  permutationFor(item.id).indexOf(item.correctIndex);

const positionCounts = [0, 0, 0, 0];
const byTopicPositions = new Map<string, number[]>();

[...petItems, ...englishItems].forEach((raw) => {
  const item = raw as { id: string; topic: string; correctIndex: number };
  const position = servedPosition(item);
  positionCounts[position] += 1;
  const counts = byTopicPositions.get(item.topic) ?? [0, 0, 0, 0];
  counts[position] += 1;
  byTopicPositions.set(item.topic, counts);
});

const totalItems = positionCounts.reduce((a, b) => a + b, 0);
if (totalItems > 0) {
  const expected = totalItems / 4;
  const chiSquare = positionCounts.reduce((s, c) => s + (c - expected) ** 2 / expected, 0);

  positionCounts.forEach((count, position) => {
    if (count === 0) {
      errors.push(`served answers never land in position ${position + 1} of 4`);
    }
  });

  // df = 3, p = 0.001. Loose enough that ordinary sampling noise in a few hundred
  // items passes; tight enough that a real skew — a broken hash, or a bank grown
  // lopsided — fails the build instead of reaching a drill.
  if (chiSquare > 16.27) {
    errors.push(
      `served answer positions are skewed (${positionCounts.join('/')}, chi-square ` +
        `${chiSquare.toFixed(1)} over ${totalItems} items)`,
    );
  }

  byTopicPositions.forEach((counts, topic) => {
    const n = counts.reduce((a, b) => a + b, 0);
    if (n < 15) return; // too few items for the share to mean anything
    const worst = Math.max(...counts) / n;
    if (worst > 0.5) {
      // Drills serve one topic at a time, so a per-topic lean is exploitable even
      // when the bank as a whole looks flat.
      errors.push(
        `topic "${topic}" puts ${Math.round(worst * 100)}% of its answers in one ` +
          `position (${counts.join('/')})`,
      );
    }
  });
}

// --- report -------------------------------------------------------------------------

warnings.forEach((w) => console.warn(`warning: ${w}`));

if (errors.length > 0) {
  console.error(`\ncontent validation failed with ${errors.length} error(s):\n`);
  errors.forEach((e) => console.error(`  ${e}`));
  process.exit(1);
}

console.log(
  `content OK — ${petItems.length} PET items, ${englishItems.length} AMIRNET items, ` +
    `${allIds.size} unique ids · ${fullMocks} non-repeating mock(s) ` +
    `(bottleneck: ${bottleneck} at ${mockCapacity.toFixed(1)}) · ` +
    `answer positions ${positionCounts.map((c) => `${Math.round((c / totalItems) * 100)}%`).join('/')}`,
);
