import analogies from './items/verbal/analogies.json';
import verbalSentenceCompletion from './items/verbal/sentence-completion.json';
import logic from './items/verbal/logic.json';
import reading from './items/verbal/reading.json';
import algebra from './items/quant/algebra.json';
import geometry from './items/quant/geometry.json';
import wordProblems from './items/quant/word-problems.json';
import ratiosPercents from './items/quant/ratios-percents.json';
import dataInterpretation from './items/quant/data-interpretation.json';
import enSentenceCompletion from './items/english/sentence-completion.json';
import enRestatement from './items/english/restatement.json';
import enReading from './items/english/reading.json';
import enGrammar from './items/english/grammar.json';
import enListening from './items/english/listening.json';
import lessonsJson from './lessons/lessons.json';
import hebrewVocab from './vocab/hebrew-academic.json';
import englishVocab from './vocab/english-amirnet.json';
import writingJson from './writing/prompts.json';
import englishWritingJson from './english/writing-prompts.json';
import type {
  EnglishItem,
  EssayPrompt,
  Lesson,
  PetItem,
  RubricCriterion,
  VocabEntry,
} from './schema';

/**
 * The content bank, loaded once at module scope.
 *
 * Types are asserted rather than parsed here: `npm run validate:content` runs the Zod
 * schemas over these same files in CI, so paying the parse cost again at every app
 * start would buy nothing. If validation passes, these assertions hold.
 */

export const PET_ITEMS: PetItem[] = [
  ...analogies,
  ...verbalSentenceCompletion,
  ...logic,
  ...reading,
  ...algebra,
  ...geometry,
  ...wordProblems,
  ...ratiosPercents,
  ...dataInterpretation,
] as PetItem[];

export const ENGLISH_ITEMS: EnglishItem[] = [
  ...enSentenceCompletion,
  ...enRestatement,
  ...enReading,
  ...enGrammar,
  ...enListening,
] as EnglishItem[];

export const LESSONS: Lesson[] = lessonsJson as Lesson[];

export const HEBREW_VOCAB: VocabEntry[] = hebrewVocab as VocabEntry[];
export const ENGLISH_VOCAB: VocabEntry[] = englishVocab as VocabEntry[];

export const ESSAY_PROMPTS: EssayPrompt[] = writingJson.prompts as EssayPrompt[];
export const ESSAY_RUBRIC: RubricCriterion[] = writingJson.rubric as RubricCriterion[];

export const ENGLISH_ESSAY_PROMPTS: EssayPrompt[] = englishWritingJson.prompts as EssayPrompt[];
export const ENGLISH_ESSAY_RUBRIC: RubricCriterion[] = englishWritingJson.rubric as RubricCriterion[];

// --- lookups ----------------------------------------------------------------------

const petById = new Map(PET_ITEMS.map((i) => [i.id, i]));
const englishById = new Map(ENGLISH_ITEMS.map((i) => [i.id, i]));

export function itemById(id: string): PetItem | EnglishItem | undefined {
  return petById.get(id) ?? englishById.get(id);
}

export function petItemsByTopic(topic: string): PetItem[] {
  return PET_ITEMS.filter((i) => i.topic === topic);
}

export function englishItemsByTopic(topic: string): EnglishItem[] {
  return ENGLISH_ITEMS.filter((i) => i.topic === topic);
}

export function lessonsForTrack(track: 'pet' | 'amirnet'): Lesson[] {
  return LESSONS.filter((l) => l.track === track);
}

export function lessonForTopic(track: 'pet' | 'amirnet', topic: string): Lesson | undefined {
  return LESSONS.find((l) => l.track === track && l.topic === topic);
}

export function vocabById(id: string): VocabEntry | undefined {
  return [...HEBREW_VOCAB, ...ENGLISH_VOCAB].find((v) => v.id === id);
}
