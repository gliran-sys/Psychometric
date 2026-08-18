import { Link } from 'react-router-dom';
import { Meter } from '../components/Meter';
import { Icon, type IconName } from '../components/Icon';
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

const SHORTCUTS: { to: string; label: string; icon: IconName }[] = [
  { to: '/map', label: 'מפת הכוחות', icon: 'map' },
  { to: '/review', label: 'חזרה', icon: 'review' },
  { to: '/boss', label: 'פרק מתוזמן', icon: 'clock' },
  { to: '/essay', label: 'מטלת כתיבה', icon: 'pen' },
  { to: '/mock', label: 'סימולציה מלאה', icon: 'exam' },
  { to: '/official', label: 'מבחנים רשמיים', icon: 'paper' },
  { to: '/english', label: 'אמירנט', icon: 'english' },
];

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
    <div className="space-y-6">
      {!state.profile.testDate && (
        <Link to="/settings" className="card block border-xp/40 bg-xp/5">
          <p className="font-medium text-xp">קבע תאריך מבחן כדי לקבל תוכנית לימודים</p>
          <p className="mt-0.5 text-sm text-slate-400">
            התוכנית מחלקת את הזמן לשלושה שלבים ומשבצת את מבחן אמירנט האמיתי בדרך.
          </p>
        </Link>
      )}

      {countdown !== null && (
        <div className="rule-block">
          <p className="eyebrow">נותרו עד המבחן</p>
          <div className="mt-1 flex items-baseline gap-2.5">
            <span className="figure text-6xl font-black leading-none tracking-tight text-slate-100">
              {Math.max(0, countdown)}
            </span>
            <span className="text-[15px] text-slate-400">ימים</span>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-300">
            <span className="font-medium text-slate-100">{PHASE_INFO[phase].he}</span>
            {' — '}
            {PHASE_INFO[phase].description}
          </p>
        </div>
      )}

      <div className="rule-block space-y-5">
        <Meter
          label="ציון פסיכומטרי משוער"
          value={projection.general}
          min={SCORE_SCALE.min}
          max={SCORE_SCALE.max}
          tone="accent"
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

      <section className="rule-block">
        <h2 className="eyebrow mb-3">היום</h2>
        <div className="flex flex-col gap-3.5">
          {state.quests.items.length === 0 && (
            <p className="text-sm text-slate-400">אין משימות פתוחות — התחל תרגול כדי לייצר אותן.</p>
          )}
          {state.quests.items.map((quest) => (
            <Link key={quest.id} to={quest.href.replace(/^#/, '')} className="flex items-baseline gap-3">
              <span
                className={`mt-1 h-[7px] w-[7px] shrink-0 rounded-full border-[1.5px] ${
                  quest.done ? 'border-accent bg-accent' : 'border-rule-strong'
                }`}
              />
              <span className="flex-grow">
                <span className={`block text-[15px] ${quest.done ? 'text-slate-400 line-through' : 'text-slate-100'}`}>
                  {quest.label}
                </span>
                <span className="num block text-xs text-slate-500">
                  {quest.progress} מתוך {quest.target}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="eyebrow mb-3">תרגול</h2>
        <div className="grid grid-cols-2 gap-x-5 gap-y-0">
          {SHORTCUTS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-2.5 border-b border-rule py-2.5 text-sm text-slate-100"
            >
              <Icon name={item.icon} size={17} className="shrink-0 text-accent" />
              <span className="flex-grow">{item.label}</span>
              {item.to === '/review' && due.length > 0 && (
                <span className="num text-xs text-slate-500">{due.length}</span>
              )}
              {item.to === '/english' && retakeIn !== null && retakeIn > 0 && (
                <span className="num text-xs text-slate-500">{retakeIn}י׳</span>
              )}
            </Link>
          ))}
        </div>
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
