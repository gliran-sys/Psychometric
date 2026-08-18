import { NavLink, Outlet } from 'react-router-dom';
import { isEnglishDone, useStore } from '../state/store';
import { levelProgress } from '../engine/gamification';
import { Icon, type IconName } from './Icon';

const NAV: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/', label: 'בית', icon: 'home', end: true },
  { to: '/map', label: 'מפה', icon: 'map' },
  { to: '/review', label: 'חזרה', icon: 'review' },
  { to: '/english', label: 'אנגלית', icon: 'english' },
  { to: '/stats', label: 'נתונים', icon: 'stats' },
];

export function Layout() {
  const xp = useStore((s) => s.xp);
  const streak = useStore((s) => s.streak);
  const englishDone = useStore(isEnglishDone);
  const { level } = levelProgress(xp);

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      {/*
        The game chrome is deliberately demoted in this direction. The old header led
        with a level dial and an XP bar; here the product names itself and the streak
        and level sit quietly beside it as text. Progress is still visible — it just no
        longer outranks the work.
      */}
      <header className="sticky top-0 z-10 border-b border-rule bg-paper/95 backdrop-blur">
        <div className="flex items-baseline justify-between px-6 py-3.5">
          <span className="font-display text-lg font-bold tracking-tight text-slate-100">
            פסיכומטרי
          </span>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Icon name="flame" size={12} filled className="text-accent" />
              רצף <span className="num font-semibold text-slate-100">{streak.current}</span>
            </span>
            {streak.freezeTokens > 0 && (
              <span className="num flex items-center gap-0.5 text-slate-500" title="הקפאות זמינות">
                <Icon name="snowflake" size={11} />
                {streak.freezeTokens}
              </span>
            )}
            <span className="h-3 w-px bg-rule-strong" />
            <span>
              רמה <span className="num font-semibold text-slate-100">{level}</span>
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 px-6 py-4">
        <Outlet />
      </main>

      <nav className="sticky bottom-0 border-t border-rule-strong bg-raised">
        <div className="flex">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] transition ${
                  isActive ? 'text-slate-100' : 'text-slate-500'
                }`
              }
            >
              <Icon name={item.icon} size={18} />
              {item.label}
              {/* Once English clears the exemption line, the track is done — the tick
                  stops the tab nagging and the daily time goes back to the PET. */}
              {item.to === '/english' && englishDone && (
                <Icon name="check" size={9} className="absolute end-5 top-2 text-quant" />
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
