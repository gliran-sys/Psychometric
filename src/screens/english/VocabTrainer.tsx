import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ENGLISH_VOCAB, HEBREW_VOCAB } from '../../content';
import { dueCards, newCard, review, type SrsCard } from '../../engine/srs';
import { useStore } from '../../state/store';
import { today } from '../../lib/date';
import type { VocabEntry } from '../../content/schema';

/**
 * Spaced-repetition vocabulary, in both languages.
 *
 * For AMIRNET this is the single highest-leverage daily habit in the track: vocabulary
 * is not a separate section, it is embedded across sentence completion, restatement and
 * reading alike, so it is the hidden backbone of the whole score. The Hebrew list plays
 * the same role for PET analogies and sentence completion.
 */
export function VocabTrainer() {
  const [language, setLanguage] = useState<'english' | 'hebrew'>('english');
  const [revealed, setRevealed] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);

  const srs = useStore((s) => s.srs);
  const upsertSrsCard = useStore((s) => s.upsertSrsCard);
  const addXp = useStore((s) => s.addXp);
  const awardBadge = useStore((s) => s.awardBadge);
  const registerActivity = useStore((s) => s.registerActivity);
  const advanceQuest = useStore((s) => s.advanceQuest);

  const list = language === 'english' ? ENGLISH_VOCAB : HEBREW_VOCAB;

  /**
   * Due cards first, then never-seen words. Introducing new words only once the backlog
   * is clear stops the queue growing faster than it can be worked through.
   */
  const queue = useMemo(() => {
    const ids = new Set(list.map((v) => v.id));
    const due = dueCards(srs, today()).filter((c) => c.kind === 'vocab' && ids.has(c.id));
    const unseen = list.filter((v) => !srs[v.id]);
    return { due, unseen };
  }, [list, srs]);

  const currentEntry: VocabEntry | undefined =
    queue.due.length > 0
      ? list.find((v) => v.id === queue.due[0].id)
      : queue.unseen[0];

  const masteredCount = list.filter((v) => (srs[v.id]?.reps ?? 0) >= 3).length;

  const grade = (known: boolean) => {
    if (!currentEntry) return;
    const card: SrsCard = srs[currentEntry.id] ?? newCard(currentEntry.id, 'vocab', today());
    upsertSrsCard(review(card, known ? 5 : 1, today()));
    addXp(known ? 6 : 2);
    registerActivity();
    advanceQuest('english-vocab');
    if (masteredCount + 1 >= 100) awardBadge('vocab-100');
    setSessionCount((c) => c + 1);
    setRevealed(false);
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">אוצר מילים</h1>
          <p className="num text-xs text-slate-500">
            {masteredCount}/{list.length} בשליטה · {queue.due.length} לחזרה היום
          </p>
        </div>
        <div className="flex gap-1 rounded-lg bg-raised p-0.5 text-sm">
          {(['english', 'hebrew'] as const).map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => {
                setLanguage(lang);
                setRevealed(false);
              }}
              className={`rounded px-3 py-1 ${
                language === lang ? 'bg-rule-strong text-slate-100' : 'text-slate-400'
              }`}
            >
              {lang === 'english' ? 'EN' : 'עב'}
            </button>
          ))}
        </div>
      </header>

      {!currentEntry ? (
        <div className="space-y-3 py-10 text-center">
          <div className="text-4xl">✅</div>
          <p className="font-medium">סיימת את כל המילים להיום</p>
          <p className="num text-sm text-slate-500">{sessionCount} כרטיסים בסבב הזה</p>
          <Link to="/english" className="btn-ghost inline-block">חזרה</Link>
        </div>
      ) : (
        <>
          <div
            className="card min-h-[11rem] text-center"
            dir={language === 'english' ? 'ltr' : 'rtl'}
          >
            <p className="text-3xl font-bold text-slate-50">{currentEntry.term}</p>

            {revealed ? (
              <div className="mt-3 space-y-2">
                <p dir="rtl" className="text-slate-200">{currentEntry.meaning}</p>
                {currentEntry.example && (
                  <p className="text-sm italic text-slate-400">{currentEntry.example}</p>
                )}
                {currentEntry.confusableWith.length > 0 && (
                  <p className="text-xs text-danger">
                    ⚠︎ נבדל מ: {currentEntry.confusableWith.join(', ')}
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-8 text-sm text-slate-500">נסה להיזכר, ואז גלה</p>
            )}
          </div>

          {revealed ? (
            <div className="flex gap-2">
              <button type="button" className="btn-ghost flex-1" onClick={() => grade(false)}>
                לא ידעתי
              </button>
              <button type="button" className="btn-primary flex-1" onClick={() => grade(true)}>
                ידעתי
              </button>
            </div>
          ) : (
            <button type="button" className="btn-primary w-full" onClick={() => setRevealed(true)}>
              גלה
            </button>
          )}

          <p className="text-center text-xs text-slate-600">
            המילים החוזרות הן אלה שנפלת בהן — המרווח גדל בכל פעם שאתה זוכר.
          </p>
        </>
      )}
    </div>
  );
}
