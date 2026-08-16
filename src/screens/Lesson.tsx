import { Link, useParams } from 'react-router-dom';
import { LESSONS } from '../content';
import { useStore } from '../state/store';
import { EmptyState } from './Drill';

/**
 * A technique lesson, capped at seven minutes by the content schema.
 *
 * The procedure box is the part that matters: psychometric gains come mostly from
 * recognising an archetype and applying a fixed procedure, so the procedure is pinned
 * at the top where it can be re-read in ten seconds before a drill.
 */
export function Lesson() {
  const { lessonId = '' } = useParams();
  const lesson = LESSONS.find((l) => l.id === lessonId);
  const completeLesson = useStore((s) => s.completeLesson);
  const addXp = useStore((s) => s.addXp);
  const completed = useStore((s) => s.completedLessons.includes(lessonId));

  if (!lesson) {
    return <EmptyState title="השיעור לא נמצא" hint="ייתכן שהקישור שגוי." />;
  }

  const english = lesson.track === 'amirnet';
  const drillHref = english ? `/english/drill/${lesson.topic}` : `/drill/${lesson.topic}`;

  const finish = () => {
    if (!completed) {
      completeLesson(lesson.id);
      addXp(25);
    }
  };

  return (
    <div className="space-y-4" dir={english ? 'ltr' : 'rtl'}>
      <header>
        <h1 className="text-xl font-bold text-slate-50">{lesson.title}</h1>
        <p className="num text-xs text-slate-500">{lesson.minutes} min</p>
      </header>

      <div className="card border-xp/40 bg-xp/5">
        <h2 className="mb-2 text-sm font-semibold text-xp">
          {english ? 'The procedure' : 'הנוהל'}
        </h2>
        <ol className="space-y-2 text-sm leading-relaxed text-slate-200">
          {lesson.procedure.map((step, i) => (
            <li key={i} className="flex gap-2">
              <span className="num shrink-0 font-bold text-xp">{i + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>

      <article className="card whitespace-pre-line text-sm leading-relaxed text-slate-300">
        {renderMarkdownish(lesson.body)}
      </article>

      <div className="flex gap-2">
        <Link to={drillHref} className="btn-primary flex-1 text-center" onClick={finish}>
          {english ? 'Practise this now' : 'תרגל את זה עכשיו'}
        </Link>
        {!completed && (
          <button type="button" className="btn-ghost" onClick={finish}>
            {english ? 'Mark done' : 'סמן כהושלם'}
          </button>
        )}
      </div>

      {completed && (
        <p className="text-center text-xs text-quant">
          {english ? '✓ Lesson completed' : '✓ השיעור הושלם'}
        </p>
      )}
    </div>
  );
}

/**
 * The lesson bodies use a small subset of Markdown — `**bold**` and `###` headings.
 * Rendering just those two inline avoids pulling a Markdown parser into the bundle for
 * a handful of files, and keeps the content authorable as plain text.
 */
function renderMarkdownish(body: string) {
  return body.split('\n').map((line, i) => {
    if (line.startsWith('### ')) {
      return (
        <h3 key={i} className="mt-3 font-semibold text-slate-100">
          {line.slice(4)}
        </h3>
      );
    }
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p key={i} className={line === '' ? 'h-2' : ''}>
        {parts.map((part, j) =>
          part.startsWith('**') && part.endsWith('**') ? (
            <strong key={j} className="font-semibold text-slate-100">
              {part.slice(2, -2)}
            </strong>
          ) : (
            part
          ),
        )}
      </p>
    );
  });
}
