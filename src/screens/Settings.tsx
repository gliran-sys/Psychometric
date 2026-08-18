import { useState } from 'react';
import { AMIRNET_SCALE, EXEMPTION_SCORE, RETAKE_INTERVAL_DAYS } from '../config/amirnet';
import { buildPlan, PHASE_INFO } from '../engine/planner';
import { useStore, isEnglishDone } from '../state/store';
import { formatHebrewDate, today } from '../lib/date';

export function Settings() {
  const profile = useStore((s) => s.profile);
  const updateProfile = useStore((s) => s.updateProfile);
  const exportJson = useStore((s) => s.exportJson);
  const importJson = useStore((s) => s.importJson);
  const resetProgress = useStore((s) => s.resetProgress);
  const englishDone = useStore(isEnglishDone);

  const [importText, setImportText] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const plan =
    profile.testDate && profile.testDate > today()
      ? buildPlan({
          startDate: today(),
          testDate: profile.testDate,
          dailyMinutes: profile.dailyGoalMinutes,
          englishDone,
        })
      : null;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">הגדרות</h1>

      <section className="card space-y-3">
        <h2 className="text-sm font-semibold text-slate-400">מועדי הבחינות</h2>

        <Field label="תאריך הפסיכומטרי">
          <input
            type="date"
            value={profile.testDate ?? ''}
            min={today()}
            onChange={(e) => updateProfile({ testDate: e.target.value || null })}
            className="input"
          />
        </Field>

        <Field label="דקות תרגול ביום">
          <input
            type="number"
            min={10}
            max={180}
            value={profile.dailyGoalMinutes}
            onChange={(e) => updateProfile({ dailyGoalMinutes: Number(e.target.value) })}
            className="input"
          />
        </Field>
      </section>

      <section className="card space-y-3">
        <h2 className="text-sm font-semibold text-english">אמירנט</h2>
        <p className="text-xs text-slate-400">
          אמירנט נערך כל השנה ללא מועדים קבועים, וניתן לחזור עליו אחרי {RETAKE_INTERVAL_DAYS} ימים —
          ולכן כדאי לגשת אליו מוקדם ולסגור את האנגלית לפני הפסיכומטרי.
        </p>

        <Field label={`סף הפטור במוסד שלך (ברירת מחדל ${EXEMPTION_SCORE})`}>
          <input
            type="number"
            min={AMIRNET_SCALE.min}
            max={AMIRNET_SCALE.max}
            value={profile.amirnetTargetScore}
            onChange={(e) => updateProfile({ amirnetTargetScore: Number(e.target.value) })}
            className="input"
          />
        </Field>

        <Field label="תאריך המבחן האחרון שנגשת אליו">
          <input
            type="date"
            value={profile.amirnetLastSitting ?? ''}
            max={today()}
            onChange={(e) => updateProfile({ amirnetLastSitting: e.target.value || null })}
            className="input"
          />
        </Field>

        <Field label="הציון האמיתי שקיבלת">
          <input
            type="number"
            min={AMIRNET_SCALE.min}
            max={AMIRNET_SCALE.max}
            value={profile.amirnetRealScore ?? ''}
            placeholder="טרם ניגשתי"
            onChange={(e) =>
              updateProfile({ amirnetRealScore: e.target.value === '' ? null : Number(e.target.value) })
            }
            className="input"
          />
        </Field>

        {englishDone && (
          <p className="text-sm text-quant">
            ✓ עברת את סף הפטור. המסלול הזה נסגר והזמן היומי עובר לפסיכומטרי.
          </p>
        )}
      </section>

      {plan && (
        <section className="card space-y-2">
          <h2 className="text-sm font-semibold text-slate-400">תוכנית הלימודים שנוצרה</h2>
          <p className="num text-sm text-slate-300">{plan.totalDays} ימים עד המבחן</p>
          <ul className="space-y-1 text-xs text-slate-400">
            <li>· {PHASE_INFO.A.he}: ימים 1-{plan.phaseBoundaries.A}</li>
            <li>· {PHASE_INFO.B.he}: ימים {plan.phaseBoundaries.A + 1}-{plan.phaseBoundaries.B}</li>
            <li>· {PHASE_INFO.C.he}: ימים {plan.phaseBoundaries.B + 1}-{plan.totalDays}</li>
            {plan.amirnetSittingDay !== null && (
              <li className="text-english">
                · מבחן אמירנט אמיתי: {formatHebrewDate(plan.days[plan.amirnetSittingDay].date)}
              </li>
            )}
          </ul>
        </section>
      )}

      <section className="card space-y-3">
        <h2 className="text-sm font-semibold text-slate-400">גיבוי</h2>
        <p className="text-xs text-slate-400">
          ההתקדמות נשמרת בדפדפן הזה בלבד. ייצא קובץ לפני ניקוי היסטוריה או מעבר למכשיר אחר.
        </p>

        <button
          type="button"
          className="btn-ghost w-full"
          onClick={() => {
            navigator.clipboard?.writeText(exportJson());
            setMessage('ההתקדמות הועתקה ללוח');
          }}
        >
          העתק גיבוי ללוח
        </button>

        <textarea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder="הדבק כאן גיבוי כדי לשחזר"
          className="h-20 w-full rounded-lg border border-rule-strong bg-surface p-2 text-xs text-slate-200 outline-none focus:border-xp"
        />
        <button
          type="button"
          className="btn-ghost w-full"
          disabled={importText.trim() === ''}
          onClick={() => setMessage(importJson(importText) ? 'שוחזר בהצלחה' : 'הקובץ אינו תקין')}
        >
          שחזר מגיבוי
        </button>

        {message && <p className="text-center text-xs text-quant">{message}</p>}
      </section>

      <button
        type="button"
        className="btn w-full border border-danger/50 text-danger"
        onClick={() => {
          if (confirm('לאפס את כל ההתקדמות? הפעולה אינה הפיכה.')) resetProgress();
        }}
      >
        אפס התקדמות
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-400">{label}</span>
      {children}
    </label>
  );
}
