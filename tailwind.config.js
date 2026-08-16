/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // System stack only — no webfont CDN, so the app works offline and never
        // blocks first paint. Each entry covers Hebrew on a different platform.
        sans: [
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Noto Sans Hebrew',
          'Arial Hebrew',
          'Rubik',
          'Assistant',
          'Arial',
          'sans-serif',
        ],
      },
      colors: {
        // Dark "night sky" RPG palette — the skill tree reads as a constellation map.
        ink: { 900: '#0b1020', 800: '#131a30', 700: '#1c2542', 600: '#28345c' },
        xp: { DEFAULT: '#f5b83d', dim: '#8a6a1f' },
        verbal: { DEFAULT: '#7c9cff', dim: '#2f3f7a' },
        quant: { DEFAULT: '#48d1a0', dim: '#1d5647' },
        english: { DEFAULT: '#e879a8', dim: '#6b2f47' },
        danger: '#ff6b6b',
      },
      keyframes: {
        pop: { '0%': { transform: 'scale(0.9)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        glow: { '0%,100%': { opacity: '0.5' }, '50%': { opacity: '1' } },
      },
      animation: {
        pop: 'pop 180ms ease-out',
        glow: 'glow 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
