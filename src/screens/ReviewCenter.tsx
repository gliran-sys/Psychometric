import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { QuestionView } from '../components/QuestionView';
import { dueCards, gradeFrom, review } from '../engine/srs';
import { ERROR_LABELS, primaryRecommendation, summarise, type ErrorType } from '../engine/errorTaxonomy';
import { itemById, vocabById } from '../content';
import { isExternalItemId } from '../content/officialSources';
import { ExternalRefCard } from './ExternalLog';
import { useStore } from '../state/store';
import { today } from '../lib/date';
import { isEnglishItem } from '../content/schema';

/**
 * The retention half of the app: the spaced-repetition queue plus the error log.
 *
 * A missed item you never see again is a missed item you will miss again on test day,
 * so everything answered anywhere in the app files into this queue automatically.
 */
export function ReviewCenter() {
  const [tab, setTab] = useState<'queue' | 'log'>('queue');
  const srs = useStore((s) => s.srs);
  const due = useMemo(() => dueCards(srs, today()), [srs]);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">🔁 מרכז החזרה</h1>
        <div className="flex gap-1 rounded-lg bg-ink-700 p-0.5 text-sm">
          <button
            type="button"
            onClick={() => setTab('queue')}
            className={`rounded px-3 py-1 ${tab === 'queue' ? 'bg-ink-600 text-slate-100' : 'text-slate-400'}`}
          >
            תור <span className="num">({due.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('log')}
            className={`rounded px-3 py-1 ${tab === 'log' ? 'bg-ink-600 text-slate-100' : 'text-slate-400'}`}
          >
            יומן טעויות
          </button>
        </div>
      </header>

      {tab === 'queue' ? <ReviewQueue /> : <ErrorLog />}
    </div>
  );
}

function ReviewQueue() {
  const srs = useStore((s) => s.srs);
  const upsertSrsCard = useStore((s) => s.upsertSrsCard);
  const addXp = useStore((s) => s.addXp);
  const registerActivity = useStore((s) => s.registerActivity);
  const advanceQuest = useStore((s) => s.advanceQuest);

  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(0);

  const due = useMemo(() => dueCards(srs, today()), [srs]);
  const card = due[0];

  if (!card) {
    return (
      <div className="space-y-3 py-10 text-center">
        <div className="text-4xl">✅</div>
        <p className="font-medium">אין כרטיסים לחזרה היום</p>
        <p className="num text-sm text-slate-500">סגרת {done} כרטיסים</p>
        <Link to="/map" className="btn-ghost inline-block">לתרגול חדש</Link>
      </div>
    );
  }

  if (card.kind === 'vocab') {
    const entry = vocabById(card.id);
    if (!entry) return null;

    const grade = (known: boolean) => {
      upsertSrsCard(review(card, known ? 5 : 1, today()));
      addXp(known ? 6 : 2);
      registerActivity();
      advanceQuest('review-due');
      setDone((d) => d + 1);
      setRevealed(false);
    };

    return (
      <div className="space-y-4">
        <div className="card min-h-[9rem] text-center">
          <p className="text-2xl font-bold text-slate-50">{entry.term}</p>
          {revealed ? (
            <>
              <p className="mt-2 text-slate-300">{entry.meaning}</p>
              {entry.example && (
                <p className="mt-2 text-sm italic text-slate-500">{entry.example}</p>
              )}
            </>
          ) : (
            <p className="mt-6 text-sm text-slate-500">נסה להיזכר, ואז גלה</p>
          )}
        </div>

        {revealed ? (
          <div className="flex gap-2">
            <button type="button" className="btn-ghost flex-1" onClick={() => grade(false)}>
              לא ידעתי
            </button>
            <button type="button" className="btn-primary flex-1" onClick={() => grade(true)}>
              ידעתי
            </button>
          </div>
        ) : (
          <button type="button" className="btn-primary w-full" onClick={() => setRevealed(true)}>
            גלה
          </button>
        )}
      </div>
    );
  }

  // An external card points at a paper question whose text the app deliberately does
  // not store. Show the pointer and let the user self-grade after solving it there.
  if (isExternalItemId(card.id)) {
    const grade = (correct: boolean) => {
      upsertSrsCard(review(card, correct ? 5 : 1, today()));
      addXp(correct ? 8 : 3);
      registerActivity();
      advanceQuest('review-due');
      setDone((d) => d + 1);
    };

    return (
      <div className="space-y-4">
        <p className="num text-xs text-slate-500">
          נותרו {due.length} · נפילות בכרטיס זה: {card.lapses}
        </p>
        <ExternalRefCard itemId={card.id} />
        <div className="flex gap-2">
          <button type="button" className="btn-ghost flex-1" onClick={() => grade(false)}>
            טעיתי שוב
          </button>
          <button type="button" className="btn-primary flex-1" onClick={() => grade(true)}>
            פתרתי נכון
          </button>
        </div>
      </div>
    );
  }

  const item = itemById(card.id);
  if (!item) return null;

  const answer = (index: number) => {
    setSelected(index);
    setRevealed(true);
    const correct = index === item.correctIndex;
    // Reviews are untimed, so grade on correctness alone by passing the target time.
    upsertSrsCard(review(card, gradeFrom(correct, item.targetTimeSec, item.targetTimeSec), today()));
    addXp(correct ? 8 : 3);
    registerActivity();
    advanceQuest('review-due');
  };

  return (
    <div className="space-y-4">
      <p className="num text-xs text-slate-500">
        נותרו {due.length} · נפילות בכרטיס זה: {card.lapses}
      </p>

      <QuestionView item={item} selected={selected} onSelect={answer} revealed={revealed} />

      {revealed && (
        <button
          type="button"
          className="btn-primary w-full"
          onClick={() => {
            setSelected(null);
            setRevealed(false);
            setDone((d) => d + 1);
          }}
        >
          הכרטיס הבא
        </button>
      )}
    </div>
  );
}

function ErrorLog() {
  const attempts = useStore((s) => s.attempts);
  const [filter, setFilter] = useState<ErrorType | 'all'>('all');

  const misses = attempts.filter((a) => !a.correct);
  const breakdown = summarise(misses.map((m) => m.errorType));
  const recommendation = primaryRecommendation(breakdown);

  const shown = filter === 'all' ? misses : misses.filter((m) => m.errorType === filter);

  if (misses.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-500">עוד אין טעויות ביומן.</p>;
  }

  return (
    <div className="space-y-4">
      {recommendation && (
        <div className="card border-xp/40 bg-xp/5 text-sm leading-relaxed text-slate-200">
          {recommendation}
        </div>
      )}

      {/* Hidden when nothing is classified yet — an empty breakdown would render as a
          blank card, which reads as a rendering fault rather than as "no data". */}
      <div className={`card space-y-2 ${breakdown.length === 0 ? 'hidden' : ''}`}>
        {breakdown.map((row) => (
          <button
            key={row.type}
            type="button"
            onClick={() => setFilter(filter === row.type ? 'all' : row.type)}
            className="w-full text-start"
          >
            <div className="mb-1 flex justify-between text-sm">
              <span className={filter === row.type ? 'font-semibold text-xp' : 'text-slate-300'}>
                {ERROR_LABELS[row.type].he}
              </span>
              <span className="num text-slate-400">
                {row.count} · {Math.round(row.share * 100)}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-ink-700">
              <div className="h-full bg-danger/70" style={{ width: `${row.share * 100}%` }} />
            </div>
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {shown.slice(-25).reverse().map((miss, i) => {
          if (isExternalItemId(miss.itemId)) {
            return (
              <div key={`${miss.itemId}-${i}`}>
                <ExternalRefCard itemId={miss.itemId} />
              </div>
            );
          }
          const item = itemById(miss.itemId);
          if (!item) return null;
          return (
            <details key={`${miss.itemId}-${i}`} className="card">
              <summary
                className="cursor-pointer text-sm text-slate-300"
                dir={isEnglishItem(item) ? 'ltr' : 'rtl'}
              >
                {item.stem.slice(0, 70)}
                {item.stem.length > 70 && '…'}
              </summary>
              <div className="mt-3">
                <QuestionView item={item} selected={null} onSelect={() => {}} revealed />
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
