/**
 * Pointers to the official practice material, and the metadata needed to log work
 * against it.
 *
 * NITE publishes past exams and practice tests free of charge, with full solutions.
 * They remain copyrighted, so nothing from them is reproduced here — this module holds
 * only links and structural facts (how many questions a section has), which lets the
 * app track your performance on those exams without copying a single question.
 *
 * Solving a real past paper is better practice than any authored imitation. This is
 * how you get the app's adaptive tracking, spaced repetition and error analytics
 * pointed at that material.
 */

export interface OfficialSource {
  id: string;
  label: string;
  description: string;
  url: string;
}

export const OFFICIAL_SOURCES: OfficialSource[] = [
  {
    id: 'nite-practice',
    label: 'בחינות להתנסות — המרכז הארצי',
    description:
      'מבחנים מלאים לדוגמה עם פתרונות, ישירות מהגוף שמעביר את הבחינה. חומר התרגול הטוב ביותר שקיים.',
    url: 'https://www.nite.org.il/psychometric-entrance-test/preparation/hebrew-practice-tests/?lang=he',
  },
  {
    id: 'campus-il',
    label: 'הפסיכומטרי של המדינה — קמפוס IL',
    description:
      'קורס הכנה מקוון חינמי של המשרד לשוויון חברתי בשיתוף המרכז הארצי, כולל שאלות ותרגול.',
    url: 'https://campus.gov.il/course/mse-gov-psychometry-he/',
  },
  {
    id: 'nite-amirnet',
    label: 'אמירנט — מידע ודוגמאות רשמיות',
    description: 'מבנה המבחן ושאלות לדוגמה מטעם המרכז הארצי.',
    url: 'https://www.nite.org.il/other-tests/amirnet/?lang=he',
  },
];

/**
 * Section labels offered when logging an external question. Free text is also allowed,
 * because exam papers differ in how they label their sections.
 */
export const EXTERNAL_SECTION_PRESETS = [
  'מילולי א׳',
  'מילולי ב׳',
  'כמותי א׳',
  'כמותי ב׳',
  'אנגלית א׳',
  'אנגלית ב׳',
  'פרק ניסיוני',
] as const;

/**
 * Builds the synthetic item id used to record an external question.
 *
 * External attempts are stored in the SAME attempt log as authored items, so every
 * existing analytic — the topic heatmap, the error taxonomy, the score projection,
 * the spaced-repetition queue — works on them with no special-casing. The `ext:`
 * prefix is what lets the review screen know to show a pointer to the paper rather
 * than looking for question text it does not have.
 */
export function externalItemId(source: string, section: string, questionNumber: number): string {
  const slug = (s: string) => s.trim().replace(/\s+/g, '-');
  return `ext:${slug(source)}:${slug(section)}:${questionNumber}`;
}

export function isExternalItemId(id: string): boolean {
  return id.startsWith('ext:');
}
