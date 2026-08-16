/**
 * Spaced repetition over missed items, technique cards and vocabulary.
 *
 * SM-2 with the ease floor kept at the classic 1.3. Simplified in one way: the app
 * grades on a 0-5 scale derived from correctness plus response speed rather than
 * asking the user to self-rate, because a self-rating prompt after every drill item
 * would wreck the pace of a timed session.
 */

export interface SrsCard {
  id: string;
  /** What the card points at, so the review screen knows how to render it. */
  kind: 'item' | 'vocab' | 'technique';
  ease: number;
  intervalDays: number;
  /** ISO yyyy-mm-dd the card next becomes due. */
  due: string;
  reps: number;
  lapses: number;
}

export const MIN_EASE = 1.3;
const INITIAL_EASE = 2.5;

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function newCard(id: string, kind: SrsCard['kind'], todayIso: string): SrsCard {
  return { id, kind, ease: INITIAL_EASE, intervalDays: 0, due: todayIso, reps: 0, lapses: 0 };
}

/**
 * Turns a drill result into an SM-2 grade without interrupting the user.
 * A miss is always a failing grade; a correct answer is graded on speed against the
 * item's own target time, so a slow-but-right answer still comes back sooner.
 */
export function gradeFrom(correct: boolean, timeSec: number, targetTimeSec: number): number {
  if (!correct) return timeSec > targetTimeSec * 1.5 ? 0 : 2;
  const ratio = timeSec / targetTimeSec;
  if (ratio <= 0.75) return 5;
  if (ratio <= 1.25) return 4;
  return 3;
}

/**
 * Advances a card. Grades below 3 are lapses: the interval collapses to one day and
 * the card returns tomorrow, which is the whole point — a missed item you never see
 * again is a missed item you will miss again on test day.
 */
export function review(card: SrsCard, grade: number, todayIso: string): SrsCard {
  const ease = Math.max(
    MIN_EASE,
    card.ease + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)),
  );

  if (grade < 3) {
    return { ...card, ease, intervalDays: 1, due: addDays(todayIso, 1), reps: 0, lapses: card.lapses + 1 };
  }

  const reps = card.reps + 1;
  const intervalDays =
    reps === 1 ? 1 : reps === 2 ? 6 : Math.round(card.intervalDays * ease);

  return { ...card, ease, intervalDays, due: addDays(todayIso, intervalDays), reps };
}

export function isDue(card: SrsCard, todayIso: string): boolean {
  return card.due <= todayIso;
}

export function dueCards(cards: Record<string, SrsCard>, todayIso: string): SrsCard[] {
  return Object.values(cards)
    .filter((c) => isDue(c, todayIso))
    // Most-lapsed first: the cards that keep beating you are the ones worth the time.
    .sort((a, b) => b.lapses - a.lapses || a.due.localeCompare(b.due));
}
