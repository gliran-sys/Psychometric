import { useMemo } from 'react';
import { BADGES, badgeById, levelProgress } from '../engine/gamification';
import { ALL_TOPICS, topicLabel, topicDomain } from '../config/blueprint';
import { masteryOf } from '../engine/adaptive';
import { quadrants } from '../engine/pacing';
import { itemById } from '../content';
import { useStore } from '../state/store';

/**
 * Analytics across both tracks.
 *
 * The quadrant split is the piece that earns its place: "fast and wrong" and "slow and
 * right" are entirely different problems requiring opposite fixes, and a single
 * accuracy percentage hides both of them.
 */
export function Stats() {
  const state = useStore();
  const { level, into, needed } = levelProgress(state.xp);

  const points = useMemo(
    () =>
      state.attempts.flatMap((a) => {
        const item = itemById(a.itemId);
        return item ? [{ timeSec: a.timeSec, correct: a.correct, topic: a.topic, target: item.targetTimeSec }] : [];
      }),
    [state.attempts],
  );

  const avgTarget = points.length
    ? points.reduce((s, p) => s + p.target, 0) / points.length
    : 60;
  const quad = quadrants(points, avgTarget);
  const totalQuad = quad.fastRight + quad.fastWrong + quad.slowRight + quad.slowWrong;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold">נתונים</h1>
        <p className="num text-sm text-slate-400">
          רמה {level} · {into}/{needed} XP · {state.attempts.length} שאלות · רצף שיא {state.streak.longest}
        </p>
      </header>

      <section className="card">
        <h2 className="mb-3 text-sm font-semibold text-slate-400">שליטה לפי נושא</h2>
        <div className="space-y-2">
          {ALL_TOPICS.map((topic) => {
            const ability = state.abilities[topic.id] ?? { rating: 0, attempts: 0, correct: 0 };
            const mastery = masteryOf(ability);
            const domain = topicDomain(topic.id);
            return (
              <div key={topic.id}>
                <div className="mb-0.5 flex justify-between text-xs">
                  <span className="text-slate-300">{topicLabel(topic.id)}</span>
                  <span className="num text-slate-500">
                    {ability.attempts > 0 ? `${ability.correct}/${ability.attempts}` : '—'}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-raised">
                  <div
                    className={`h-full transition-[width] ${domain === 'verbal' ? 'bg-verbal' : 'bg-quant'}`}
                    style={{ width: `${mastery * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {totalQuad > 0 && (
        <section className="card">
          <h2 className="mb-1 text-sm font-semibold text-slate-400">מהירות מול דיוק</h2>
          <p className="mb-3 text-xs text-slate-500">
            ״מהר ושגוי״ ו״לאט ונכון״ הן בעיות הפוכות — אחוז דיוק בודד מסתיר את שתיהן.
          </p>
          <div className="grid grid-cols-2 gap-2 text-center text-sm">
            <Quadrant label="מהר ונכון" value={quad.fastRight} total={totalQuad} tone="text-quant" hint="המצב הרצוי" />
            <Quadrant label="לאט ונכון" value={quad.slowRight} total={totalQuad} tone="text-xp" hint="תרגל קצב" />
            <Quadrant label="מהר ושגוי" value={quad.fastWrong} total={totalQuad} tone="text-danger" hint="האט ובדוק" />
            <Quadrant label="לאט ושגוי" value={quad.slowWrong} total={totalQuad} tone="text-danger" hint="פער ידע — חזור לשיעור" />
          </div>
        </section>
      )}

      {state.mockResults.length > 0 && (
        <section className="card">
          <h2 className="mb-2 text-sm font-semibold text-slate-400">היסטוריית סימולציות</h2>
          <div className="space-y-1.5">
            {state.mockResults.map((mock) => (
              <div key={mock.id} className="flex justify-between text-sm">
                <span className="num text-slate-400">{mock.at.slice(0, 10)}</span>
                <span className="num font-bold text-slate-100">{mock.estimatedScore}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {state.essayDrafts.length > 0 && (
        <section className="card">
          <h2 className="mb-2 text-sm font-semibold text-slate-400">חיבורים</h2>
          <div className="space-y-1.5">
            {state.essayDrafts.map((draft) => (
              <div key={draft.id} className="flex justify-between text-sm">
                <span className="num text-slate-400">{draft.at.slice(0, 10)}</span>
                <span className="num text-slate-200">
                  תוכן {draft.contentScore}/6 · לשון {draft.languageScore}/6
                  <span className="ms-1 text-slate-500">({draft.lineCount} שורות)</span>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card">
        <h2 className="mb-3 text-sm font-semibold text-slate-400">
          הישגים <span className="num">({state.badges.length}/{BADGES.length})</span>
        </h2>
        <div className="grid grid-cols-5 gap-2">
          {BADGES.map((badge) => {
            const earned = state.badges.includes(badge.id);
            return (
              <div
                key={badge.id}
                title={`${badgeById(badge.id)?.he} — ${badge.description}`}
                className={`grid aspect-square place-items-center rounded-xl text-2xl ${
                  earned ? 'bg-xp/15' : 'bg-raised opacity-30 grayscale'
                }`}
              >
                {badge.icon}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Quadrant({
  label,
  value,
  total,
  tone,
  hint,
}: {
  label: string;
  value: number;
  total: number;
  tone: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl bg-raised/50 p-3">
      <p className={`num text-2xl font-bold ${tone}`}>{Math.round((value / total) * 100)}%</p>
      <p className="text-xs text-slate-300">{label}</p>
      <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>
    </div>
  );
}
