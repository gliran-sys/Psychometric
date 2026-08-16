import { NavLink, Outlet } from 'react-router-dom';
import { isEnglishDone, useStore } from '../state/store';
import { levelProgress } from '../engine/gamification';

const NAV = [
  { to: '/', label: 'בית', icon: '🏠', end: true },
  { to: '/map', label: 'מפה', icon: '🗺️' },
  { to: '/review', label: 'חזרה', icon: '🔁' },
  { to: '/english', label: 'אנגלית', icon: '🇬🇧' },
  { to: '/stats', label: 'נתונים', icon: '📊' },
];

export function Layout() {
  const xp = useStore((s) => s.xp);
  const streak = useStore((s) => s.streak);
  const englishDone = useStore(isEnglishDone);
  const { level, fraction } = levelProgress(xp);

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <header className="sticky top-0 z-10 border-b border-ink-700 bg-ink-900/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <div className="relative grid h-9 w-9 place-items-center rounded-full bg-ink-700">
              <span className="num text-sm font-bold text-xp">{level}</span>
            </div>
            <div className="w-24">
              <div className="h-1.5 overflow-hidden rounded-full bg-ink-700">
                <div className="h-full bg-xp transition-[width]" style={{ width: `${fraction * 100}%` }} />
              </div>
              <span className="num text-[11px] text-slate-500">{xp} XP</span>
            </div>
          </div>

          <div className="flex items-center gap-1 text-sm">
            <span>🔥</span>
            <span className="num font-bold text-slate-200">{streak.current}</span>
            {streak.freezeTokens > 0 && (
              <span className="num ms-1 text-xs text-verbal" title="הקפאות זמינות">
                ❄︎{streak.freezeTokens}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-4">
        <Outlet />
      </main>

      <nav className="sticky bottom-0 border-t border-ink-700 bg-ink-900/95 backdrop-blur">
        <div className="flex">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] transition ${
                  isActive ? 'text-xp' : 'text-slate-500'
                }`
              }
            >
              <span className="relative text-lg">
                {item.icon}
                {/* Once English clears the exemption line, the track is done — the dot
                    stops nagging and the daily time goes back to the PET. */}
                {item.to === '/english' && englishDone && (
                  <span className="absolute -end-1 -top-0.5 text-[9px]">✓</span>
                )}
              </span>
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
