/**
 * Single source of truth for the structure of the two-domain Psychometric Entrance Test
 * (PET) as it takes effect with the Winter (December) 2026 administration.
 *
 * Verified against NITE's announcement (nite.org.il, notice of 15/02/2026):
 *   - The English domain is removed; the test comprises Verbal + Quantitative only.
 *   - A writing task followed by FIVE multiple-choice sections (was eight).
 *   - Two Verbal, two Quantitative, one experimental — order not published.
 *   - Total duration shortened by one hour, to roughly 2.5 hours.
 *   - Score scale unchanged: 200-800.
 *
 * Per-section question counts are NOT published by NITE and prep providers disagree
 * (verbal is variously reported as 20-27). Everything downstream reads these numbers
 * from here, so when the final spec lands, correcting this file is the whole change.
 */

export type Domain = 'verbal' | 'quant';

export interface SectionBlueprint {
  id: string;
  domain: Domain;
  /** Displayed in Hebrew — the whole UI is Hebrew/RTL. */
  label: string;
  questionCount: number;
  minutes: number;
  /**
   * Experimental ("pilot") sections do not count toward the score. The real test
   * gives no indication which section it is — so neither do we, until the review
   * screen. Treating every section as scored is the correct exam-day behaviour.
   */
  experimental: boolean;
}

export const SCORE_SCALE = { min: 200, max: 800 } as const;

/** Weighting after the reform: English is gone, so the two domains split the score evenly. */
export const DOMAIN_WEIGHTS: Record<Domain, number> = {
  verbal: 0.5,
  quant: 0.5,
};

/**
 * The writing task is scored inside the Verbal domain and is worth a quarter of it.
 * Verbal is half the total score, so the essay alone is ~12.5% of the final number —
 * the single best hours-to-points ratio on the test.
 */
export const ESSAY_SHARE_OF_VERBAL = 0.25;

export const WRITING_TASK = {
  minutes: 30,
  minLines: 25,
  maxLines: 50,
} as const;

/**
 * Section order is deliberately fixed here for reproducible mocks. NITE does not
 * publish the running order and it varies between test forms, so `shuffleSections`
 * in the mock exam screen randomises it to avoid training an order-dependent rhythm.
 */
export const SECTIONS: SectionBlueprint[] = [
  { id: 'v1', domain: 'verbal', label: 'חשיבה מילולית א׳', questionCount: 23, minutes: 20, experimental: false },
  { id: 'q1', domain: 'quant', label: 'חשיבה כמותית א׳', questionCount: 20, minutes: 20, experimental: false },
  { id: 'v2', domain: 'verbal', label: 'חשיבה מילולית ב׳', questionCount: 23, minutes: 20, experimental: false },
  { id: 'q2', domain: 'quant', label: 'חשיבה כמותית ב׳', questionCount: 20, minutes: 20, experimental: false },
  { id: 'x1', domain: 'quant', label: 'פרק ניסיוני', questionCount: 20, minutes: 20, experimental: true },
];

export const SCORED_SECTIONS = SECTIONS.filter((s) => !s.experimental);

/** Total seat time for a full mock, including the writing task. */
export const TOTAL_MINUTES =
  WRITING_TASK.minutes + SECTIONS.reduce((sum, s) => sum + s.minutes, 0);

export const DOMAIN_LABELS: Record<Domain, string> = {
  verbal: 'חשיבה מילולית',
  quant: 'חשיבה כמותית',
};

/** Topics form the skill-tree nodes and the unit of ability tracking. */
export const TOPICS = {
  verbal: [
    { id: 'analogies', label: 'אנלוגיות', questionsPerSection: 6 },
    { id: 'sentence-completion', label: 'השלמת משפטים', questionsPerSection: 5 },
    { id: 'logic', label: 'הסקה והיגיון', questionsPerSection: 4 },
    { id: 'reading', label: 'הבנת הנקרא', questionsPerSection: 8 },
  ],
  quant: [
    { id: 'algebra', label: 'אלגברה', questionsPerSection: 5 },
    { id: 'geometry', label: 'גאומטריה', questionsPerSection: 4 },
    { id: 'word-problems', label: 'בעיות מילוליות', questionsPerSection: 4 },
    { id: 'ratios-percents', label: 'יחס ואחוזים', questionsPerSection: 3 },
    { id: 'data-interpretation', label: 'הסקה מתרשים', questionsPerSection: 4 },
  ],
} as const;

export type VerbalTopic = (typeof TOPICS.verbal)[number]['id'];
export type QuantTopic = (typeof TOPICS.quant)[number]['id'];
export type Topic = VerbalTopic | QuantTopic;

export const ALL_TOPICS = [...TOPICS.verbal, ...TOPICS.quant];

export function topicLabel(id: string): string {
  return ALL_TOPICS.find((t) => t.id === id)?.label ?? id;
}

export function topicDomain(id: string): Domain {
  return TOPICS.verbal.some((t) => t.id === id) ? 'verbal' : 'quant';
}

/** No calculator is permitted. The mock exam surfaces this as a hard rule, not a tip. */
export const CALCULATOR_ALLOWED = false;
