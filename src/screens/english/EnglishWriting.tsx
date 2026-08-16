import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ENGLISH_ESSAY_PROMPTS, ENGLISH_ESSAY_RUBRIC } from '../../content';
import { useCountdown } from '../../hooks/useTimer';
import { formatClock } from '../../engine/pacing';
import { useStore } from '../../state/store';
import { shuffle } from '../BossFight';

/** AMIRNET's writing component is auto-scored, so word count and clarity matter more than length. */
const MINUTES = 20;
const MIN_WORDS = 120;
const MAX_WORDS = 180;

/**
 * Practice for AMIRNET's writing task — one of the components NITE is expanding into
 * as it broadens the test beyond reading. Automated scoring rewards clear structure and
 * accurate connectors over ambition, which is what the rubric below checks.
 */
export function EnglishWriting() {
  const [prompt, setPrompt] = useState(() => shuffle(ENGLISH_ESSAY_PROMPTS)[0]);
  const [phase, setPhase] = useState<'brief' | 'writing' | 'scoring'>('brief');
  const [text, setText] = useState('');
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const saveEssay = useStore((s) => s.saveEssay);
  const addXp = useStore((s) => s.addXp);
  const registerActivity = useStore((s) => s.registerActivity);

  const { remainingSec, elapsedSec, expired } = useCountdown(MINUTES * 60, phase === 'writing');

  const wordCount = useMemo(
    () => (text.trim() === '' ? 0 : text.trim().split(/\s+/).length),
    [text],
  );
  const inRange = wordCount >= MIN_WORDS && wordCount <= MAX_WORDS;

  if (phase === 'brief') {
    return (
      <div className="space-y-4">
        <header>
          <h1 className="text-xl font-bold">📝 Writing task</h1>
          <p className="num text-sm text-slate-400">
            {MINUTES} דקות · {MIN_WORDS}-{MAX_WORDS} מילים
          </p>
        </header>

        <div className="card" dir="ltr">
          {prompt.context && (
            <p className="mb-2 text-sm leading-relaxed text-slate-300">{prompt.context}</p>
          )}
          <p className="font-medium text-slate-100">{prompt.prompt}</p>
        </div>

        <div className="card text-sm text-slate-300" dir="ltr">
          <p className="mb-1 font-medium text-english">Structure that scores</p>
          <ol className="space-y-0.5 text-xs text-slate-400">
            <li>1. One sentence stating your position.</li>
            <li>2. Reason + explanation + example.</li>
            <li>3. Second, genuinely different reason.</li>
            <li>4. One sentence conceding the other side.</li>
            <li>5. One-sentence conclusion.</li>
          </ol>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setPrompt(shuffle(ENGLISH_ESSAY_PROMPTS)[0])}
          >
            נושא אחר
          </button>
          <button type="button" className="btn-primary flex-1" onClick={() => setPhase('writing')}>
            התחל
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'writing') {
    if (expired) setPhase('scoring');

    return (
      <div className="space-y-3">
        <div className="sticky top-14 z-10 -mx-4 flex items-center justify-between border-b border-ink-700 bg-ink-900/95 px-4 py-2 backdrop-blur">
          <div>
            <p className={`num text-2xl font-bold ${remainingSec < 120 ? 'text-danger' : 'text-slate-100'}`}>
              {formatClock(remainingSec)}
            </p>
            <p className={`num text-xs ${inRange ? 'text-quant' : 'text-slate-500'}`}>
              {wordCount} words ({MIN_WORDS}-{MAX_WORDS})
            </p>
          </div>
          <button type="button" className="btn-primary" onClick={() => setPhase('scoring')}>
            Done
          </button>
        </div>

        <p className="card text-sm text-slate-300" dir="ltr">{prompt.prompt}</p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
          dir="ltr"
          className="h-[55vh] w-full resize-none rounded-xl border border-ink-600 bg-ink-800 p-3 text-sm leading-relaxed text-slate-100 outline-none focus:border-english"
          placeholder="Write here..."
        />
      </div>
    );
  }

  const content = ENGLISH_ESSAY_RUBRIC.filter((c) => c.dimension === 'content');
  const language = ENGLISH_ESSAY_RUBRIC.filter((c) => c.dimension === 'language');
  const scoreOf = (criteria: typeof ENGLISH_ESSAY_RUBRIC) =>
    Math.round(1 + (criteria.filter((c) => checked[c.id]).length / criteria.length) * 5);

  const save = () => {
    saveEssay({
      id: `en-essay-${Date.now()}`,
      promptId: prompt.id,
      text,
      lineCount: wordCount,
      contentScore: scoreOf(content),
      languageScore: scoreOf(language),
      minutesTaken: Math.round(elapsedSec / 60),
      at: new Date().toISOString(),
    });
    addXp(60);
    registerActivity();
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold">Self-assessment</h1>
        <p className="num text-sm text-slate-400">
          {wordCount} words · {Math.round(elapsedSec / 60)} min
          {!inRange && <span className="text-danger"> · outside the word range</span>}
        </p>
      </header>

      {[
        { label: 'Content', criteria: content },
        { label: 'Language', criteria: language },
      ].map((group) => (
        <div key={group.label} className="card" dir="ltr">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-300">{group.label}</h2>
            <span className="num text-lg font-bold text-english">{scoreOf(group.criteria)}/6</span>
          </div>
          <div className="space-y-2">
            {group.criteria.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!checked[c.id]}
                  onChange={(e) => setChecked((s) => ({ ...s, [c.id]: e.target.checked }))}
                  className="mt-1 h-4 w-4 shrink-0 accent-[#e879a8]"
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

      <Link to="/english" className="btn-primary block text-center" onClick={save}>
        שמור וחזור
      </Link>
    </div>
  );
}
