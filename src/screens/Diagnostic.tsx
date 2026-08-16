import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TimedSection, scoreSection } from '../components/TimedSection';
import { Meter } from '../components/Meter';
import { SCORE_SCALE, DOMAIN_LABELS, type Domain } from '../config/blueprint';
import { accuracyToDomainScore, generalScore } from '../engine/scoring';
import { updateRating } from '../engine/adaptive';
import { useStore } from '../state/store';
import { buildSection } from './BossFight';
import type { Item } from '../content/schema';

/** A shortened mock: one section per domain, enough to seed every topic's rating. */
const DIAGNOSTIC_SECTIONS: { domain: Domain; questions: number; minutes: number }[] = [
  { domain: 'verbal', questions: 12, minutes: 11 },
  { domain: 'quant', questions: 12, minutes: 12 },
];

/**
 * The first thing the app asks for. Its purpose is not a score — it is to seed the
 * adaptive engine with a real ability estimate per topic, so that day-one drilling is
 * already pointed at the right difficulty instead of spending a week calibrating.
 */
export function Diagnostic() {
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<{ domain: Domain; correct: number; total: number }[]>([]);

  const abilities = useStore((s) => s.abilities);
  const recordAttempt = useStore((s) => s.recordAttempt);
  const addXp = useStore((s) => s.addXp);
  const registerActivity = useStore((s) => s.registerActivity);
  const awardBadge = useStore((s) => s.awardBadge);

  const sections = useMemo(
    () =>
      DIAGNOSTIC_SECTIONS.map((s) => ({
        ...s,
        items: buildSection(s.domain, s.questions),
      })),
    [],
  );

  if (!started) {
    return (
      <div className="space-y-4">
        <header>
          <h1 className="text-xl font-bold">🧭 אבחון פתיחה</h1>
          <p className="text-sm text-slate-400">
            שני פרקים מקוצרים, כ-23 דקות בסך הכול.
          </p>
        </header>

        <div className="card text-sm leading-relaxed text-slate-300">
          <p className="font-medium text-slate-100">המטרה כאן אינה ציון</p>
          <p className="mt-1">
            האבחון מכייל את מנוע ההתאמה: אחריו כל תרגול מוגש לך ברמת הקושי הנכונה, במקום
            לבזבז שבוע על כיול. אל תנסה להיערך אליו — תוצאה מנופחת רק תגרום לאפליקציה
            להגיש לך שאלות קשות מדי.
          </p>
        </div>

        <button type="button" className="btn-primary w-full" onClick={() => setStarted(true)}>
          התחל אבחון
        </button>
        <Link to="/" className="block text-center text-xs text-slate-500">אולי אחר כך</Link>
      </div>
    );
  }

  if (index < sections.length) {
    const section = sections[index];
    return (
      <TimedSection
        key={section.domain}
        title={`אבחון — ${DOMAIN_LABELS[section.domain]}`}
        items={section.items}
        minutes={section.minutes}
        onFinish={(answers) => {
          const score = scoreSection(section.items, answers.answers);

          section.items.forEach((item: Item, i) => {
            const correct = answers.answers[i] === item.correctIndex;
            recordAttempt(
              {
                itemId: item.id,
                topic: item.topic,
                track: 'pet',
                correct,
                timeSec: Math.round(answers.elapsedSec / Math.max(1, section.items.length)),
                errorType: null,
              },
              updateRating(abilities[item.topic]?.rating ?? 1000, item.difficulty, correct),
            );
          });

          setResults((r) => [...r, { domain: section.domain, correct: score.correct, total: score.total }]);
          setIndex((i) => i + 1);

          if (index + 1 === sections.length) {
            addXp(120);
            awardBadge('first-blood');
            registerActivity();
          }
        }}
      />
    );
  }

  const accuracyFor = (domain: Domain) => {
    const row = results.find((r) => r.domain === domain);
    return row && row.total > 0 ? row.correct / row.total : 0.5;
  };

  const verbal = accuracyToDomainScore(accuracyFor('verbal'));
  const quant = accuracyToDomainScore(accuracyFor('quant'));

  return (
    <div className="space-y-4">
      <div className="card text-center">
        <div className="text-4xl">🧭</div>
        <h1 className="mt-1 text-lg font-bold">האבחון הושלם</h1>
        <p className="mt-1 text-sm text-slate-400">
          מנוע ההתאמה מכויל. מכאן כל תרגול מוגש ברמה שמתאימה לך.
        </p>
      </div>

      <div className="card">
        <Meter
          label="נקודת הפתיחה שלך"
          value={generalScore({ verbal, quant })}
          min={SCORE_SCALE.min}
          max={SCORE_SCALE.max}
          caption="הערכה גסה בלבד — מדגם קטן. היא תתחדד ככל שתתרגל."
        />
      </div>

      <div className="card space-y-2">
        {results.map((row) => (
          <div key={row.domain} className="flex justify-between text-sm">
            <span className="text-slate-300">{DOMAIN_LABELS[row.domain]}</span>
            <span className="num text-slate-200">
              {row.correct}/{row.total}
            </span>
          </div>
        ))}
      </div>

      <Link to="/map" className="btn-primary block text-center">
        למפת הכוחות
      </Link>
    </div>
  );
}
