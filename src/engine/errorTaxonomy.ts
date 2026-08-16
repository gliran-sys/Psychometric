/**
 * Classifying misses is the backbone of the review loop. "I got 14/20" tells you
 * nothing actionable; "6 of my 6 misses were time pressure on reading comprehension"
 * tells you exactly what to change tomorrow.
 *
 * The app auto-suggests a class from timing and answer choice, and the user can
 * override it — the suggestion exists so that classifying every miss stays cheap
 * enough to actually do.
 */

export type ErrorType = 'concept-gap' | 'careless' | 'time-pressure' | 'trap' | 'misread';

export const ERROR_LABELS: Record<ErrorType, { he: string; hint: string }> = {
  'concept-gap': {
    he: 'פער בידע',
    hint: 'לא ידעת את הכלל או השיטה — חזרה לשיעור הטכניקה',
  },
  careless: {
    he: 'רשלנות',
    hint: 'ידעת, אבל מיהרת — האטה של חמש שניות לבדיקה',
  },
  'time-pressure': {
    he: 'לחץ זמן',
    hint: 'נגמר הזמן — תרגול קצב, לא תרגול תוכן',
  },
  trap: {
    he: 'מלכודת',
    hint: 'נפלת להסחה מתוכננת — קרא את ניתוח המסיחים',
  },
  misread: {
    he: 'קריאה שגויה',
    hint: 'פתרת שאלה אחרת מזו שנשאלה — סמן את מילת השאלה',
  },
};

export interface ClassificationInput {
  correct: boolean;
  timeSec: number;
  targetTimeSec: number;
  /**
   * True when the chosen option is one the author flagged as a designed distractor
   * rather than an arbitrary wrong answer.
   */
  choseFlaggedTrap: boolean;
}

/**
 * Heuristic first guess. Order matters: time pressure and carelessness are read from
 * the clock, a flagged distractor is read from the choice, and anything left over is
 * treated as a genuine knowledge gap.
 */
export function suggestErrorType(input: ClassificationInput): ErrorType | null {
  if (input.correct) return null;

  if (input.timeSec > input.targetTimeSec * 1.6) return 'time-pressure';
  if (input.timeSec < input.targetTimeSec * 0.4) return 'careless';
  if (input.choseFlaggedTrap) return 'trap';
  return 'concept-gap';
}

export interface TaxonomyBreakdown {
  type: ErrorType;
  count: number;
  share: number;
}

export function summarise(errorTypes: (ErrorType | null)[]): TaxonomyBreakdown[] {
  const misses = errorTypes.filter((e): e is ErrorType => e !== null);
  if (misses.length === 0) return [];

  const counts = new Map<ErrorType, number>();
  misses.forEach((e) => counts.set(e, (counts.get(e) ?? 0) + 1));

  return [...counts.entries()]
    .map(([type, count]) => ({ type, count, share: count / misses.length }))
    .sort((a, b) => b.count - a.count);
}

/**
 * The one line the review screen leads with. Different dominant error types call for
 * genuinely different responses, and naming that is the whole value of the taxonomy.
 */
export function primaryRecommendation(breakdown: TaxonomyBreakdown[]): string | null {
  const top = breakdown[0];
  if (!top) return null;

  switch (top.type) {
    case 'time-pressure':
      return 'רוב הטעויות שלך הן לחץ זמן — התוכן בשליטה. תרגל קצב: קרב זמן לשאלה, ודלג מוקדם על שאלות תקועות.';
    case 'careless':
      return 'רוב הטעויות שלך הן רשלנות — אתה יודע את החומר. הוסף בדיקה של חמש שניות לפני סימון התשובה.';
    case 'trap':
      return 'אתה נופל למסיחים מתוכננים. עבור על ניתוח המסיחים בכל שאלה שטעית בה — זה בדיוק מה שהמבחן בודק.';
    case 'misread':
      return 'אתה פותר שאלה אחרת מזו שנשאלה. סמן את מילת השאלה לפני שאתה מסתכל על התשובות.';
    case 'concept-gap':
      return 'יש פערי ידע אמיתיים. חזור לשיעורי הטכניקה בנושאים החלשים לפני שאתה מגדיל נפח תרגול.';
  }
}
