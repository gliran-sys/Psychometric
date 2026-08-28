import { useCallback, useMemo, useRef, useState } from 'react';
import type { Item } from '../content/schema';
import { selectNextItem, updateRating, STARTING_RATING } from '../engine/adaptive';
import { gradeFrom, newCard, review } from '../engine/srs';
import { suggestErrorType, type ErrorType } from '../engine/errorTaxonomy';
import { xpForAnswer } from '../engine/gamification';
import { useStore } from '../state/store';
import { today } from '../lib/date';

/**
 * The core practice loop, shared by the PET drill and the AMIRNET drill.
 *
 * One place owns the sequence that must never drift between tracks: serve an item at
 * the right difficulty, time the response, grade it, update the ability rating, file
 * the miss into spaced repetition, and award XP.
 *
 * The served item is held in state and changes only in `next()`. It used to be derived
 * with `useMemo` from the pool and the seen set, which looked equivalent but was not:
 * grading an answer updates the ability rating, the rating moves the target difficulty,
 * and when that crossed a difficulty boundary the memo re-selected a *different* item
 * while `selected` and `revealed` still described the old one. The user saw the next
 * question appear on its own with an answer already filled in, and because `next()` then
 * filed the substituted item's id as seen, the question they actually answered stayed
 * unseen and came back around again.
 */
export function useDrill(pool: Item[], track: 'pet' | 'amirnet', topic: string) {
  const abilities = useStore((s) => (track === 'amirnet' ? s.englishAbilities : s.abilities));
  const recordAttempt = useStore((s) => s.recordAttempt);
  const upsertSrsCard = useStore((s) => s.upsertSrsCard);
  const srs = useStore((s) => s.srs);
  const addXp = useStore((s) => s.addXp);
  const registerActivity = useStore((s) => s.registerActivity);

  const rating = abilities[topic]?.rating ?? STARTING_RATING;

  // Recency of past attempts on this topic, so a session picks up where the last one
  // left off instead of re-sampling the same handful. Position in the attempt log is
  // the clock — no timestamp parsing, and it survives a reload with the store.
  const attempts = useStore((s) => s.attempts);
  const lastSeen = useMemo(() => {
    const seen = new Map<string, number>();
    attempts.forEach((a, i) => {
      if (a.topic === topic && a.track === track) seen.set(a.itemId, i);
    });
    return seen;
  }, [attempts, topic, track]);

  const [seenIds, setSeenIds] = useState<Set<string>>(() => new Set());
  // Chosen once at mount and then only ever by `next()`, so nothing that re-renders
  // mid-question — a rating update, an XP award, a parent re-render — can swap it.
  const [current, setCurrent] = useState<Item | null>(() =>
    selectNextItem(pool, rating, new Set(), { lastSeen }),
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [errorType, setErrorType] = useState<ErrorType | null>(null);
  const [combo, setCombo] = useState(0);
  const [stats, setStats] = useState({ correct: 0, answered: 0, xpEarned: 0 });

  const questionStartRef = useRef<number>(Date.now());

  const answer = useCallback(
    (index: number) => {
      if (!current || revealed) return;

      const timeSec = Math.max(1, Math.round((Date.now() - questionStartRef.current) / 1000));
      const correct = index === current.correctIndex;

      setSelected(index);
      setRevealed(true);

      const suggestion = suggestErrorType({
        correct,
        timeSec,
        targetTimeSec: current.targetTimeSec,
        // Every wrong option in the bank carries an authored trap explanation, so a
        // wrong choice is by definition a designed distractor.
        choseFlaggedTrap: !correct && current.trapExplanations[String(index)] !== undefined,
      });
      setErrorType(suggestion);

      const nextCombo = correct ? combo + 1 : 0;
      setCombo(nextCombo);

      const xp = xpForAnswer(correct, current.difficulty, combo);
      addXp(xp);

      recordAttempt(
        { itemId: current.id, topic, track, correct, timeSec, errorType: suggestion },
        updateRating(rating, current.difficulty, correct),
      );

      // Every item touched enters spaced repetition; the grade decides how soon it
      // comes back. A miss returns tomorrow, a fast correct answer in six days.
      const existing = srs[current.id] ?? newCard(current.id, 'item', today());
      upsertSrsCard(review(existing, gradeFrom(correct, timeSec, current.targetTimeSec), today()));

      registerActivity();
      setStats((s) => ({
        correct: s.correct + (correct ? 1 : 0),
        answered: s.answered + 1,
        xpEarned: s.xpEarned + xp,
      }));
    },
    [current, revealed, combo, rating, topic, track, srs, addXp, recordAttempt, upsertSrsCard, registerActivity],
  );

  const next = useCallback(() => {
    setSelected(null);
    setRevealed(false);
    setErrorType(null);
    questionStartRef.current = Date.now();
    if (!current) return;

    const seen = new Set(seenIds).add(current.id);
    setSeenIds(seen);

    // Every item in the topic has been answered — end the session rather than looping
    // the pool, which is what the "you finished this topic" screen is for.
    if (pool.every((item) => seen.has(item.id))) {
      setCurrent(null);
      return;
    }

    // `avoidId` matters only for the exhausted-pool fallback inside selectNextItem;
    // it guarantees the same question is never served twice in a row.
    setCurrent(selectNextItem(pool, rating, seen, { avoidId: current.id, lastSeen }));
  }, [current, seenIds, pool, rating, lastSeen]);

  return { current, selected, revealed, errorType, setErrorType, combo, stats, answer, next };
}
