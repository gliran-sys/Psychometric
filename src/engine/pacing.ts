/**
 * Clocks and pace feedback.
 *
 * Pacing is a bigger deal under the two-domain format than it used to be: with only
 * two scored sections per domain instead of four, a single section lost to the clock
 * is a quarter of that domain's evidence, with no later section to recover in.
 */

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = Math.floor(s / 60).toString().padStart(2, '0');
  const ss = (s % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

export type PaceStatus = 'ahead' | 'on-track' | 'behind' | 'critical';

export const PACE_LABELS: Record<PaceStatus, { he: string; className: string }> = {
  ahead: { he: 'לפני הקצב', className: 'text-quant' },
  'on-track': { he: 'בקצב', className: 'text-slate-300' },
  behind: { he: 'מפגר אחרי הקצב', className: 'text-xp' },
  critical: { he: 'קריטי', className: 'text-danger' },
};

/**
 * Compares questions completed against time spent. Expressed as a ratio of expected
 * progress so it works for any section length.
 */
export function paceStatus(
  questionsAnswered: number,
  totalQuestions: number,
  elapsedSec: number,
  totalSec: number,
): PaceStatus {
  if (elapsedSec <= 0) return 'on-track';

  const expectedAnswered = (elapsedSec / totalSec) * totalQuestions;
  const delta = questionsAnswered - expectedAnswered;

  if (delta >= 1.5) return 'ahead';
  if (delta >= -1) return 'on-track';
  if (delta >= -3) return 'behind';
  return 'critical';
}

/** Seconds per remaining question needed to finish on time — the actionable number. */
export function requiredPace(
  questionsAnswered: number,
  totalQuestions: number,
  elapsedSec: number,
  totalSec: number,
): number | null {
  const remainingQuestions = totalQuestions - questionsAnswered;
  if (remainingQuestions <= 0) return null;
  return Math.max(0, (totalSec - elapsedSec) / remainingQuestions);
}

export interface TimeAccuracyPoint {
  timeSec: number;
  correct: boolean;
  topic: string;
}

/**
 * Splits attempts into the four quadrants that actually suggest different actions.
 * "Fast and wrong" and "slow and right" are entirely different problems, and a single
 * accuracy percentage hides both.
 */
export function quadrants(points: TimeAccuracyPoint[], targetTimeSec: number) {
  const result = { fastRight: 0, fastWrong: 0, slowRight: 0, slowWrong: 0 };
  points.forEach((p) => {
    const fast = p.timeSec <= targetTimeSec;
    if (fast && p.correct) result.fastRight += 1;
    else if (fast && !p.correct) result.fastWrong += 1;
    else if (!fast && p.correct) result.slowRight += 1;
    else result.slowWrong += 1;
  });
  return result;
}
