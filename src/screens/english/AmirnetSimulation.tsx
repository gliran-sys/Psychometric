import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { QuestionView } from '../../components/QuestionView';
import { Meter } from '../../components/Meter';
import { useCountdown } from '../../hooks/useTimer';
import { formatClock } from '../../engine/pacing';
import {
  AMIRNET_SCALE,
  BLOCKS,
  ROUTING,
  TIER_ORDER,
  TOTAL_MINUTES,
  placementFor,
  type BlockTier,
} from '../../config/amirnet';
import { assembleBlock, routingSummary, tierForBlock, type BlockOutcome } from '../../engine/mst';
import { evaluate } from '../../engine/amirnetScoring';
import { updateRating } from '../../engine/adaptive';
import { ENGLISH_ITEMS } from '../../content';
import { recentlySeenItemIds, useStore } from '../../state/store';
import type { EnglishItem } from '../../content/schema';

const TIER_LABEL: Record<BlockTier, string> = { easy: 'קל', medium: 'בינוני', hard: 'קשה' };

/**
 * The flagship of Track B: a faithful block-adaptive sitting.
 *
 * The real AMIRNET serves a whole block at one difficulty, scores it as a unit, and
 * uses that to pick the difficulty of the NEXT block. You cannot go back. That is why
 * this screen is built on `mst.ts` rather than the item-adaptive drill engine — an
 * item-adaptive simulation would quietly teach the wrong strategy, since here the early
 * blocks decide which ladder you spend the rest of the test on.
 */
export function AmirnetSimulation() {
  const [phase, setPhase] = useState<'brief' | 'running' | 'done'>('brief');
  const [blockIndex, setBlockIndex] = useState(0);
  const [outcomes, setOutcomes] = useState<BlockOutcome[]>([]);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  /**
   * Seeded with items from recent sittings, not just this one, so a second simulation
   * serves fresh questions rather than replaying the first.
   */
  const recentIds = useStore(recentlySeenItemIds);
  const [usedIds, setUsedIds] = useState<Set<string>>(() => new Set(recentIds));

  const englishAbilities = useStore((s) => s.englishAbilities);
  const recordAttempt = useStore((s) => s.recordAttempt);
  const saveAmirnetSim = useStore((s) => s.saveAmirnetSim);
  const addXp = useStore((s) => s.addXp);
  const awardBadge = useStore((s) => s.awardBadge);
  const registerActivity = useStore((s) => s.registerActivity);
  const targetScore = useStore((s) => s.profile.amirnetTargetScore);

  const blueprint = BLOCKS[blockIndex];
  const tier = useMemo(() => tierForBlock(outcomes), [outcomes]);

  const items = useMemo(
    () => (blueprint ? assembleBlock(ENGLISH_ITEMS, blueprint, tier, usedIds) : []),
    [blueprint, tier, usedIds],
  );

  const { remainingSec, expired } = useCountdown(
    (blueprint?.minutes ?? 1) * 60,
    phase === 'running',
  );

  if (phase === 'brief') {
    return (
      <div className="space-y-4">
        <header>
          <h1 className="text-xl font-bold">🎯 סימולציית אמירנט</h1>
          <p className="text-sm text-slate-400">
            {BLOCKS.length} בלוקים · כ-{TOTAL_MINUTES} דקות
          </p>
        </header>

        <div className="card border-english/40 bg-english/5 space-y-2 text-sm leading-relaxed text-slate-200">
          <p className="font-medium text-english">איך המבחן הזה עובד — וזה שונה מהפסיכומטרי</p>
          <p className="text-slate-300">
            המבחן מתאים את עצמך <strong>לפי בלוק, לא לפי שאלה</strong>. כל בלוק מוגש ברמת קושי אחת,
            נבדק כיחידה, והתוצאה שלו קובעת את רמת הבלוק הבא. אי אפשר לחזור אחורה.
          </p>
          <p className="text-slate-300">
            המסקנה המעשית: <strong>דיוק בבלוקים הראשונים שווה יותר</strong> מדיוק בסוף, כי הוא קובע
            על איזה סולם תבלה את שאר המבחן. עדיף לפתור נכון שלוש מארבע מאשר למהר ולטעות בשתיים.
          </p>
        </div>

        <div className="card text-xs text-slate-400">
          <p>עלייה ברמה: {Math.round(ROUTING.promoteAtOrAbove * 100)}% ומעלה בבלוק</p>
          <p>ירידה ברמה: מתחת ל-{Math.round(ROUTING.demoteBelow * 100)}%</p>
          <p>הבלוק הראשון תמיד ברמה בינונית — כך מבחן רב-שלבי מכייל את עצמו.</p>
        </div>

        <button
          type="button"
          className="btn-primary w-full"
          onClick={() => {
            setPhase('running');
            setAnswers(new Array(items.length).fill(null));
          }}
        >
          התחל
        </button>
      </div>
    );
  }

  if (phase === 'done') {
    return <SimulationResults outcomes={outcomes} targetScore={targetScore} />;
  }

  const finishBlock = () => {
    const correct = items.reduce(
      (sum, item, i) => sum + (answers[i] === item.correctIndex ? 1 : 0),
      0,
    );

    items.forEach((item, i) => {
      const isCorrect = answers[i] === item.correctIndex;
      recordAttempt(
        {
          itemId: item.id,
          topic: item.topic,
          track: 'amirnet',
          correct: isCorrect,
          timeSec: Math.round((blueprint.minutes * 60) / Math.max(1, items.length)),
          errorType: null,
        },
        updateRating(englishAbilities[item.topic]?.rating ?? 1000, item.difficulty, isCorrect),
      );
    });

    const nextOutcomes = [
      ...outcomes,
      { blockId: blueprint.id, tier, correct, total: items.length },
    ];
    setOutcomes(nextOutcomes);
    setUsedIds((prev) => new Set([...prev, ...items.map((i) => i.id)]));

    if (blockIndex + 1 < BLOCKS.length) {
      setBlockIndex((i) => i + 1);
      setQuestionIndex(0);
      setAnswers([]);
    } else {
      const estimate = evaluate(nextOutcomes, targetScore);
      saveAmirnetSim({
        id: `amirnet-${Date.now()}`,
        path: nextOutcomes,
        estimatedScore: estimate.score,
        at: new Date().toISOString(),
      });
      addXp(200);
      if (estimate.exempt) awardBadge('english-exempt');
      registerActivity();
      setPhase('done');
    }
  };

  if (expired) finishBlock();

  const current = items[questionIndex];
  // Answers array is sized lazily because block length is only known after routing.
  const answerFor = (i: number) => answers[i] ?? null;

  return (
    <div className="space-y-4">
      <header className="sticky top-14 z-10 -mx-4 border-b border-ink-700 bg-ink-900/95 px-4 py-2 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-slate-100">{blueprint.label}</p>
            <p className="num text-xs text-slate-500">
              בלוק {blockIndex + 1}/{BLOCKS.length} · רמה {TIER_LABEL[tier]}
            </p>
          </div>
          <p className={`num text-2xl font-bold ${remainingSec < 30 ? 'text-danger' : 'text-slate-100'}`}>
            {formatClock(remainingSec)}
          </p>
        </div>

        <div className="mt-2 flex gap-1">
          {BLOCKS.map((b, i) => (
            <div
              key={b.id}
              className={`h-1 flex-1 rounded-full ${
                i < blockIndex ? 'bg-english' : i === blockIndex ? 'bg-english/50' : 'bg-ink-700'
              }`}
            />
          ))}
        </div>
      </header>

      {current && (
        <QuestionView
          item={current as EnglishItem}
          selected={answerFor(questionIndex)}
          onSelect={(choice) =>
            setAnswers((prev) => {
              const next = [...prev];
              while (next.length < items.length) next.push(null);
              next[questionIndex] = choice;
              return next;
            })
          }
          revealed={false}
        />
      )}

      <div className="flex gap-2">
        {questionIndex < items.length - 1 ? (
          <button
            type="button"
            className="btn-primary w-full"
            onClick={() => setQuestionIndex((i) => i + 1)}
          >
            Next question
          </button>
        ) : (
          <button type="button" className="btn-primary w-full" onClick={finishBlock}>
            {blockIndex + 1 < BLOCKS.length ? 'סיים בלוק והמשך' : 'סיים את המבחן'}
          </button>
        )}
      </div>

      {/* No back button, by design — the real test does not allow returning to a block. */}
      <p className="text-center text-xs text-slate-600">
        אי אפשר לחזור אחורה, בדיוק כמו במבחן האמיתי.
      </p>
    </div>
  );
}

/**
 * The routing map is the real output here. A flat percentage cannot show that you were
 * demoted after block two and spent the rest of the test on the easy ladder — which is
 * precisely the thing worth fixing before the next sitting.
 */
function SimulationResults({
  outcomes,
  targetScore,
}: {
  outcomes: BlockOutcome[];
  targetScore: number;
}) {
  const estimate = evaluate(outcomes, targetScore);
  const summary = routingSummary(outcomes);

  return (
    <div className="space-y-4">
      <div className="card text-center">
        <div className="text-4xl">{estimate.exempt ? '🎓' : '📈'}</div>
        <h1 className="mt-1 text-lg font-bold">
          {estimate.exempt ? 'עברת את סף הפטור' : 'סיימת את הסימולציה'}
        </h1>
      </div>

      <div className="card">
        <Meter
          label="ציון משוער"
          value={estimate.score}
          min={AMIRNET_SCALE.min}
          max={AMIRNET_SCALE.max}
          tone="english"
          marker={{ at: targetScore, label: `פטור ${targetScore}` }}
          caption={`${placementFor(estimate.score).he} · ${placementFor(estimate.score).cost}`}
        />
      </div>

      <section className="card">
        <h2 className="mb-1 text-sm font-semibold text-slate-400">מפת הניתוב</h2>
        <p className="mb-3 text-xs text-slate-500">
          לאיזה סולם קושי הגעת, ואיפה ירדת ממנו. זו המשמעות האמיתית של הציון במבחן רב-שלבי.
        </p>

        <div className="space-y-2">
          {outcomes.map((outcome, i) => {
            const accuracy = outcome.total > 0 ? outcome.correct / outcome.total : 0;
            const blueprint = BLOCKS.find((b) => b.id === outcome.blockId);
            return (
              <div key={outcome.blockId} className="flex items-center gap-2">
                <span className="num w-5 shrink-0 text-xs text-slate-500">{i + 1}</span>

                {/* Tier ladder: which rung this block ran on. */}
                <div className="flex w-20 shrink-0 gap-0.5">
                  {TIER_ORDER.map((t) => (
                    <div
                      key={t}
                      className={`h-5 flex-1 rounded ${
                        t === outcome.tier ? 'bg-english' : 'bg-ink-700'
                      }`}
                      title={TIER_LABEL[t]}
                    />
                  ))}
                </div>

                <span className="flex-1 truncate text-xs text-slate-400">{blueprint?.label}</span>
                <span
                  className={`num text-sm ${
                    accuracy >= 0.75 ? 'text-quant' : accuracy < 0.4 ? 'text-danger' : 'text-slate-300'
                  }`}
                >
                  {outcome.correct}/{outcome.total}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-3 space-y-1 border-t border-ink-700 pt-3 text-xs text-slate-400">
          <p>
            רמה גבוהה שהגעת אליה: <span className="text-slate-200">{TIER_LABEL[summary.peakTier]}</span> ·
            רמה סופית: <span className="text-slate-200">{TIER_LABEL[summary.finalTier]}</span>
          </p>
          <p className="num">
            עליות: {summary.promotions} · ירידות: {summary.demotions}
          </p>
          {summary.firstDemotionAt !== null && (
            <p className="text-danger">
              הירידה הראשונה הייתה אחרי בלוק {summary.firstDemotionAt + 1} — שם נקבע רוב הציון.
            </p>
          )}
        </div>
      </section>

      <div className="flex gap-2">
        <Link to="/english/vocab" className="btn-primary flex-1 text-center">אוצר מילים</Link>
        <Link to="/english" className="btn-ghost flex-1 text-center">חזרה</Link>
      </div>
    </div>
  );
}
