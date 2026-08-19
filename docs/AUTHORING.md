# Authoring content

The item bank is plain JSON under `src/content/`. Nothing in the app needs to change to
add questions — write the JSON, run `npm run validate:content`, and the new items are
live in drills, boss fights, mocks and the spaced-repetition queue.

```
src/content/
  items/verbal/{analogies,sentence-completion,logic,reading}.json
  items/quant/{algebra,geometry,word-problems,ratios-percents,data-interpretation}.json
  items/english/{sentence-completion,restatement,reading,grammar,listening}.json
  lessons/lessons.json
  vocab/{hebrew-academic,english-amirnet}.json
  writing/prompts.json            PET essay prompts + rubric
  english/writing-prompts.json    AMIRNET writing prompts + rubric
```

## Copyright

**Do not copy items from NITE past exams.** They are copyrighted. Everything in this bank
is originally authored in the style of the exam. NITE's official free past exams remain
the single best simulation material available — link to them and solve them there.

## Item shape

```jsonc
{
  "id": "an-011",                    // unique across the ENTIRE bank
  "domain": "verbal",                // "verbal" | "quant" | "english"
  "topic": "analogies",              // must match a topic id in config/blueprint.ts
  "difficulty": 3,                   // 1-5
  "passage": "…",                    // optional; repeat it on each item of a set
  "stem": "רוֹפֵא : חוֹלֶה",
  "options": ["…", "…", "…", "…"],   // exactly 4; write the CORRECT one first
  "correctIndex": 0,                 // always 0 — the app shuffles (see below)
  "solutionSteps": ["…", "…"],       // the procedure, not just the answer
  "techniqueTags": ["משפט-יחס"],
  "targetTimeSec": 35,               // drives pacing feedback and SRS grading
  "trapExplanations": {              // REQUIRED for every wrong option
    "1": "why this one is tempting",
    "2": "…",
    "3": "…"
  }
}
```

### Write the correct answer first — the app shuffles it

Author every item with the correct answer at index `0`. That is the only workable order
to write in: distractors are designed *against* the answer, and `trapExplanations` are
keyed to their option index, so writing the answer anywhere else just invites a
mis-keyed explanation.

Nothing ships in that order. `src/engine/optionOrder.ts` permutes the options at the
content boundary in `src/content/index.ts`, remapping `correctIndex` and re-keying
`trapExplanations` to follow their options. Every screen in the app reads the shuffled
form; nothing imports the raw JSON.

The permutation is derived from the item id, so it is stable — a question shows the same
option order in a drill, in the review queue, and after a reload. Which means: **do not
hand-shuffle options to "add variety".** It buys nothing, and choosing positions by hand
is exactly how the bank ended up with every answer at א in the first place.

`npm run validate:content` fails the build if the served positions come out skewed — as
a whole bank, or inside any single topic with 15+ items, since drills serve one topic at
a time. It prints the split on success:

```
content OK — … · answer positions 24%/23%/27%/25%
```

### `trapExplanations` is mandatory

Validation fails without one for each wrong option, and fails if the *correct* option
has one. This is deliberate. Explaining why a wrong answer looks right is what turns a
review session into a technique lesson — it is the highest-value field in the bank, and
making it optional would mean it stops getting written.

Write them as distractor analysis, not as restatements of the correct answer:

- ✅ "'קשה' מציין דרגת קושי גבוהה, אך לא בלתי אפשרות — ההבדל בין 'קשה' ל'בלתי אפשרי'."
- ❌ "This option is wrong."

### `solutionSteps` should teach the procedure

Each step is one move a solver actually makes. Prefer the shortcut the exam rewards over
the exhaustive algebra, and say when a shortcut exists:

> "קיצור: שטח ריבוע לפי אלכסון d הוא d²/2 = 64/2 = 32."

## AMIRNET items need two extra fields

```jsonc
{
  "domain": "english",
  "blockTier": "medium",   // "easy" | "medium" | "hard" — REQUIRED
  "audioText": "…"         // listening items only
}
```

`blockTier` is which rung of the adaptive ladder the item belongs to. It is not the same
as `difficulty`: `difficulty` drives item-level selection in untimed drills, `blockTier`
decides which items can be assembled into a block during the simulation.

**Validation enforces depth at every tier.** For each adaptive block in
`config/amirnet.ts`, every tier must hold at least `questionCount` items of that topic.
If a tier is thin, `assembleBlock` has to widen to neighbouring tiers, which silently
distorts the routing that the whole simulation depends on. The error looks like:

```
AMIRNET: topic "reading" tier "medium" has 4 items but block "rc1" needs 5
  — routing would be distorted
```

Fix it by adding items at that tier, not by shrinking the block.

`audioText` is spoken with the browser's Web Speech API — no audio files are hosted,
which keeps the app fully static. Write it as natural speech, not as prose to be read.

## Reading comprehension sets

Repeat the identical `passage` string on every item of the set. The app shows the passage
above the stem, so items stay independently selectable by the adaptive engine while a
mock still presents them as a coherent set.

Keep passages 150-350 words and give them a real argumentative structure — a conventional
view, an objection, a qualification. Most reading questions worth asking are about
*structure* (what does this paragraph do?) rather than retrieval.

## Lessons

`lessons/lessons.json`. `minutes` is capped at 7 by the schema — these are technique
downloads, not textbook chapters. The `procedure` array is the part that transfers to the
exam, so write it as numbered actions a solver performs in order. `body` supports `**bold**`
and `### headings` only.

## Vocabulary

`confusableWith` lists the words that show up as distractors for this one. That is where
the actual test difficulty lives — `implicit`/`explicit`, `substantiate`/`substitute` —
so populate it rather than leaving it empty.

## Checklist before committing

```bash
npm run validate:content   # schema, duplicate ids, topic coverage, AMIRNET tier depth
npm test                   # engine unit tests
npm run build              # typecheck + production build
```
