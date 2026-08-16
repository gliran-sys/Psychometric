import { RETAKE_INTERVAL_DAYS } from '../config/amirnet';

/**
 * Turns a test date into a day-by-day schedule across both tracks.
 *
 * The two tracks are deliberately NOT on the same timeline. AMIRNET has no fixed
 * dates and a 35-day retake window, so the plan front-loads it: train English hard for
 * about four weeks, sit the real test around week five, and — if it clears the target —
 * retire the track and hand all that daily time back to the PET, which by then is
 * entering full simulation. If it misses, there is still room for one remediation
 * cycle and a retake before the PET.
 */

export type Phase = 'A' | 'B' | 'C';

export const PHASE_INFO: Record<Phase, { he: string; description: string }> = {
  A: {
    he: 'שלב א׳ — הורדת טכניקות',
    description: 'אבחון ואז שיעורי טכניקה בלבד, כל שיעור עם תרגול יישום מיידי',
  },
  B: {
    he: 'שלב ב׳ — תרגול אדפטיבי',
    description: 'תרגול יומי מותאם לנושאים החלשים, עם חזרה מרווחת על כל טעות',
  },
  C: {
    he: 'שלב ג׳ — סימולציה',
    description: 'מבחנים מלאים בתנאי אמת ופרוטוקול סקירה קפדני אחרי כל אחד',
  },
};

export interface DayPlan {
  /** ISO yyyy-mm-dd. */
  date: string;
  dayIndex: number;
  phase: Phase;
  petFocus: string;
  englishFocus: string | null;
  /** Marks the recommended real AMIRNET sitting. */
  amirnetSitting: boolean;
  minutes: number;
}

export interface StudyPlan {
  startDate: string;
  testDate: string;
  totalDays: number;
  phaseBoundaries: { A: number; B: number };
  amirnetSittingDay: number | null;
  days: DayPlan[];
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round(
    (new Date(toIso + 'T00:00:00Z').getTime() - new Date(fromIso + 'T00:00:00Z').getTime()) /
      86_400_000,
  );
}

/**
 * Phase split. Proportional rather than fixed at 2/4/N weeks, so a short runway
 * compresses sensibly instead of leaving no time to simulate. Phase C is protected
 * hardest: going in without full timed mocks is the classic way to underperform.
 */
const PHASE_A_SHARE = 0.2;
const PHASE_B_SHARE = 0.4;

/** Ideal week-5 sitting, subject to there being time for a retake before the PET. */
const IDEAL_AMIRNET_DAY = 28;

export function buildPlan(input: {
  startDate: string;
  testDate: string;
  dailyMinutes: number;
  /** Skip the English track entirely when it is already cleared. */
  englishDone: boolean;
}): StudyPlan {
  const totalDays = Math.max(1, daysBetween(input.startDate, input.testDate));

  const aEnd = Math.max(3, Math.round(totalDays * PHASE_A_SHARE));
  const bEnd = Math.max(aEnd + 1, Math.round(totalDays * (PHASE_A_SHARE + PHASE_B_SHARE)));
  // Always leave at least a week for simulation, even on a very short runway.
  const boundedBEnd = Math.min(bEnd, Math.max(aEnd + 1, totalDays - 7));

  const amirnetSittingDay = input.englishDone
    ? null
    : pickAmirnetSittingDay(totalDays);

  const days: DayPlan[] = [];
  for (let i = 0; i < totalDays; i += 1) {
    const phase: Phase = i < aEnd ? 'A' : i < boundedBEnd ? 'B' : 'C';
    const pastSitting = amirnetSittingDay !== null && i > amirnetSittingDay;

    days.push({
      date: addDays(input.startDate, i),
      dayIndex: i,
      phase,
      petFocus: petFocusFor(phase),
      englishFocus: input.englishDone || pastSitting ? null : englishFocusFor(i, amirnetSittingDay),
      amirnetSitting: i === amirnetSittingDay,
      // Once English retires, its share of the daily budget goes back to the PET.
      minutes: input.dailyMinutes,
    });
  }

  return {
    startDate: input.startDate,
    testDate: input.testDate,
    totalDays,
    phaseBoundaries: { A: aEnd, B: boundedBEnd },
    amirnetSittingDay,
    days,
  };
}

/**
 * Sits AMIRNET at week 5 when there is room, but always leaves a full retake window
 * (35 days) plus a few days before the PET — booking it too late means a miss cannot
 * be fixed. On a runway too short for that, it goes as early as is credible.
 */
function pickAmirnetSittingDay(totalDays: number): number | null {
  if (totalDays < 14) return null; // Not enough runway to prepare for it meaningfully.

  const latestUseful = totalDays - RETAKE_INTERVAL_DAYS - 3;
  if (latestUseful < 7) {
    // No room for a retake; sit it early enough to at least have the score in hand.
    return Math.max(7, Math.floor(totalDays * 0.4));
  }
  return Math.min(IDEAL_AMIRNET_DAY, latestUseful);
}

function petFocusFor(phase: Phase): string {
  switch (phase) {
    case 'A':
      return 'שיעורי טכניקה + תרגול יישום';
    case 'B':
      return 'תרגול אדפטיבי בנושאים החלשים + חזרה מרווחת';
    case 'C':
      return 'סימולציה מלאה בתנאי אמת + סקירת טעויות';
  }
}

function englishFocusFor(dayIndex: number, sittingDay: number | null): string {
  if (sittingDay !== null && dayIndex === sittingDay) return 'גש למבחן אמירנט האמיתי';
  if (dayIndex < 7) return 'אוצר מילים יומי + טכניקת השלמת משפטים';
  if (dayIndex < 14) return 'אוצר מילים יומי + ניסוח מחדש';
  if (dayIndex < 21) return 'אוצר מילים יומי + הבנת הנקרא';
  return 'סימולציה אדפטיבית מלאה + חזרה על מילים שנפלת בהן';
}

export function phaseFor(plan: StudyPlan, dateIso: string): Phase | null {
  return plan.days.find((d) => d.date === dateIso)?.phase ?? null;
}

// --- daily quests -----------------------------------------------------------------

export interface QuestSeed {
  id: string;
  label: string;
  href: string;
  target: number;
  xp: number;
}

/**
 * Three quests a day, generated from actual weakness rather than a fixed list: the
 * weakest PET topic, the spaced-repetition backlog, and the English track until it
 * retires. Small targets — the point is to guarantee the session starts.
 */
export function generateQuests(input: {
  weakestTopic: { id: string; label: string } | null;
  dueCardCount: number;
  englishDone: boolean;
  phase: Phase;
}): QuestSeed[] {
  const quests: QuestSeed[] = [];

  if (input.weakestTopic) {
    quests.push({
      id: `drill-${input.weakestTopic.id}`,
      label: `תרגל 8 שאלות ב${input.weakestTopic.label}`,
      href: `#/drill/${input.weakestTopic.id}`,
      target: 8,
      xp: 40,
    });
  }

  if (input.dueCardCount > 0) {
    const target = Math.min(15, input.dueCardCount);
    quests.push({
      id: 'review-due',
      label: `סגור ${target} כרטיסי חזרה`,
      href: '#/review',
      target,
      xp: 35,
    });
  }

  if (!input.englishDone) {
    quests.push({
      id: 'english-vocab',
      label: 'עשה 20 מילים באנגלית',
      href: '#/english/vocab',
      target: 20,
      xp: 30,
    });
  }

  // Phase C earns its own quest: simulation only counts if it actually happens.
  if (input.phase === 'C' && quests.length < 3) {
    quests.push({
      id: 'timed-section',
      label: 'העבר פרק אחד בזמן מלא',
      href: '#/boss',
      target: 1,
      xp: 60,
    });
  }

  return quests.slice(0, 3);
}
