import { Link, useParams } from 'react-router-dom';
import { QuestionView } from '../components/QuestionView';
import { useDrill } from '../hooks/useDrill';
import { petItemsByTopic, lessonForTopic } from '../content';
import { topicLabel } from '../config/blueprint';
import { comboMultiplier } from '../engine/gamification';
import { useStore } from '../state/store';
import { useEffect } from 'react';

/**
 * Adaptive practice on one topic. No clock: pacing pressure belongs in the boss fight
 * and the mock, and mixing it into learning practice only produces rushed guesses.
 */
export function Drill() {
  const { topic = '' } = useParams();
  const pool = petItemsByTopic(topic);
  const lesson = lessonForTopic('pet', topic);
  const advanceQuest = useStore((s) => s.advanceQuest);

  const { current, selected, revealed, errorType, setErrorType, combo, stats, answer, next } =
    useDrill(pool, 'pet', topic);

  // Drilling the weak topic is one of the daily quests; keep it in step automatically.
  useEffect(() => {
    if (stats.answered > 0) advanceQuest(`drill-${topic}`);
  }, [stats.answered, topic, advanceQuest]);

  if (pool.length === 0) {
    return (
      <EmptyState
        title={`אין עדיין שאלות ב${topicLabel(topic)}`}
        hint="הוסף שאלות ל-src/content/items ותרוץ npm run validate:content."
      />
    );
  }

  if (!current) {
    return (
      <div className="space-y-4 text-center">
        <div className="text-5xl">🎉</div>
        <h1 className="text-xl font-bold">סיימת את כל השאלות בנושא</h1>
        <p className="num text-slate-400">
          {stats.correct}/{stats.answered} · {stats.xpEarned} XP
        </p>
        <Link to="/map" className="btn-primary inline-block">חזרה למפה</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-slate-100">{topicLabel(topic)}</h1>
          <p className="num text-xs text-slate-500">
            {stats.correct}/{stats.answered} · רמה {current.difficulty}
          </p>
        </div>
        {combo >= 2 && (
          <span className="num animate-pop rounded-full bg-xp/15 px-3 py-1 text-sm font-bold text-xp">
            🔥 {combo} · ×{comboMultiplier(combo).toFixed(1)}
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
          השאלה הבאה
        </button>
      )}

      {!revealed && lesson && (
        <Link to={`/lesson/${lesson.id}`} className="block text-center text-xs text-slate-500">
          תזכורת: שיעור הטכניקה ל{topicLabel(topic)}
        </Link>
      )}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="space-y-3 py-12 text-center">
      <div className="text-4xl">📭</div>
      <h1 className="font-bold">{title}</h1>
      <p className="mx-auto max-w-xs text-sm text-slate-500">{hint}</p>
      <Link to="/" className="btn-ghost inline-block">חזרה לבית</Link>
    </div>
  );
}
