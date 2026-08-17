import { Link } from 'react-router-dom';
import { Meter } from '../components/Meter';
import { SCORE_SCALE, TOPICS, topicLabel } from '../config/blueprint';
import { AMIRNET_SCALE, RETAKE_INTERVAL_DAYS, placementFor } from '../config/amirnet';
import { approximatePercentile, projectScore } from '../engine/scoring';
import { estimateScore } from '../engine/amirnetScoring';
import { generateQuests, buildPlan, PHASE_INFO } from '../engine/planner';
import { dueCards } from '../engine/srs';
import { masteryOf } from '../engine/adaptive';
import { daysUntilRetake, daysUntilTest, isEnglishDone, useStore } from '../state/store';
import { today } from '../lib/date';
import { useEffect } from 'react';

export function Dashboard() {
  const state = useStore();
  const setQuests = useStore((s) => s.setQuests);

  const projection = projectScore(domainTallies(state));
  const amirnetScore = latestAmirnetScore(state);
  const englishDone = isEnglishDone(state);
  const due = dueCards(state.srs, today());
  const countdown = daysUntilTest(state);
  const retakeIn = daysUntilRetake(state, RETAKE_INTERVAL_DAYS);

  const plan =
    state.profile.testDate && countdown !== null && countdown > 0
      ? buildPlan({
          startDate: today(),
          testDate: state.profile.testDate,
          dailyMinutes: state.profile.dailyGoalMinutes,
          englishDone,
        })
      : null;
  const phase = plan?.days[0]?.phase ?? 'A';

  const weakest = weakestTopic(state.abilities);

  // Quests regenerate once per day, seeded from actual weakness rather than a fixed list.
  useEffect(() => {
    if (state.quests.day === today()) return;
    const seeds = generateQuests({
      weakestTopic: weakest,
      dueCardCount: due.length,
      englishDone,
      phase,
    });
    setQuests(
      today(),
      seeds.map((s) => ({ ...s, progress: 0, done: false })),
    );
  }, [state.quests.day, weakest, due.length, englishDone, phase, setQuests]);

  return (
    <div className="space-y-5">
      {!state.profile.testDate && (
        <Link to="/settings" className="card block border-xp/40 bg-xp/5">
          <p className="font-medium text-xp">קבע תאריך מבחן כדי לקבל תוכנית לימודים</p>
          <p className="mt-0.5 text-sm text-slate-400">
            התוכנית מחלקת את הזמן לשלושה שלבים ומשבצת את מבחן אמירנט האמיתי בדרך.
          </p>
        </Link>
      )}

      {countdown !== null && (
        <div className="card flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-400">נותרו עד הפסיכומטרי</p>
            <p className="num text-3xl font-bold text-slate-50">{Math.max(0, countdown)}</p>
            <p className="text-xs text-slate-500">ימים</p>
          </div>
          <div className="text-end">
            <p className="text-sm font-medium text-verbal">{PHASE_INFO[phase].he}</p>
            <p className="mt-0.5 max-w-[190px] text-xs text-slate-400">
              {PHASE_INFO[phase].description}
            </p>
          </div>
        </div>
      )}

      <div className="card space-y-4">
        <Meter
          label="ציון פסיכומטרי משוער"
          value={projection.general}
          min={SCORE_SCALE.min}
          max={SCORE_SCALE.max}
          tone="xp"
          caption={
            projection.provisional
              ? 'ההערכה עדיין רועשת — נדרשות כ-30 שאלות בכל תחום כדי שתתייצב.'
              : `אחוזון משוער: ${approximatePercentile(projection.general)} · מילולי ${projection.verbal} · כמותי ${projection.quant}`
          }
        />

        <Meter
          label="ציון אמירנט משוער"
          value={amirnetScore}
          min={AMIRNET_SCALE.min}
          max={AMIRNET_SCALE.max}
          tone="english"
          marker={{ at: state.profile.amirnetTargetScore, label: `פטור ${state.profile.amirnetTargetScore}` }}
          caption={
            englishDone
              ? '✓ עברת את סף הפטור — המסלול הזה סגור, והזמן היומי עובר לפסיכומטרי.'
              : `רמה נוכחית: ${placementFor(amirnetScore).he} · ${placementFor(amirnetScore).cost}`
          }
        />
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-400">משימות היום</h2>
        <div className="space-y-2">
          {state.quests.items.length === 0 && (
            <p className="text-sm text-slate-500">אין משימות פתוחות — התחל תרגול כדי לייצר אותן.</p>
          )}
          {state.quests.items.map((quest) => (
            <Link
              key={quest.id}
              to={quest.href.replace(/^#/, '')}
              className={`card flex items-center justify-between ${quest.done ? 'opacity-50' : ''}`}
            >
              <div>
                <p className="font-medium text-slate-100">
                  {quest.done && '✓ '}
                  {quest.label}
                </p>
                <p className="num text-xs text-slate-500">
                  {quest.progress}/{quest.target}
                </p>
              </div>
              <span className="num text-sm font-bold text-xp">+{quest.xp}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2">
        <Link to="/map" className="card text-center">
          <div className="text-2xl">🗺️</div>
          <p className="mt-1 text-sm font-medium">מפת הכוחות</p>
        </Link>
        <Link to="/review" className="card text-center">
          <div className="text-2xl">🔁</div>
          <p className="mt-1 text-sm font-medium">
            חזרה {due.length > 0 && <span className="num text-xp">({due.length})</span>}
          </p>
        </Link>
        <Link to="/boss" className="card text-center">
          <div className="text-2xl">⚔️</div>
          <p className="mt-1 text-sm font-medium">קרב בוס</p>
        </Link>
        <Link to="/essay" className="card text-center">
          <div className="text-2xl">✍️</div>
          <p className="mt-1 text-sm font-medium">מטלת כתיבה</p>
        </Link>
        <Link to="/mock" className="card text-center">
          <div className="text-2xl">🛡️</div>
          <p className="mt-1 text-sm font-medium">סימולציה מלאה</p>
        </Link>
        <Link to="/official" className="card text-center">
          <div className="text-2xl">📄</div>
          <p className="mt-1 text-sm font-medium">מבחנים רשמיים</p>
        </Link>
        <Link to="/english" className="card text-center">
          <div className="text-2xl">🇬🇧</div>
          <p className="mt-1 text-sm font-medium">
            אמירנט
            {retakeIn !== null && retakeIn > 0 && (
              <span className="num block text-xs text-slate-500">מועד חוזר בעוד {retakeIn} ימים</span>
            )}
          </p>
        </Link>
      </section>

      <p className="pb-2 text-center text-xs text-slate-600">
        הציונים כאן הם הערכות לצורך מעקב, ואינם ציוני מרכז ארצי רשמיים.
      </p>
    </div>
  );
}

/** Splits accumulated attempts into the two scored domains. */
function domainTallies(state: ReturnType<typeof useStore.getState>) {
  const verbalTopics = new Set(TOPICS.verbal.map((t) => t.id));
  let verbalCorrect = 0, verbalAttempts = 0, quantCorrect = 0, quantAttempts = 0;

  Object.entries(state.abilities).forEach(([topic, ability]) => {
    if (verbalTopics.has(topic as never)) {
      verbalAttempts += ability.attempts;
      verbalCorrect += ability.correct;
    } else {
      quantAttempts += ability.attempts;
      quantCorrect += ability.correct;
    }
  });

  const essay = [...state.essayDrafts]
    .reverse()
    .find((d) => d.contentScore !== null && d.languageScore !== null);

  return {
    verbalCorrect,
    verbalAttempts,
    quantCorrect,
    quantAttempts,
    latestEssay: essay
      ? { contentScore: essay.contentScore!, languageScore: essay.languageScore! }
      : null,
  };
}

/**
 * Prefers a real sitting over a simulation: an actual AMIRNET score is ground truth
 * and there is no reason to keep showing an estimate once one exists.
 */
function latestAmirnetScore(state: ReturnType<typeof useStore.getState>): number {
  if (state.profile.amirnetRealScore !== null) return state.profile.amirnetRealScore;
  const last = state.amirnetSims[state.amirnetSims.length - 1];
  if (last) return last.estimatedScore;

  const english = Object.values(state.englishAbilities);
  const attempts = english.reduce((s, a) => s + a.attempts, 0);
  if (attempts === 0) return AMIRNET_SCALE.min;

  const accuracy = english.reduce((s, a) => s + a.correct, 0) / attempts;
  return estimateScore([{ blockId: 'drills', tier: 'medium', correct: Math.round(accuracy * 10), total: 10 }]);
}

function weakestTopic(abilities: Record<string, { rating: number; attempts: number; correct: number }>) {
  const entries = Object.entries(abilities);
  if (entries.length === 0) return null;
  // Untouched topics are the weakest by definition — mastery 0 sorts them first.
  const [id] = entries.reduce((worst, entry) =>
    masteryOf(entry[1]) < masteryOf(worst[1]) ? entry : worst,
  );
  return { id, label: topicLabel(id) };
}
