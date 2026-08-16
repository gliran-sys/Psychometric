import type { EnglishItem, Item, PetItem } from '../content/schema';
import { isEnglishItem } from '../content/schema';
import { ERROR_LABELS, type ErrorType } from '../engine/errorTaxonomy';

interface QuestionViewProps {
  item: Item;
  selected: number | null;
  onSelect: (index: number) => void;
  /** In exam modes the answer stays hidden; in drill mode it is revealed immediately. */
  revealed: boolean;
  /** Shown after an incorrect answer so the miss gets classified before moving on. */
  errorType?: ErrorType | null;
  onClassify?: (type: ErrorType) => void;
}

const OPTION_LETTERS = ['א', 'ב', 'ג', 'ד'];
const OPTION_LETTERS_EN = ['A', 'B', 'C', 'D'];

/**
 * Renders one question for every mode in the app — drill, boss fight, mock exam,
 * English drill and the AMIRNET simulation. Only `revealed` differs between them.
 *
 * English items are rendered inside an LTR island: the document is RTL for Hebrew,
 * but English text and its answer options must read left-to-right or the punctuation
 * lands in the wrong place.
 */
export function QuestionView({
  item,
  selected,
  onSelect,
  revealed,
  errorType,
  onClassify,
}: QuestionViewProps) {
  const english = isEnglishItem(item);
  const dir = english ? 'ltr' : 'rtl';
  const letters = english ? OPTION_LETTERS_EN : OPTION_LETTERS;
  const wasWrong = revealed && selected !== null && selected !== item.correctIndex;

  return (
    <div dir={dir} className="space-y-4">
      {item.passage && (
        <div className="card max-h-72 overflow-y-auto whitespace-pre-line text-sm leading-relaxed text-slate-300">
          {item.passage}
        </div>
      )}

      {english && (item as EnglishItem).audioText && <AudioPrompt item={item as EnglishItem} />}

      <p className="text-lg font-medium leading-relaxed text-slate-100">{item.stem}</p>

      <div className="space-y-2">
        {item.options.map((option, index) => {
          const isCorrect = index === item.correctIndex;
          const isSelected = index === selected;

          let className = 'option';
          if (revealed && isCorrect) className += ' option-correct';
          else if (revealed && isSelected) className += ' option-wrong';
          else if (isSelected) className += ' border-xp bg-xp/10';

          return (
            <button
              key={index}
              type="button"
              className={className}
              onClick={() => !revealed && onSelect(index)}
              disabled={revealed}
            >
              <span className="me-2 inline-block font-bold text-slate-400">{letters[index]}.</span>
              {option}
            </button>
          );
        })}
      </div>

      {revealed && <Explanation item={item} selected={selected} />}

      {wasWrong && onClassify && (
        <ErrorClassifier value={errorType ?? null} onChange={onClassify} />
      )}
    </div>
  );
}

/**
 * Listening items are spoken with the browser's Web Speech API rather than hosted
 * audio, mirroring the text-to-speech NITE made available to all examinees in April
 * 2026 — and keeping the app a static site with no media to serve.
 */
function AudioPrompt({ item }: { item: EnglishItem }) {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const speak = () => {
    if (!supported || !item.audioText) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(item.audioText);
    utterance.lang = 'en-US';
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="card space-y-2">
      {supported ? (
        <button type="button" className="btn-primary w-full" onClick={speak}>
          ▶︎ Play audio
        </button>
      ) : (
        /* Degrade to the transcript rather than making the item unanswerable. */
        <p className="text-sm leading-relaxed text-slate-300">{item.audioText}</p>
      )}
      <p className="text-xs text-slate-500">
        {supported
          ? 'On the real test you cannot replay freely — try to answer after one listen.'
          : 'Speech synthesis is unavailable in this browser, so the transcript is shown instead.'}
      </p>
    </div>
  );
}

function Explanation({ item, selected }: { item: Item; selected: number | null }) {
  const english = isEnglishItem(item);
  const trap =
    selected !== null && selected !== item.correctIndex
      ? item.trapExplanations[String(selected)]
      : null;

  return (
    <div className="space-y-3">
      {/* The distractor analysis comes first: why the wrong answer looked right is the
          part that actually changes behaviour on the next question. */}
      {trap && (
        <div className="card border-danger/40 bg-danger/5">
          <h4 className="mb-1 text-sm font-semibold text-danger">
            {english ? 'Why that option is tempting' : 'למה התשובה הזו מפתה'}
          </h4>
          <p className="text-sm leading-relaxed text-slate-300">{trap}</p>
        </div>
      )}

      <div className="card">
        <h4 className="mb-2 text-sm font-semibold text-quant">
          {english ? 'Solution' : 'דרך הפתרון'}
        </h4>
        <ol className="space-y-1.5 text-sm leading-relaxed text-slate-300">
          {item.solutionSteps.map((step, i) => (
            <li key={i} className="flex gap-2">
              <span className="num shrink-0 font-bold text-slate-500">{i + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {(item as PetItem).techniqueTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {item.techniqueTags.map((tag) => (
            <span key={tag} className="rounded-full bg-ink-700 px-2.5 py-1 text-xs text-slate-400">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Forces a one-tap classification of every miss. "I got 14/20" is not actionable;
 * "all six misses were time pressure" tells you what to change tomorrow.
 */
function ErrorClassifier({
  value,
  onChange,
}: {
  value: ErrorType | null;
  onChange: (type: ErrorType) => void;
}) {
  return (
    <div dir="rtl" className="card">
      <h4 className="mb-2 text-sm font-semibold text-xp">מה קרה כאן?</h4>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(ERROR_LABELS) as ErrorType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => onChange(type)}
            className={`rounded-lg border px-3 py-1.5 text-sm transition ${
              value === type
                ? 'border-xp bg-xp/15 text-xp'
                : 'border-ink-600 bg-ink-700/40 text-slate-300 hover:bg-ink-700'
            }`}
          >
            {ERROR_LABELS[type].he}
          </button>
        ))}
      </div>
      {value && <p className="mt-2 text-xs text-slate-400">{ERROR_LABELS[value].hint}</p>}
    </div>
  );
}
