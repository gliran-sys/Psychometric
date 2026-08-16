import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TimedSection, scoreSection } from '../components/TimedSection';
import { Meter } from '../components/Meter';
import {
  CALCULATOR_ALLOWED,
  SECTIONS,
  SCORE_SCALE,
  TOTAL_MINUTES,
  WRITING_TASK,
  DOMAIN_LABELS,
} from '../config/blueprint';
import { accuracyToDomainScore, generalScore, verbalDomainScore } from '../engine/scoring';
import { updateRating } from '../engine/adaptive';
import { useStore } from '../state/store';
import { buildSection, shuffle } from './BossFight';
import type { Item } from '../content/schema';

/**
 * A full simulation of the two-domain PET: writing task, then five multiple-choice
 * sections, about 2.5 hours in total.
 *
 * Section order is shuffled on purpose. NITE does not publish the running order and it
 * varies between forms, so practising a fixed sequence would train a rhythm the real
 * test will not honour — and the experimental section is not flagged until the results
 * screen, exactly as on the day.
 */
export function MockExam() {
  const [started, setStarted] = useState(false);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [results, setResults] = useState<Record<string, { correct: number; total: number }>>({});
  const [finished, setFinished] = useState(false);

  const abilities = useStore((s) => s.abilities);
  const recordAttempt = useStore((s) => s.recordAttempt);
  const saveMock = useStore((s) => s.saveMock);
  const addXp = useStore((s) => s.addXp);
  const awardBadge = useStore((s) => s.awardBadge);
  const registerActivity = useStore((s) => s.registerActivity);
  const latestEssay = useStore((s) => [...s.essayDrafts].reverse()[0] ?? null);

  const order = useMemo(() => shuffle(SECTIONS), []);
  const sectionItems = useMemo(
    () => order.map((section) => buildSection(section.domain, section.questionCount)),
    [order],
  );

  if (!started) {
    return (
      <div className="space-y-4">
        <header>
          <h1 className="text-xl font-bold">🛡️ סימולציה מלאה</h1>
          <p className="text-sm text-slate-400">
            המבנה החדש, החל ממועד דצמבר 2026: מטלת כתיבה ואחריה חמישה פרקים.
          </p>
        </header>

        <div className="card space-y-1.5 text-sm text-slate-300">
          <Row label="מטלת כתיבה" value={`${WRITING_TASK.minutes} דקות`} />
          <Row label="חשיבה מילולית" value="2 פרקים" />
          <Row label="חשיבה כמותית" value="2 פרקים" />
          <Row label="פרק ניסיוני" value="1 פרק (לא ידוע איזה)" />
          <Row label="משך כולל" value={`כ-${Math.round(TOTAL_MINUTES / 60 * 10) / 10} שעות`} />
        </div>

        <div className="card border-danger/40 bg-danger/5 text-sm text-slate-300">
          <p className="font-medium text-danger">תנאי אמת</p>
          <ul className="mt-1 space-y-0.5 text-xs">
            {!CALCULATOR_ALLOWED && <li>· בלי מחשבון. אין דף נוסחאות.</li>
            }
            <li>· בלי הפסקות בין הפרקים.</li>
            <li>· סדר הפרקים אקראי, כמו במבחן האמיתי.</li>
            <li>· לא תדע איזה פרק ניסיוני עד סוף הסימולציה.</li>
          </ul>
        </div>

        <Link to="/essay" className="btn-ghost block text-center">
          התחל במטלת הכתיבה
        </Link>
        <button type="button" className="btn-primary w-full" onClick={() => setStarted(true)}>
          דלג לפרקים והתחל
        </button>
      </div>
    );
  }

  if (!finished) {
    const section = order[sectionIndex];
    const items = sectionItems[sectionIndex];

    return (
      <TimedSection
        key={section.id}
        title={`${section.label} (${sectionIndex + 1}/${order.length})`}
        items={items}
        minutes={section.minutes}
        onFinish={(answers) => {
          const score = scoreSection(items, answers.answers);

          items.forEach((item, i) => {
            const correct = answers.answers[i] === item.correctIndex;
            recordAttempt(
              {
                itemId: item.id,
                topic: item.topic,
                track: 'pet',
                correct,
                timeSec: Math.round(answers.elapsedSec / Math.max(1, items.length)),
                errorType: null,
              },
              updateRating(abilities[item.topic]?.rating ?? 1000, item.difficulty, correct),
            );
          });

          const next = { ...results, [section.id]: { correct: score.correct, total: score.total } };
          setResults(next);

          if (sectionIndex + 1 < order.length) {
            setSectionIndex((i) => i + 1);
          } else {
            finalise(next);
          }
        }}
      />
    );
  }

  return <MockResults order={order} sectionItems={sectionItems} results={results} />;

  function finalise(all: Record<string, { correct: number; total: number }>) {
    // The experimental section is excluded from scoring — as on the real test.
    const scored = SECTIONS.filter((s) => !s.experimental);
    const tally = (domain: 'verbal' | 'quant') => {
      const rows = scored.filter((s) => s.domain === domain).map((s) => all[s.id]).filter(Boolean);
      const correct = rows.reduce((sum, r) => sum + r.correct, 0);
      const total = rows.reduce((sum, r) => sum + r.total, 0);
      return total > 0 ? correct / total : 0;
    };

    const essayDomain =
      latestEssay?.contentScore != null && latestEssay?.languageScore != null
        ? accuracyToDomainScore((latestEssay.contentScore + latestEssay.languageScore) / 12)
        : null;

    const verbal = verbalDomainScore(tally('verbal'), essayDomain);
    const quant = accuracyToDomainScore(tally('quant'));
    const general = generalScore({ verbal, quant });

    saveMock({
      id: `mock-${Date.now()}`,
      sectionScores: all,
      estimatedScore: general,
      verbalScore: Math.round(verbal),
      quantScore: Math.round(quant),
      at: new Date().toISOString(),
    });
    addXp(300);
    awardBadge('mock-survivor');
    registerActivity();
    setFinished(true);
  }
}

function MockResults({
  order,
  sectionItems,
  results,
}: {
  order: typeof SECTIONS;
  sectionItems: Item[][];
  results: Record<string, { correct: number; total: number }>;
}) {
  const mock = useStore((s) => s.mockResults[s.mockResults.length - 1]);
  if (!mock) return null;

  return (
    <div className="space-y-4">
      <div className="card text-center">
        <div className="text-4xl">🛡️</div>
        <h1 className="mt-1 text-lg font-bold">סיימת סימולציה מלאה</h1>
      </div>

      <div className="card">
        <Meter
          label="ציון משוער"
          value={mock.estimatedScore}
          min={SCORE_SCALE.min}
          max={SCORE_SCALE.max}
          caption={`${DOMAIN_LABELS.verbal} ${mock.verbalScore} · ${DOMAIN_LABELS.quant} ${mock.quantScore}`}
        />
      </div>

      <div className="card space-y-2">
        <h2 className="text-sm font-semibold text-slate-400">לפי פרק</h2>
        {order.map((section) => {
          const row = results[section.id];
          if (!row) return null;
          return (
            <div key={section.id} className="flex items-center justify-between text-sm">
              <span className="text-slate-300">
                {section.label}
                {section.experimental && (
                  <span className="ms-1.5 rounded bg-ink-600 px-1.5 py-0.5 text-[10px] text-slate-400">
                    ניסיוני — לא נספר
                  </span>
                )}
              </span>
              <span className="num text-slate-200">
                {row.correct}/{row.total}
                <span className="ms-1 text-slate-500">
                  ({Math.round((row.correct / row.total) * 100)}%)
                </span>
              </span>
            </div>
          );
        })}
        <p className="pt-1 text-xs text-slate-500">
          {sectionItems.flat().length} שאלות בסך הכול. כל שאלה נרשמה ביומן הטעויות — עבור עליהן במרכז החזרה.
        </p>
      </div>

      <div className="flex gap-2">
        <Link to="/review" className="btn-primary flex-1 text-center">לסקירת הטעויות</Link>
        <Link to="/" className="btn-ghost flex-1 text-center">לבית</Link>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-200">{value}</span>
    </div>
  );
}
