import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  EXTERNAL_SECTION_PRESETS,
  OFFICIAL_SOURCES,
  externalItemId,
} from '../content/officialSources';
import { ALL_TOPICS, topicLabel } from '../config/blueprint';
import { updateRating, STARTING_RATING } from '../engine/adaptive';
import { ERROR_LABELS, type ErrorType } from '../engine/errorTaxonomy';
import { gradeFrom, newCard, review } from '../engine/srs';
import { xpForAnswer } from '../engine/gamification';
import { useStore } from '../state/store';
import { today } from '../lib/date';

/**
 * Log questions solved in official NITE papers.
 *
 * NITE publishes past exams and practice tests free, with solutions — they are the best
 * practice material in existence, and far larger than any bank this app could author.
 * They are also copyrighted, so the app does not reproduce them. Instead you solve them
 * from the official PDF and record the outcome here.
 *
 * What you get for it is everything the app already does: the topic heatmap, the error
 * taxonomy, the score projection and the spaced-repetition queue all treat these
 * attempts exactly like authored ones, because they land in the same attempt log.
 */
export function ExternalLog() {
  const abilities = useStore((s) => s.abilities);
  const logExternalAttempt = useStore((s) => s.logExternalAttempt);
  const upsertSrsCard = useStore((s) => s.upsertSrsCard);
  const addXp = useStore((s) => s.addXp);
  const registerActivity = useStore((s) => s.registerActivity);
  const externalRefs = useStore((s) => s.externalRefs);
  const attempts = useStore((s) => s.attempts);

  const [source, setSource] = useState('');
  const [section, setSection] = useState<string>(EXTERNAL_SECTION_PRESETS[0]);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [topic, setTopic] = useState<string>(ALL_TOPICS[0].id);
  const [difficulty, setDifficulty] = useState(3);
  const [timeSec, setTimeSec] = useState(60);
  const [errorType, setErrorType] = useState<ErrorType | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const loggedCount = Object.keys(externalRefs).length;
  const externalAttempts = attempts.filter((a) => a.itemId.startsWith('ext:'));
  const externalCorrect = externalAttempts.filter((a) => a.correct).length;

  const submit = (correct: boolean) => {
    if (source.trim() === '') {
      setFlash('יש לציין מאיזה מבחן השאלה');
      return;
    }

    const itemId = externalItemId(source, section, questionNumber);
    const rating = abilities[topic]?.rating ?? STARTING_RATING;

    logExternalAttempt(
      { itemId, source: source.trim(), section, questionNumber, topic, difficulty },
      { correct, timeSec, errorType: correct ? null : errorType },
      updateRating(rating, difficulty, correct),
    );

    // A missed official question is exactly what spaced repetition should bring back.
    const card = useStore.getState().srs[itemId] ?? newCard(itemId, 'item', today());
    // Target time is unknown for an external question, so grade on the user's own
    // reported time against a nominal target for that difficulty.
    const nominalTarget = 30 + difficulty * 15;
    upsertSrsCard(review(card, gradeFrom(correct, timeSec, nominalTarget), today()));

    addXp(xpForAnswer(correct, difficulty, 0));
    registerActivity();

    setFlash(`נרשמה שאלה ${questionNumber} — ${correct ? 'נכונה' : 'שגויה'}`);
    setQuestionNumber((n) => n + 1);
    setErrorType(null);
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold">📄 מבחנים רשמיים</h1>
        <p className="text-sm text-slate-400">
          פתור מבחן אמיתי מאתר המרכז הארצי, ורשום כאן כל שאלה. המעקב, החזרה המרווחת
          וההערכה יעבדו בדיוק כמו על שאלות האפליקציה.
        </p>
      </header>

      <section className="card space-y-2">
        <h2 className="text-sm font-semibold text-slate-400">מאיפה להוריד</h2>
        {OFFICIAL_SOURCES.map((src) => (
          <a
            key={src.id}
            href={src.url}
            target="_blank"
            rel="noreferrer"
            className="block rounded-lg border border-ink-600 bg-ink-700/40 p-2.5 transition hover:bg-ink-700"
          >
            <p className="text-sm font-medium text-slate-100">{src.label} ↗</p>
            <p className="text-xs text-slate-400">{src.description}</p>
          </a>
        ))}
        <p className="pt-1 text-xs text-slate-500">
          המבחנים מוגנים בזכויות יוצרים ולכן אינם משוכפלים לתוך האפליקציה. פתור אותם
          מהמקור הרשמי — זה גם ממילא חומר התרגול הטוב ביותר שקיים.
        </p>
      </section>

      <section className="card space-y-3">
        <h2 className="text-sm font-semibold text-slate-400">רישום שאלה</h2>

        <label className="block">
          <span className="mb-1 block text-xs text-slate-400">מאיזה מבחן</span>
          <input
            className="input"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="לדוגמה: מבחן התנסות 1"
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">פרק</span>
            <select className="input" value={section} onChange={(e) => setSection(e.target.value)}>
              {EXTERNAL_SECTION_PRESETS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">מספר שאלה</span>
            <input
              type="number"
              min={1}
              className="input"
              value={questionNumber}
              onChange={(e) => setQuestionNumber(Math.max(1, Number(e.target.value)))}
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs text-slate-400">נושא</span>
          <select className="input" value={topic} onChange={(e) => setTopic(e.target.value)}>
            {ALL_TOPICS.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">רמת קושי (1-5)</span>
            <input
              type="number"
              min={1}
              max={5}
              className="input"
              value={difficulty}
              onChange={(e) => setDifficulty(Math.min(5, Math.max(1, Number(e.target.value))))}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">זמן בשניות</span>
            <input
              type="number"
              min={1}
              className="input"
              value={timeSec}
              onChange={(e) => setTimeSec(Math.max(1, Number(e.target.value)))}
            />
          </label>
        </div>

        <div>
          <span className="mb-1 block text-xs text-slate-400">אם טעית — מה קרה?</span>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(ERROR_LABELS) as ErrorType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setErrorType(errorType === type ? null : type)}
                className={`rounded-lg border px-2.5 py-1 text-xs transition ${
                  errorType === type
                    ? 'border-xp bg-xp/15 text-xp'
                    : 'border-ink-600 bg-ink-700/40 text-slate-300'
                }`}
              >
                {ERROR_LABELS[type].he}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button type="button" className="btn-ghost flex-1" onClick={() => submit(false)}>
            טעיתי
          </button>
          <button type="button" className="btn-primary flex-1" onClick={() => submit(true)}>
            פתרתי נכון
          </button>
        </div>

        {flash && <p className="text-center text-xs text-quant">{flash}</p>}
      </section>

      {externalAttempts.length > 0 && (
        <section className="card">
          <h2 className="mb-2 text-sm font-semibold text-slate-400">מה נרשם עד כה</h2>
          <p className="num text-sm text-slate-300">
            {externalCorrect}/{externalAttempts.length} שאלות ממבחנים רשמיים
            <span className="text-slate-500">
              {' '}· דיוק {Math.round((externalCorrect / externalAttempts.length) * 100)}%
            </span>
          </p>
          <p className="num mt-1 text-xs text-slate-500">
            {loggedCount} שאלות שונות · הנתונים משוקללים בכל המסכים
          </p>
        </section>
      )}

      <div className="flex gap-2">
        <Link to="/stats" className="btn-ghost flex-1 text-center">לנתונים</Link>
        <Link to="/review" className="btn-ghost flex-1 text-center">למרכז החזרה</Link>
      </div>
    </div>
  );
}

/** Renders an external reference where the review screen would show question text. */
export function ExternalRefCard({ itemId }: { itemId: string }) {
  const ref = useStore((s) => s.externalRefs[itemId]);
  if (!ref) return null;

  return (
    <div className="card">
      <p className="text-sm font-medium text-slate-100">
        {ref.source} · {ref.section} · שאלה <span className="num">{ref.questionNumber}</span>
      </p>
      <p className="mt-1 text-xs text-slate-400">
        {topicLabel(ref.topic)} · רמה <span className="num">{ref.difficulty}</span>
      </p>
      <p className="mt-2 text-xs text-slate-500">
        פתח את המבחן המקורי כדי לפתור שוב — תוכן השאלה אינו נשמר באפליקציה.
      </p>
    </div>
  );
}
