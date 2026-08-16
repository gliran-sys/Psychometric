import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TimedSection, scoreSection, type SectionAnswers } from '../components/TimedSection';
import { QuestionView } from '../components/QuestionView';
import { SCORED_SECTIONS, TOPICS, DOMAIN_LABELS, type Domain } from '../config/blueprint';
import { PET_ITEMS } from '../content';
import { bossResult, BOSS_THRESHOLDS } from '../engine/gamification';
import { updateRating } from '../engine/adaptive';
import { suggestErrorType } from '../engine/errorTaxonomy';
import { useStore } from '../state/store';
import type { Item } from '../content/schema';

/**
 * A full timed section, won only by clearing accuracy AND finishing in time.
 *
 * Requiring both is deliberate: accuracy alone can be bought with unlimited time, and
 * speed alone with guessing. The real test demands them simultaneously, and that is
 * the pairing this mode trains.
 */
export function BossFight() {
  const [domain, setDomain] = useState<Domain | null>(null);
  const [result, setResult] = useState<{ answers: SectionAnswers; items: Item[] } | null>(null);

  const recordAttempt = useStore((s) => s.recordAttempt);
  const abilities = useStore((s) => s.abilities);
  const addXp = useStore((s) => s.addXp);
  const awardBadge = useStore((s) => s.awardBadge);
  const registerActivity = useStore((s) => s.registerActivity);
  const advanceQuest = useStore((s) => s.advanceQuest);

  const blueprint = SCORED_SECTIONS.find((s) => s.domain === domain);

  const items = useMemo(
    () => (domain && blueprint ? buildSection(domain, blueprint.questionCount) : []),
    [domain, blueprint],
  );

  if (!domain) {
    return (
      <div className="space-y-4">
        <header>
          <h1 className="text-xl font-bold">⚔️ קרב בוס</h1>
          <p className="text-sm text-slate-400">
            פרק שלם בזמן אמת. כדי לנצח צריך גם דיוק של{' '}
            <span className="num">{Math.round(BOSS_THRESHOLDS.accuracy * 100)}%</span> וגם לסיים בזמן.
          </p>
        </header>

        {SCORED_SECTIONS.filter((s, i, arr) => arr.findIndex((x) => x.domain === s.domain) === i).map(
          (section) => (
            <button
              key={section.domain}
              type="button"
              className="card w-full text-start"
              onClick={() => setDomain(section.domain)}
            >
              <p className="font-medium text-slate-100">{DOMAIN_LABELS[section.domain]}</p>
              <p className="num text-xs text-slate-500">
                {section.questionCount} שאלות · {section.minutes} דקות
              </p>
            </button>
          ),
        )}
      </div>
    );
  }

  if (!result) {
    return (
      <TimedSection
        title={`קרב בוס — ${DOMAIN_LABELS[domain]}`}
        items={items}
        minutes={blueprint!.minutes}
        onFinish={(answers) => {
          const score = scoreSection(items, answers.answers);

          // Record every question so a boss fight feeds ability ratings and the error
          // log exactly like drilling does — the mode differs, the data should not.
          items.forEach((item, i) => {
            const chosen = answers.answers[i];
            const correct = chosen === item.correctIndex;
            const perQuestionSec = Math.round(answers.elapsedSec / Math.max(1, items.length));
            recordAttempt(
              {
                itemId: item.id,
                topic: item.topic,
                track: 'pet',
                correct,
                timeSec: perQuestionSec,
                errorType: suggestErrorType({
                  correct,
                  timeSec: perQuestionSec,
                  targetTimeSec: item.targetTimeSec,
                  choseFlaggedTrap: chosen !== null && !correct,
                }),
              },
              updateRating(abilities[item.topic]?.rating ?? 1000, item.difficulty, correct),
            );
          });

          const outcome = bossResult(score.correct, score.total, !answers.ranOutOfTime);
          if (outcome.won) {
            addXp(150);
            awardBadge('boss-slayer');
          } else {
            addXp(40);
          }
          registerActivity();
          advanceQuest('timed-section');
          setResult({ answers, items });
        }}
      />
    );
  }

  const score = scoreSection(result.items, result.answers.answers);
  const outcome = bossResult(score.correct, score.total, !result.answers.ranOutOfTime);

  return (
    <div className="space-y-4">
      <div className="card text-center">
        <div className="text-5xl">{outcome.won ? '🏆' : '💀'}</div>
        <h1 className="mt-2 text-xl font-bold">{outcome.won ? 'ניצחת בקרב' : 'הבוס ניצח הפעם'}</h1>
        <p className="num mt-1 text-slate-300">
          {score.correct}/{score.total} · דיוק {Math.round(outcome.accuracy * 100)}%
          {score.blank > 0 && <span className="text-slate-500"> · {score.blank} ריקות</span>}
        </p>
        {outcome.reason && <p className="mt-1 text-sm text-danger">{outcome.reason}</p>}
      </div>

      <h2 className="text-sm font-semibold text-slate-400">סקירת טעויות</h2>
      {result.items.map((item, i) =>
        result.answers.answers[i] === item.correctIndex ? null : (
          <div key={item.id} className="card">
            <p className="num mb-2 text-xs text-slate-500">שאלה {i + 1}</p>
            <QuestionView
              item={item}
              selected={result.answers.answers[i]}
              onSelect={() => {}}
              revealed
            />
          </div>
        ),
      )}

      <Link to="/" className="btn-ghost block text-center">חזרה לבית</Link>
    </div>
  );
}

/**
 * Assembles a section that mirrors the real topic mix rather than drawing at random:
 * a verbal section with no reading comprehension would train the wrong pacing entirely.
 */
export function buildSection(domain: Domain, questionCount: number): Item[] {
  const topics = TOPICS[domain];
  const picked: Item[] = [];

  topics.forEach((topic) => {
    const pool = PET_ITEMS.filter((i) => i.topic === topic.id);
    picked.push(...shuffle(pool).slice(0, topic.questionsPerSection));
  });

  // Top up from anything left if the blueprint mix came up short of the target count.
  if (picked.length < questionCount) {
    const used = new Set(picked.map((i) => i.id));
    const rest = PET_ITEMS.filter(
      (i) => !used.has(i.id) && topics.some((t) => t.id === i.topic),
    );
    picked.push(...shuffle(rest).slice(0, questionCount - picked.length));
  }

  return picked.slice(0, questionCount);
}

export function shuffle<T>(array: T[]): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
