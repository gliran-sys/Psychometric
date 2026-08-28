import { useEffect, useRef, useState } from 'react';
import type { Item } from '../content/schema';
import { QuestionView } from './QuestionView';
import { useCountdown } from '../hooks/useTimer';
import { formatClock, paceStatus, PACE_LABELS, requiredPace } from '../engine/pacing';

export interface SectionAnswers {
  /** Index chosen per item, or null where the item was left blank. */
  answers: (number | null)[];
  elapsedSec: number;
  ranOutOfTime: boolean;
}

interface TimedSectionProps {
  title: string;
  items: Item[];
  minutes: number;
  onFinish: (result: SectionAnswers) => void;
}

/**
 * One timed section under exam conditions: no feedback until the end, free navigation
 * between questions, and a hard stop when the clock runs out.
 *
 * Withholding feedback is the whole point. Under the two-domain format there are only
 * two scored sections per domain, so a section lost to poor pacing costs a quarter of
 * that domain's evidence with no later section to recover in — the skill being trained
 * here is time allocation, and instant feedback would remove the pressure that trains it.
 */
export function TimedSection({ title, items, minutes, onFinish }: TimedSectionProps) {
  const totalSec = minutes * 60;
  const [answers, setAnswers] = useState<(number | null)[]>(() => items.map(() => null));
  const [index, setIndex] = useState(0);
  const { remainingSec, elapsedSec, expired } = useCountdown(totalSec, true);

  const answered = answers.filter((a) => a !== null).length;
  const pace = paceStatus(answered, items.length, elapsedSec, totalSec);
  const secPerRemaining = requiredPace(answered, items.length, elapsedSec, totalSec);

  // Auto-submit rather than letting the user keep working past the buzzer. This has to
  // be an effect: called during render it updates the parent mid-render, and it re-fires
  // on every subsequent render, submitting the section repeatedly.
  const submitted = useRef(false);
  useEffect(() => {
    if (!expired || submitted.current) return;
    submitted.current = true;
    onFinish({ answers, elapsedSec: totalSec, ranOutOfTime: true });
  }, [expired, answers, totalSec, onFinish]);

  const select = (choice: number) =>
    setAnswers((prev) => prev.map((a, i) => (i === index ? choice : a)));

  const current = items[index];
  const lowTime = remainingSec < 60;

  return (
    <div className="space-y-4">
      <header className="sticky top-14 z-10 -mx-4 border-b border-raised bg-paper/95 px-4 py-2 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-bold text-slate-100">{title}</h1>
            <p className={`text-xs ${PACE_LABELS[pace].className}`}>
              {PACE_LABELS[pace].he}
              {secPerRemaining !== null && (
                <span className="num text-slate-500"> · {Math.round(secPerRemaining)} שנ׳ לשאלה</span>
              )}
            </p>
          </div>
          <div className="text-end">
            <p className={`num text-2xl font-bold tabular-nums ${lowTime ? 'text-danger' : 'text-slate-100'}`}>
              {formatClock(remainingSec)}
            </p>
            <p className="num text-xs text-slate-500">
              {answered}/{items.length}
            </p>
          </div>
        </div>

        {/* Question grid doubles as a navigator and as a map of what is still blank. */}
        <div className="mt-2 flex flex-wrap gap-1">
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              className={`num h-6 w-6 rounded text-[11px] transition ${
                i === index
                  ? 'bg-xp text-paper'
                  : answers[i] !== null
                    ? 'bg-rule-strong text-slate-200'
                    : 'bg-raised text-slate-500'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </header>

      {current && (
        <QuestionView item={current} selected={answers[index]} onSelect={select} revealed={false} />
      )}

      <div className="flex gap-2">
        <button
          type="button"
          className="btn-ghost flex-1"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
        >
          הקודמת
        </button>
        {index < items.length - 1 ? (
          <button type="button" className="btn-primary flex-1" onClick={() => setIndex((i) => i + 1)}>
            הבאה
          </button>
        ) : (
          <button
            type="button"
            className="btn-primary flex-1"
            onClick={() => onFinish({ answers, elapsedSec, ranOutOfTime: false })}
          >
            סיים פרק
          </button>
        )}
      </div>
    </div>
  );
}

/** Scores a finished section against its items. */
export function scoreSection(items: Item[], answers: (number | null)[]) {
  const correct = items.reduce(
    (sum, item, i) => sum + (answers[i] === item.correctIndex ? 1 : 0),
    0,
  );
  return { correct, total: items.length, blank: answers.filter((a) => a === null).length };
}
