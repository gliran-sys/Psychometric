import { Link } from 'react-router-dom';
import { DOMAIN_LABELS, TOPICS, type Domain } from '../config/blueprint';
import { masteryOf } from '../engine/adaptive';
import { lessonForTopic, petItemsByTopic } from '../content';
import { useStore } from '../state/store';

/**
 * The skill tree — topics as nodes that light up with mastery.
 *
 * Mastery gates the harder tiers deliberately: grinding hard items in a topic you have
 * not learned the technique for is the least efficient thing you can do with study
 * time, so the lesson comes first.
 */
export function SkillTree() {
  const abilities = useStore((s) => s.abilities);
  const completedLessons = useStore((s) => s.completedLessons);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold">מפת הכוחות</h1>
        <p className="text-sm text-slate-400">
          כל נושא נדלק ככל שאתה שולט בו. התחל בשיעור הטכניקה, ואז תרגל.
        </p>
      </header>

      {(['verbal', 'quant'] as Domain[]).map((domain) => (
        <section key={domain}>
          <h2 className={`mb-2 text-sm font-semibold ${domain === 'verbal' ? 'text-verbal' : 'text-quant'}`}>
            {DOMAIN_LABELS[domain]}
          </h2>

          <div className="space-y-2">
            {TOPICS[domain].map((topic) => {
              const ability = abilities[topic.id] ?? { rating: 0, attempts: 0, correct: 0 };
              const mastery = masteryOf(ability);
              const lesson = lessonForTopic('pet', topic.id);
              const lessonDone = lesson ? completedLessons.includes(lesson.id) : true;
              const itemCount = petItemsByTopic(topic.id).length;

              return (
                <div key={topic.id} className="card">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`grid h-8 w-8 place-items-center rounded-full text-sm ${
                          mastery > 0.66
                            ? 'bg-xp/20 text-xp'
                            : mastery > 0.33
                              ? 'bg-rule-strong text-slate-200'
                              : 'bg-raised text-slate-500'
                        }`}
                      >
                        {mastery > 0.66 ? '★' : mastery > 0.33 ? '◆' : '○'}
                      </span>
                      <div>
                        <p className="font-medium text-slate-100">{topic.label}</p>
                        <p className="num text-xs text-slate-500">
                          {ability.attempts > 0
                            ? `${ability.correct}/${ability.attempts} · דיוק ${Math.round((ability.correct / ability.attempts) * 100)}%`
                            : `${itemCount} שאלות זמינות`}
                        </p>
                      </div>
                    </div>
                    <span className="num text-xs text-slate-500">{Math.round(mastery * 100)}%</span>
                  </div>

                  <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-raised">
                    <div
                      className={`h-full transition-[width] duration-500 ${
                        domain === 'verbal' ? 'bg-verbal' : 'bg-quant'
                      }`}
                      style={{ width: `${mastery * 100}%` }}
                    />
                  </div>

                  <div className="flex gap-2">
                    {lesson && (
                      <Link
                        to={`/lesson/${lesson.id}`}
                        className={`btn flex-1 text-center text-sm ${
                          lessonDone ? 'btn-ghost' : 'btn-primary'
                        }`}
                      >
                        {lessonDone ? '✓ שיעור' : 'שיעור טכניקה'}
                      </Link>
                    )}
                    <Link to={`/drill/${topic.id}`} className="btn-ghost flex-1 text-center text-sm">
                      תרגול
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
