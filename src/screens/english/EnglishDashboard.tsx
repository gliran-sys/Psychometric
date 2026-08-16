import { Link } from 'react-router-dom';
import { Meter } from '../../components/Meter';
import {
  AMIRNET_SCALE,
  BLOCKS,
  ENGLISH_TOPIC_LABELS,
  EXPERIMENTAL_BLOCKS,
  PLACEMENT_LADDER,
  RETAKE_INTERVAL_DAYS,
  TOTAL_MINUTES,
  placementFor,
  type EnglishTopic,
} from '../../config/amirnet';
import { estimateScore } from '../../engine/amirnetScoring';
import { masteryOf } from '../../engine/adaptive';
import { lessonForTopic, englishItemsByTopic } from '../../content';
import { daysUntilRetake, isEnglishDone, useStore } from '../../state/store';

/**
 * Track B's own home screen — a parallel app, not a tab of the PET flow.
 *
 * From December 2026 AMIRNET is the only test Israeli institutions use to assess
 * English, and it is winnable independently: year-round dates, a 35-day retake window,
 * and a single number that decides whether you sit through a year of English courses.
 */
export function EnglishDashboard() {
  const state = useStore();
  const englishDone = isEnglishDone(state);
  const retakeIn = daysUntilRetake(state, RETAKE_INTERVAL_DAYS);

  const score = currentScore(state);
  const placement = placementFor(score);
  const target = state.profile.amirnetTargetScore;

  const topics = [...new Set([...BLOCKS, ...EXPERIMENTAL_BLOCKS].map((b) => b.topic))];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold">🇬🇧 אמירנט</h1>
        <p className="text-sm text-slate-400">
          מדצמבר 2026 זהו המבחן היחיד שבודק אנגלית לצורך קבלה וסיווג רמה.
        </p>
      </header>

      <div className="card space-y-4">
        <Meter
          label="ציון משוער"
          value={score}
          min={AMIRNET_SCALE.min}
          max={AMIRNET_SCALE.max}
          tone="english"
          marker={{ at: target, label: `פטור ${target}` }}
          caption={
            englishDone
              ? '✓ עברת את הסף. אין צורך בקורסי אנגלית.'
              : `${placement.he} · ${placement.cost} · חסרות ${Math.max(0, target - score)} נקודות`
          }
        />

        {retakeIn !== null && !englishDone && (
          <p className="num text-center text-xs text-slate-400">
            {retakeIn > 0
              ? `ניתן לגשת שוב בעוד ${retakeIn} ימים`
              : '✓ אתה זכאי לגשת שוב כבר עכשיו'}
          </p>
        )}
      </div>

      {!englishDone && (
        <div className="card border-english/40 bg-english/5 text-sm leading-relaxed text-slate-200">
          <p className="font-medium text-english">למה כדאי לסגור את זה מוקדם</p>
          <p className="mt-1 text-slate-300">
            למבחן אין מועדים קבועים וניתן לחזור עליו כל {RETAKE_INTERVAL_DAYS} ימים. ציון אמיתי
            שווה יותר מכל סימולציה, והוא זול לחזרה — גש מוקדם, ואם עברת, כל הזמן היומי עובר
            לפסיכומטרי בדיוק כשהוא נכנס לשלב הסימולציות.
          </p>
        </div>
      )}

      <section className="grid grid-cols-2 gap-2">
        <Link to="/english/sim" className="card col-span-2 text-center">
          <div className="text-2xl">🎯</div>
          <p className="mt-1 font-medium">סימולציה אדפטיבית מלאה</p>
          <p className="num text-xs text-slate-500">
            {BLOCKS.length} בלוקים · כ-{TOTAL_MINUTES} דקות
          </p>
        </Link>
        <Link to="/english/vocab" className="card text-center">
          <div className="text-2xl">📚</div>
          <p className="mt-1 text-sm font-medium">אוצר מילים</p>
        </Link>
        <Link to="/english/writing" className="card text-center">
          <div className="text-2xl">📝</div>
          <p className="mt-1 text-sm font-medium">מטלת כתיבה</p>
        </Link>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-400">סוגי שאלות</h2>
        <div className="space-y-2">
          {topics.map((topic) => {
            const ability = state.englishAbilities[topic] ?? { rating: 0, attempts: 0, correct: 0 };
            const mastery = masteryOf(ability);
            const lesson = lessonForTopic('amirnet', topic);
            const count = englishItemsByTopic(topic).length;
            const experimental = EXPERIMENTAL_BLOCKS.some((b) => b.topic === topic);

            return (
              <div key={topic} className="card">
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <p className="font-medium text-slate-100">
                      {ENGLISH_TOPIC_LABELS[topic as EnglishTopic].en}
                      {experimental && (
                        <span className="ms-1.5 rounded bg-ink-600 px-1.5 py-0.5 text-[10px] text-slate-400">
                          נסיוני / מתרחב
                        </span>
                      )}
                    </p>
                    <p className="num text-xs text-slate-500">
                      {ENGLISH_TOPIC_LABELS[topic as EnglishTopic].he} · {count} שאלות
                    </p>
                  </div>
                  <span className="num text-xs text-slate-500">{Math.round(mastery * 100)}%</span>
                </div>

                <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-ink-700">
                  <div className="h-full bg-english transition-[width]" style={{ width: `${mastery * 100}%` }} />
                </div>

                <div className="flex gap-2">
                  {lesson && (
                    <Link to={`/lesson/${lesson.id}`} className="btn-ghost flex-1 text-center text-sm">
                      {state.completedLessons.includes(lesson.id) ? '✓ שיעור' : 'שיעור'}
                    </Link>
                  )}
                  <Link
                    to={`/english/drill/${topic}`}
                    className="btn-primary flex-1 text-center text-sm"
                  >
                    תרגול
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h2 className="mb-2 text-sm font-semibold text-slate-400">סולם הרמות</h2>
        <div className="space-y-1.5 text-sm">
          {PLACEMENT_LADDER.map((level) => (
            <div
              key={level.he}
              className={`flex justify-between rounded-lg px-2 py-1.5 ${
                level.minScore === placement.minScore ? 'bg-english/15 text-english' : 'text-slate-400'
              }`}
            >
              <span>
                <span className="num">{level.minScore}</span>
                {level.maxScore < AMIRNET_SCALE.max && <span className="num">–{level.maxScore}</span>}
                <span className="ms-2">{level.he}</span>
              </span>
              <span className="text-xs">{level.cost}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          כל מוסד קובע ספים משלו — אפשר לעדכן את הסף בהגדרות.
        </p>
      </section>

      <Link to="/settings" className="block pb-2 text-center text-xs text-slate-500">
        עדכן ציון אמיתי ומועד מבחן →
      </Link>
    </div>
  );
}

function currentScore(state: ReturnType<typeof useStore.getState>): number {
  if (state.profile.amirnetRealScore !== null) return state.profile.amirnetRealScore;

  const lastSim = state.amirnetSims[state.amirnetSims.length - 1];
  if (lastSim) return lastSim.estimatedScore;

  const abilities = Object.values(state.englishAbilities);
  const attempts = abilities.reduce((s, a) => s + a.attempts, 0);
  if (attempts === 0) return AMIRNET_SCALE.min;

  const accuracy = abilities.reduce((s, a) => s + a.correct, 0) / attempts;
  return estimateScore([
    { blockId: 'drills', tier: 'medium', correct: Math.round(accuracy * 10), total: 10 },
  ]);
}
