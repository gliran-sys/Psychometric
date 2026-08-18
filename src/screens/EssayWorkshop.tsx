import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ESSAY_PROMPTS, ESSAY_RUBRIC } from '../content';
import { WRITING_TASK, ESSAY_SHARE_OF_VERBAL, DOMAIN_WEIGHTS } from '../config/blueprint';
import { useCountdown } from '../hooks/useTimer';
import { formatClock } from '../engine/pacing';
import { useStore } from '../state/store';
import { shuffle } from '../engine/sectionBuilder';

/**
 * The writing task — the best hours-to-points ratio on the exam and the part most
 * self-preppers skip.
 *
 * The essay is a quarter of the Verbal domain score, and Verbal is half the total under
 * the two-domain format, so this 30-minute task is worth about 12.5% of the final
 * number. The screen states that arithmetic openly, because believing it is what gets
 * someone to practise a task with no multiple-choice dopamine.
 */
const ESSAY_SHARE_OF_TOTAL = ESSAY_SHARE_OF_VERBAL * DOMAIN_WEIGHTS.verbal;

export function EssayWorkshop() {
  const [prompt, setPrompt] = useState(() => shuffle(ESSAY_PROMPTS)[0]);
  const [phase, setPhase] = useState<'brief' | 'writing' | 'scoring'>('brief');
  const [text, setText] = useState('');
  const [scores, setScores] = useState<Record<string, boolean>>({});

  const saveEssay = useStore((s) => s.saveEssay);
  const addXp = useStore((s) => s.addXp);
  const awardBadge = useStore((s) => s.awardBadge);
  const registerActivity = useStore((s) => s.registerActivity);
  const drafts = useStore((s) => s.essayDrafts);

  const { remainingSec, elapsedSec, expired } = useCountdown(
    WRITING_TASK.minutes * 60,
    phase === 'writing',
  );

  /** Line count against the 25-50 line requirement, estimated at ~70 chars per line. */
  const lineCount = useMemo(() => {
    if (text.trim() === '') return 0;
    return text.split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / 70)), 0);
  }, [text]);

  const inRange = lineCount >= WRITING_TASK.minLines && lineCount <= WRITING_TASK.maxLines;

  if (phase === 'brief') {
    return (
      <div className="space-y-4">
        <header>
          <h1 className="text-xl font-bold">מטלת כתיבה</h1>
          <p className="text-sm text-slate-400">
            {WRITING_TASK.minutes} דקות · {WRITING_TASK.minLines}-{WRITING_TASK.maxLines} שורות
          </p>
        </header>

        <div className="card border-xp/40 bg-xp/5">
          <p className="text-sm leading-relaxed text-slate-200">
            החיבור שווה <strong className="text-xp">{Math.round(ESSAY_SHARE_OF_VERBAL * 100)}%</strong> מציון
            החשיבה המילולית, והמילולי הוא{' '}
            <strong className="text-xp">{Math.round(DOMAIN_WEIGHTS.verbal * 100)}%</strong> מהציון הכללי —
            כלומר החיבור לבדו הוא כ-
            <strong className="text-xp">{(ESSAY_SHARE_OF_TOTAL * 100).toFixed(1)}%</strong> מהציון הסופי,
            עבור 30 דקות של מיומנות שאפשר לאמן.
          </p>
        </div>

        <div className="card">
          {prompt.context && (
            <p className="mb-2 text-sm leading-relaxed text-slate-300">{prompt.context}</p>
          )}
          <p className="font-medium text-slate-100">{prompt.prompt}</p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setPrompt(shuffle(ESSAY_PROMPTS)[0])}
          >
            נושא אחר
          </button>
          <button type="button" className="btn-primary flex-1" onClick={() => setPhase('writing')}>
            התחל — השעון רץ
          </button>
        </div>

        <div className="card">
          <h2 className="mb-2 text-sm font-semibold text-slate-400">המבנה שעובד</h2>
          <ol className="space-y-1 text-sm text-slate-300">
            <li>1. פתיחה — הצג את הסוגיה וקבע עמדה מפורשת.</li>
            <li>2. נימוק ראשון — טענה, הסבר, דוגמה.</li>
            <li>3. נימוק שני — שונה מהותית מהראשון.</li>
            <li>4. עמדה נגדית ותשובה עליה — הסעיף שמבדיל בינוני מטוב.</li>
            <li>5. סיום — מסקנה שאינה חזרה על הפתיחה.</li>
          </ol>
        </div>

        {drafts.length > 0 && (
          <p className="num text-center text-xs text-slate-500">
            כתבת עד כה {drafts.length} חיבורים מתוזמנים
          </p>
        )}
      </div>
    );
  }

  if (phase === 'writing') {
    if (expired && phase === 'writing') setPhase('scoring');

    return (
      <div className="space-y-3">
        <div className="sticky top-14 z-10 -mx-4 flex items-center justify-between border-b border-raised bg-paper/95 px-4 py-2 backdrop-blur">
          <div>
            <p className={`num text-2xl font-bold ${remainingSec < 120 ? 'text-danger' : 'text-slate-100'}`}>
              {formatClock(remainingSec)}
            </p>
            <p className={`num text-xs ${inRange ? 'text-quant' : 'text-slate-500'}`}>
              {lineCount} שורות (יעד {WRITING_TASK.minLines}-{WRITING_TASK.maxLines})
            </p>
          </div>
          <button type="button" className="btn-primary" onClick={() => setPhase('scoring')}>
            סיימתי
          </button>
        </div>

        <p className="card text-sm text-slate-300">{prompt.prompt}</p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
          dir="rtl"
          className="h-[55vh] w-full resize-none rounded-xl border border-rule-strong bg-surface p-3 text-sm leading-relaxed text-slate-100 outline-none focus:border-xp"
          placeholder="כתוב כאן..."
        />
      </div>
    );
  }

  // --- scoring -----------------------------------------------------------------
  const contentCriteria = ESSAY_RUBRIC.filter((c) => c.dimension === 'content');
  const languageCriteria = ESSAY_RUBRIC.filter((c) => c.dimension === 'language');

  /** Rubric checkboxes map onto NITE's 1-6 scale per dimension. */
  const dimensionScore = (criteria: typeof ESSAY_RUBRIC) => {
    const met = criteria.filter((c) => scores[c.id]).length;
    return Math.round(1 + (met / criteria.length) * 5);
  };

  const contentScore = dimensionScore(contentCriteria);
  const languageScore = dimensionScore(languageCriteria);

  const save = () => {
    saveEssay({
      id: `essay-${Date.now()}`,
      promptId: prompt.id,
      text,
      lineCount,
      contentScore,
      languageScore,
      minutesTaken: Math.round(elapsedSec / 60),
      at: new Date().toISOString(),
    });
    addXp(80);
    awardBadge('essay-first');
    registerActivity();
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold">דרג את עצמך</h1>
        <p className="num text-sm text-slate-400">
          {lineCount} שורות · {Math.round(elapsedSec / 60)} דקות
          {!inRange && <span className="text-danger"> · מחוץ לטווח השורות</span>}
        </p>
      </header>

      {[
        { label: 'תוכן', criteria: contentCriteria, score: contentScore },
        { label: 'לשון', criteria: languageCriteria, score: languageScore },
      ].map((group) => (
        <div key={group.label} className="card">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-300">{group.label}</h2>
            <span className="num text-lg font-bold text-xp">{group.score}/6</span>
          </div>
          <div className="space-y-2">
            {group.criteria.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!scores[c.id]}
                  onChange={(e) => setScores((s) => ({ ...s, [c.id]: e.target.checked }))}
                  className="mt-1 h-4 w-4 shrink-0 accent-[#8a2433]"
                />
                <span>
                  <span className="font-medium text-slate-200">{c.label}</span>
                  <span className="block text-xs text-slate-400">{c.description}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}

      <details className="card">
        <summary className="cursor-pointer text-sm text-slate-400">קרא שוב את מה שכתבת</summary>
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-300">{text}</p>
      </details>

      <Link to="/" className="btn-primary block text-center" onClick={save}>
        שמור וחזור
      </Link>
    </div>
  );
}
