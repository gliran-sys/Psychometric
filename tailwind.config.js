/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Body text stays on the system stack so first paint never waits on a webfont.
        sans: [
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Noto Sans Hebrew',
          'Arial Hebrew',
          'Arial',
          'sans-serif',
        ],
        // Display face for headings, the countdown and every score. Hebrew system
        // serifs are unreliable, so a fallback chain of the ones that do exist.
        display: ['Frank Ruhl Libre', 'Narkisim', 'David', 'Georgia', 'Times New Roman', 'serif'],
      },
      colors: {
        // "מחברת" — warm paper and ink. The surfaces run from the page background up
        // to the raised nav bar; `rule` is the hairline that replaces card borders.
        paper: '#faf6ef',
        surface: '#fffdf9',
        raised: '#f3ede2',
        rule: { DEFAULT: '#e7dfd2', strong: '#dbd1c0' },

        // One accent, used for anything actionable or earned. Everything else is ink.
        accent: { DEFAULT: '#8a2433', soft: '#f6ebe9' },

        /**
         * Domain hues share the accent's lightness and chroma and vary only in hue,
         * so no domain shouts louder than another. The dark theme's colours were tuned
         * for a near-black background and are far too light to read on cream.
         */
        verbal: '#2f4a8f',
        quant: '#1a6b4d',
        english: '#8a2470',
        danger: '#b3261e',

        /**
         * `xp` keeps its name so the gamification code reads unchanged, but the gold
         * of the dark theme is illegible on paper — it becomes the accent. Demoting XP
         * to the same ink as everything else is part of this direction, not an accident.
         */
        xp: { DEFAULT: '#8a2433', dim: '#c9a9a9' },

        /**
         * The slate scale is repointed, not removed: every screen already expresses
         * "primary text" as slate-100 and "muted" as slate-500. Inverting the ramp
         * keeps that meaning intact on paper and migrates every screen at once.
         *
         * The muted end is DARKER than a straight inversion would give. A mid grey that
         * read as comfortably secondary on near-black falls to about 2.3:1 on cream —
         * below the 4.5:1 floor for body text. Muted still reads as muted here because
         * the primary ink is nearly black; it just no longer fails the contrast floor.
         */
        slate: {
          50: '#0c0a09',
          100: '#1c1917',
          200: '#292524',
          300: '#413b35',
          400: '#57504a',
          500: '#6b635b',
          600: '#756c63',
        },
      },
      keyframes: {
        pop: { '0%': { transform: 'scale(0.9)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
      },
      animation: {
        pop: 'pop 180ms ease-out',
      },
    },
  },
  plugins: [],
};
