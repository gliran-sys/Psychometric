import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ALL_TOPICS } from '../config/blueprint';
import { BLOCKS, EXEMPTION_SCORE, type BlockTier, type EnglishTopic } from '../config/amirnet';
import { STARTING_RATING } from '../engine/adaptive';
import type { ErrorType } from '../engine/errorTaxonomy';
import type { SrsCard } from '../engine/srs';

/**
 * All progress lives here and is mirrored to localStorage. There is no backend, so
 * this object IS the user's study history — months of it. The `version` field and the
 * `migrate` hook below exist so a future schema change never silently wipes it.
 */
export const STORE_VERSION = 1;

export interface Ability {
  rating: number;
  attempts: number;
  correct: number;
}

export interface AttemptRecord {
  itemId: string;
  topic: string;
  track: 'pet' | 'amirnet';
  correct: boolean;
  timeSec: number;
  errorType: ErrorType | null;
  /** ISO timestamp. */
  at: string;
}

export interface EssayDraft {
  id: string;
  promptId: string;
  text: string;
  lineCount: number;
  /** Self-scored against the rubric: content and language, 1-6 each, as NITE scores it. */
  contentScore: number | null;
  languageScore: number | null;
  minutesTaken: number;
  at: string;
}

export interface MockResult {
  id: string;
  /** Per-section raw correct counts, keyed by section id from the blueprint. */
  sectionScores: Record<string, { correct: number; total: number }>;
  estimatedScore: number;
  verbalScore: number;
  quantScore: number;
  at: string;
}

export interface AmirnetBlockRecord {
  blockId: string;
  tier: BlockTier;
  correct: number;
  total: number;
}

export interface AmirnetSimResult {
  id: string;
  /** The routed path — which tier each block ran at. This is the coaching feedback. */
  path: AmirnetBlockRecord[];
  estimatedScore: number;
  at: string;
}

export interface Quest {
  id: string;
  label: string;
  /** Route to send the user to when they tap the quest. */
  href: string;
  target: number;
  progress: number;
  xp: number;
  done: boolean;
}

interface Profile {
  /** PET test date (ISO yyyy-mm-dd). Drives the planner and the countdown. */
  testDate: string | null;
  /** Date of the last real AMIRNET sitting, for the 35-day retake countdown. */
  amirnetLastSitting: string | null;
  /** Real AMIRNET score if already sat. Once >= target, Track B retires. */
  amirnetRealScore: number | null;
  /** Institutions differ; default is the common 134 exemption line. */
  amirnetTargetScore: number;
  dailyGoalMinutes: number;
}

interface Streak {
  current: number;
  longest: number;
  /** ISO yyyy-mm-dd of the last day with any completed activity. */
  lastActiveDay: string | null;
  /** Spend one to survive a missed day. Earned every 7-day streak. */
  freezeTokens: number;
}

export interface AppState {
  version: number;
  profile: Profile;
  xp: number;
  streak: Streak;
  abilities: Record<string, Ability>;
  englishAbilities: Record<string, Ability>;
  srs: Record<string, SrsCard>;
  attempts: AttemptRecord[];
  badges: string[];
  essayDrafts: EssayDraft[];
  mockResults: MockResult[];
  amirnetSims: AmirnetSimResult[];
  /** Lessons the user has completed, by lesson id. Drives skill-tree unlocks. */
  completedLessons: string[];
  quests: { day: string; items: Quest[] };

  // --- actions ---
  recordAttempt: (a: Omit<AttemptRecord, 'at'>, newRating: number) => void;
  addXp: (amount: number) => void;
  registerActivity: () => void;
  upsertSrsCard: (card: SrsCard) => void;
  completeLesson: (lessonId: string) => void;
  awardBadge: (badgeId: string) => void;
  saveEssay: (draft: EssayDraft) => void;
  saveMock: (result: MockResult) => void;
  saveAmirnetSim: (result: AmirnetSimResult) => void;
  setQuests: (day: string, items: Quest[]) => void;
  advanceQuest: (questId: string, by?: number) => void;
  updateProfile: (patch: Partial<Profile>) => void;
  resetProgress: () => void;
  exportJson: () => string;
  importJson: (json: string) => boolean;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso + 'T00:00:00Z').getTime();
  const to = new Date(toIso + 'T00:00:00Z').getTime();
  return Math.round((to - from) / 86_400_000);
}

const emptyAbilities = (ids: string[]): Record<string, Ability> =>
  Object.fromEntries(ids.map((id) => [id, { rating: STARTING_RATING, attempts: 0, correct: 0 }]));

const ENGLISH_TOPICS: EnglishTopic[] = [
  ...new Set(BLOCKS.map((b) => b.topic)),
  'grammar',
  'listening',
];

const initialState = () => ({
  version: STORE_VERSION,
  profile: {
    testDate: null,
    amirnetLastSitting: null,
    amirnetRealScore: null,
    amirnetTargetScore: EXEMPTION_SCORE,
    dailyGoalMinutes: 35,
  },
  xp: 0,
  streak: { current: 0, longest: 0, lastActiveDay: null, freezeTokens: 0 },
  abilities: emptyAbilities(ALL_TOPICS.map((t) => t.id)),
  englishAbilities: emptyAbilities(ENGLISH_TOPICS),
  srs: {},
  attempts: [],
  badges: [],
  essayDrafts: [],
  mockResults: [],
  amirnetSims: [],
  completedLessons: [],
  quests: { day: '', items: [] },
});

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...initialState(),

      recordAttempt: (a, newRating) =>
        set((s) => {
          const pool = a.track === 'amirnet' ? 'englishAbilities' : 'abilities';
          const prev = s[pool][a.topic] ?? { rating: STARTING_RATING, attempts: 0, correct: 0 };
          return {
            attempts: [...s.attempts, { ...a, at: new Date().toISOString() }],
            [pool]: {
              ...s[pool],
              [a.topic]: {
                rating: newRating,
                attempts: prev.attempts + 1,
                correct: prev.correct + (a.correct ? 1 : 0),
              },
            },
          } as Partial<AppState>;
        }),

      addXp: (amount) => set((s) => ({ xp: s.xp + amount })),

      /**
       * Called once per day on the first completed activity. A missed day spends a
       * freeze token if one is banked, otherwise the streak resets — the token is what
       * stops one bad day from destroying six weeks of momentum.
       */
      registerActivity: () =>
        set((s) => {
          const day = today();
          if (s.streak.lastActiveDay === day) return {};

          const gap = s.streak.lastActiveDay ? daysBetween(s.streak.lastActiveDay, day) : 1;
          let { current, freezeTokens } = s.streak;

          if (gap === 1 || s.streak.lastActiveDay === null) {
            current += 1;
          } else if (gap > 1 && freezeTokens > 0) {
            freezeTokens -= 1;
            current += 1;
          } else {
            current = 1;
          }

          if (current > 0 && current % 7 === 0) freezeTokens += 1;

          return {
            streak: {
              current,
              longest: Math.max(current, s.streak.longest),
              lastActiveDay: day,
              freezeTokens,
            },
          };
        }),

      upsertSrsCard: (card) => set((s) => ({ srs: { ...s.srs, [card.id]: card } })),

      completeLesson: (lessonId) =>
        set((s) =>
          s.completedLessons.includes(lessonId)
            ? {}
            : { completedLessons: [...s.completedLessons, lessonId] },
        ),

      awardBadge: (badgeId) =>
        set((s) => (s.badges.includes(badgeId) ? {} : { badges: [...s.badges, badgeId] })),

      saveEssay: (draft) => set((s) => ({ essayDrafts: [...s.essayDrafts, draft] })),
      saveMock: (result) => set((s) => ({ mockResults: [...s.mockResults, result] })),
      saveAmirnetSim: (result) => set((s) => ({ amirnetSims: [...s.amirnetSims, result] })),

      setQuests: (day, items) => set({ quests: { day, items } }),

      advanceQuest: (questId, by = 1) =>
        set((s) => ({
          quests: {
            ...s.quests,
            items: s.quests.items.map((q) => {
              if (q.id !== questId || q.done) return q;
              const progress = Math.min(q.target, q.progress + by);
              return { ...q, progress, done: progress >= q.target };
            }),
          },
        })),

      updateProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),

      resetProgress: () => set(initialState()),

      exportJson: () => {
        const { profile, xp, streak, abilities, englishAbilities, srs, attempts, badges,
          essayDrafts, mockResults, amirnetSims, completedLessons } = get();
        return JSON.stringify(
          { version: STORE_VERSION, profile, xp, streak, abilities, englishAbilities, srs,
            attempts, badges, essayDrafts, mockResults, amirnetSims, completedLessons },
          null,
          2,
        );
      },

      importJson: (json) => {
        try {
          const parsed = JSON.parse(json);
          if (typeof parsed !== 'object' || parsed === null) return false;
          set({ ...initialState(), ...parsed, version: STORE_VERSION });
          return true;
        } catch {
          return false;
        }
      },
    }),
    {
      name: 'psychometric-rpg',
      version: STORE_VERSION,
      /**
       * Runs when a persisted payload has an older version. Today there is only v1, so
       * this just backfills any topic added to the blueprint since the save was made —
       * without it, a new topic would read as `undefined` ability and crash the drill.
       */
      migrate: (persisted: unknown, from: number) => {
        const state = persisted as Partial<AppState>;
        if (from < 1) return { ...initialState(), ...state };
        return {
          ...state,
          abilities: { ...emptyAbilities(ALL_TOPICS.map((t) => t.id)), ...state.abilities },
          englishAbilities: { ...emptyAbilities(ENGLISH_TOPICS), ...state.englishAbilities },
        };
      },
    },
  ),
);

/** True once the real AMIRNET has been sat and cleared — Track B retires. */
export function isEnglishDone(s: AppState): boolean {
  return s.profile.amirnetRealScore !== null &&
    s.profile.amirnetRealScore >= s.profile.amirnetTargetScore;
}

export function daysUntilRetake(s: AppState, retakeIntervalDays: number): number | null {
  if (!s.profile.amirnetLastSitting) return null;
  return Math.max(0, retakeIntervalDays - daysBetween(s.profile.amirnetLastSitting, today()));
}

export function daysUntilTest(s: AppState): number | null {
  return s.profile.testDate ? daysBetween(today(), s.profile.testDate) : null;
}
