/**
 * The app's icon set.
 *
 * These replace the emoji the interface used before. Emoji render as a different
 * picture on every platform, sit on their own baseline and cannot take a colour — so
 * they never looked like part of the design. These are stroke icons on a 24px grid at
 * a single weight, inheriting `currentColor` so they take the ink or the accent
 * exactly like the text beside them.
 */

export type IconName =
  | 'home' | 'map' | 'review' | 'english' | 'stats'
  | 'clock' | 'pen' | 'exam' | 'paper' | 'target'
  | 'book' | 'vocab' | 'flame' | 'snowflake' | 'compass' | 'check';

const PATHS: Record<IconName, JSX.Element> = {
  home: <path d="M3 10l9-7 9 7v10a1 1 0 01-1 1h-5v-7H9v7H4a1 1 0 01-1-1z" />,
  map: <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15" />,
  review: <><path d="M21 12a9 9 0 11-3-6.7" /><path d="M21 3v6h-6" /></>,
  english: <><path d="M4 5h16v14H4z" /><path d="M4 9h16" /></>,
  stats: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  pen: <><path d="M4 20h16" /><path d="M14.5 4.5l5 5L8 21H3v-5z" /></>,
  exam: <><path d="M5 3h14v18l-7-4-7 4z" /></>,
  paper: <><path d="M6 2h8l4 4v16H6z" /><path d="M14 2v4h4" /><path d="M9 12h6M9 16h6" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /></>,
  book: <><path d="M4 4h11a3 3 0 013 3v13H7a3 3 0 01-3-3z" /><path d="M4 17a3 3 0 013-3h11" /></>,
  vocab: <><path d="M4 5h7v14H4zM13 5h7v14h-7z" /><path d="M7 9h1M16 9h1" /></>,
  flame: <path d="M12 2c1 4-2 5-2 8a4 4 0 008 0c0-2-1-3-1-3 3 2 4 5 4 7a9 9 0 11-18 0C3 9 8 6 12 2z" />,
  snowflake: <path d="M12 2v20M4 7l16 10M20 7L4 17" />,
  compass: <><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></>,
  check: <path d="M20 6L9 17l-5-5" />,
};

interface IconProps {
  name: IconName;
  /** Pixel size; the stroke stays optically even across the range we use. */
  size?: number;
  className?: string;
  /** Solid icons read better than outlines at very small sizes; used for the streak. */
  filled?: boolean;
}

export function Icon({ name, size = 18, className = '', filled = false }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
