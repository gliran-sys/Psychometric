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
 */
export function useDrill(pool: Item[], track: 'pet' | 'amirnet', topic: string) {
  const abilities = useStore((s) => (track === 'amirnet' ? s.englishAbilities : s.abilities));
  const recordAttempt = useStore((s) => s.recordAttempt);
  const upsertSrsCard = useStore((s) => s.upsertSrsCard);
  const srs = useStore((s) => s.srs);
  const addXp = useStore((s) => s.addXp);
  const registerActivity = useStore((s) => s.registerActivity);

  const rating = abilities[topic]?.rating ?? STARTING_RATING;

  const [seenIds, setSeenIds] = useState<Set<string>>(() => new Set());
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [errorType, setErrorType] = useState<ErrorType | null>(null);
  const [combo, setCombo] = useState(0);
  const [stats, setStats] = useState({ correct: 0, answered: 0, xpEarned: 0 });

  const questionStartRef = useRef<number>(Date.now());

  const current = useMemo(
    () => selectNextItem(pool, rating, seenIds),
    // `rating` is intentionally excluded: re-selecting mid-question when the rating
    // updates would swap the item out from under the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pool, seenIds],
  );

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
    if (current) setSeenIds((prev) => new Set(prev).add(current.id));
    setSelected(null);
    setRevealed(false);
    setErrorType(null);
    questionStartRef.current = Date.now();
  }, [current]);

  return { current, selected, revealed, errorType, setErrorType, combo, stats, answer, next };
}
