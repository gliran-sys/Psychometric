import { Link, useParams } from 'react-router-dom';
import { QuestionView } from '../../components/QuestionView';
import { useDrill } from '../../hooks/useDrill';
import { englishItemsByTopic, lessonForTopic } from '../../content';
import { ENGLISH_TOPIC_LABELS, type EnglishTopic } from '../../config/amirnet';
import { Icon } from '../../components/Icon';
import { comboMultiplier } from '../../engine/gamification';
import { EmptyState } from '../Drill';

/**
 * Untimed AMIRNET practice by question type. Feeds the same spaced-repetition queue as
 * the PET drill — one review system across both tracks, since the user has one memory.
 */
export function EnglishDrill() {
  const { topic = '' } = useParams();
  const pool = englishItemsByTopic(topic);
  const lesson = lessonForTopic('amirnet', topic);
  const labels = ENGLISH_TOPIC_LABELS[topic as EnglishTopic];

  const { current, selected, revealed, errorType, setErrorType, combo, stats, answer, next } =
    useDrill(pool, 'amirnet', topic);

  if (pool.length === 0) {
    return <EmptyState title="אין שאלות בסוג הזה" hint="הוסף שאלות ל-src/content/items/english." />;
  }

  if (!current) {
    return (
      <div className="space-y-4 text-center">
        <div className="text-5xl">🎉</div>
        <h1 className="text-xl font-bold">סיימת את כל השאלות בסוג הזה</h1>
        <p className="num text-slate-400">
          {stats.correct}/{stats.answered} · {stats.xpEarned} XP
        </p>
        <div className="flex justify-center gap-2">
          <Link to="/english/sim" className="btn-primary">לסימולציה מלאה</Link>
          <Link to="/english" className="btn-ghost">חזרה</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-slate-100">{labels?.en ?? topic}</h1>
          <p className="num text-xs text-slate-500">
            {stats.correct}/{stats.answered} · רמה {current.difficulty}
          </p>
        </div>
        {combo >= 2 && (
          <span className="num animate-pop rounded-full bg-english/15 px-3 py-1 text-sm font-bold text-english">
            <Icon name="flame" size={12} filled className="me-1 inline-block align-[-1px]" />
            {combo} · ×{comboMultiplier(combo).toFixed(1)}
          </span>
        )}
      </header>

      <QuestionView
        item={current}
        selected={selected}
        onSelect={answer}
        revealed={revealed}
        errorType={errorType}
        onClassify={setErrorType}
      />

      {revealed && (
        <button type="button" className="btn-primary w-full" onClick={next}>
          Next question
        </button>
      )}

      {!revealed && lesson && (
        <Link to={`/lesson/${lesson.id}`} className="block text-center text-xs text-slate-500">
          Technique reminder: {lesson.title}
        </Link>
      )}
    </div>
  );
}
