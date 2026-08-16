/**
 * XP, levels, badges and combos.
 *
 * The game layer exists to make daily practice happen at all — the score projections
 * are the real metric, but nobody opens an app for a bar chart on day 34.
 */

/** XP needed to reach a given level. Quadratic, so levels keep meaning something. */
export function xpForLevel(level: number): number {
  return 50 * level * (level - 1);
}

export function levelFor(xp: number): number {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level += 1;
  return level;
}

export function levelProgress(xp: number): { level: number; into: number; needed: number; fraction: number } {
  const level = levelFor(xp);
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const into = xp - base;
  const needed = next - base;
  return { level, into, needed, fraction: needed > 0 ? into / needed : 1 };
}

/** XP for one drill answer, scaled by difficulty and the current combo. */
export function xpForAnswer(correct: boolean, difficulty: number, combo: number): number {
  if (!correct) return 1; // A miss still pays a little — reviewing it is the valuable part.
  const base = 4 + difficulty * 2;
  return Math.round(base * comboMultiplier(combo));
}

/** Combo multiplier caps at 2x so a hot streak rewards without dwarfing everything else. */
export function comboMultiplier(combo: number): number {
  return Math.min(2, 1 + combo * 0.1);
}

export interface BadgeDef {
  id: string;
  he: string;
  description: string;
  icon: string;
}

export const BADGES: BadgeDef[] = [
  { id: 'first-blood', he: 'הצעד הראשון', description: 'השלמת את התרגול הראשון', icon: '🎯' },
  { id: 'week-perfect', he: 'שבוע מושלם', description: 'שבעה ימי רצף', icon: '🔥' },
  { id: 'month-streak', he: 'חודש ברצף', description: 'שלושים ימי רצף', icon: '🏔️' },
  { id: 'analogy-master', he: 'אלוף האנלוגיות', description: 'שליטה מלאה באנלוגיות', icon: '🔗' },
  { id: 'geometry-slayer', he: 'ניצחון על גאומטריה', description: 'שליטה מלאה בגאומטריה', icon: '📐' },
  { id: 'essay-first', he: 'החיבור הראשון', description: 'כתבת מטלת כתיבה מלאה בזמן', icon: '✍️' },
  { id: 'mock-survivor', he: 'שרדת סימולציה', description: 'השלמת מבחן מלא', icon: '🛡️' },
  { id: 'english-exempt', he: 'פטור באנגלית', description: 'עברת את סף הפטור באמירנט', icon: '🎓' },
  { id: 'boss-slayer', he: 'קוטל בוסים', description: 'ניצחת קרב בוס ראשון', icon: '⚔️' },
  { id: 'vocab-100', he: 'מאה מילים', description: 'שלטת במאה מילים', icon: '📚' },
];

export function badgeById(id: string): BadgeDef | undefined {
  return BADGES.find((b) => b.id === id);
}

/**
 * Boss fight victory conditions. Both must be met: accuracy alone can be bought with
 * time, and speed alone with guessing — the real test demands both at once.
 */
export const BOSS_THRESHOLDS = { accuracy: 0.75, withinTime: true } as const;

export function bossResult(correct: number, total: number, finishedInTime: boolean) {
  const accuracy = total > 0 ? correct / total : 0;
  const won = accuracy >= BOSS_THRESHOLDS.accuracy && finishedInTime;
  return {
    won,
    accuracy,
    reason: won
      ? null
      : !finishedInTime
        ? 'לא סיימת בזמן — הקצב הוא חלק מהקרב'
        : `דיוק ${Math.round(accuracy * 100)}% מתוך ${Math.round(BOSS_THRESHOLDS.accuracy * 100)}% נדרשים`,
  };
}
