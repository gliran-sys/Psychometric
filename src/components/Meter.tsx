interface MeterProps {
  label: string;
  value: number;
  min: number;
  max: number;
  /** Optional line drawn on the bar — the exemption threshold, or a target score. */
  marker?: { at: number; label: string };
  tone?: 'xp' | 'verbal' | 'quant' | 'english';
  caption?: string;
}

const TONE_CLASSES = {
  xp: 'from-xp/70 to-xp',
  verbal: 'from-verbal/70 to-verbal',
  quant: 'from-quant/70 to-quant',
  english: 'from-english/70 to-english',
} as const;

/**
 * The app's headline number. Two of these sit on the dashboard — the PET 200-800 and
 * the AMIRNET 50-150 — because the user is preparing for two separate exams.
 *
 * The marker line is the point of the component: a bare score says little, but a score
 * next to the exemption threshold says exactly how much work is left.
 */
export function Meter({ label, value, min, max, marker, tone = 'xp', caption }: MeterProps) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const fraction = (clamp(value) - min) / (max - min);
  const markerFraction = marker ? (clamp(marker.at) - min) / (max - min) : null;

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm text-slate-300">{label}</span>
        <span className="num text-2xl font-bold text-slate-50">{Math.round(value)}</span>
      </div>

      <div className="relative h-3 overflow-hidden rounded-full bg-ink-700">
        <div
          className={`h-full rounded-full bg-gradient-to-l ${TONE_CLASSES[tone]} transition-[width] duration-700`}
          style={{ width: `${fraction * 100}%` }}
        />
        {markerFraction !== null && (
          <div
            className="absolute top-0 h-full w-0.5 bg-slate-100/80"
            /* RTL: the bar fills from the right, so the marker is positioned from the right too. */
            style={{ right: `${markerFraction * 100}%` }}
            title={marker!.label}
          />
        )}
      </div>

      {/* RTL: the fill grows from the right edge leftward, so the RIGHT end of the bar
          is the minimum and the left end is the maximum. In a right-to-left flex row
          the first child renders rightmost, so `min` must come first — labelling them
          the other way round puts the scale backwards under the bar. */}
      <div className="mt-1 flex justify-between text-xs text-slate-500">
        <span className="num">{min}</span>
        {marker && <span>{marker.label}</span>}
        <span className="num">{max}</span>
      </div>

      {caption && <p className="mt-1.5 text-xs text-slate-400">{caption}</p>}
    </div>
  );
}
