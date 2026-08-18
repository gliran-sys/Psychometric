interface MeterProps {
  label: string;
  value: number;
  min: number;
  max: number;
  /** Optional line drawn on the bar — the exemption threshold, or a target score. */
  marker?: { at: number; label: string };
  tone?: 'accent' | 'verbal' | 'quant' | 'english';
  caption?: string;
}

const TONE_CLASSES = {
  accent: 'bg-accent',
  verbal: 'bg-verbal',
  quant: 'bg-quant',
  english: 'bg-english',
} as const;

/**
 * The app's headline number. Two of these sit on the dashboard — the PET 200-800 and
 * the AMIRNET 50-150 — because the user is preparing for two separate exams.
 *
 * The marker line is the point of the component: a bare score says little, but a score
 * next to the exemption threshold says exactly how much work is left.
 *
 * On paper the bar is a 2px rule rather than a rounded capsule, and the score is set
 * in the display serif: the number is the thing to look at, not its container.
 */
export function Meter({ label, value, min, max, marker, tone = 'accent', caption }: MeterProps) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const fraction = (clamp(value) - min) / (max - min);
  const markerFraction = marker ? (clamp(marker.at) - min) / (max - min) : null;

  return (
    <div>
      <div className="mb-2.5 flex items-baseline justify-between">
        <span className="text-sm text-slate-300">{label}</span>
        <span className="figure text-3xl font-bold leading-none text-slate-100">
          {Math.round(value)}
        </span>
      </div>

      <div className="relative h-0.5 bg-rule-strong">
        <div
          className={`absolute right-0 top-0 h-0.5 ${TONE_CLASSES[tone]} transition-[width] duration-700`}
          style={{ width: `${fraction * 100}%` }}
        />
        {markerFraction !== null && (
          /* RTL: the bar fills from the right, so the marker is positioned from the right too. */
          <div
            className="absolute -top-1 h-2.5 w-px bg-slate-100"
            style={{ right: `${markerFraction * 100}%` }}
            title={marker!.label}
          />
        )}
      </div>

      {/* RTL: the fill grows from the right edge leftward, so the RIGHT end of the bar
          is the minimum and the left end is the maximum. In a right-to-left flex row
          the first child renders rightmost, so `min` must come first — labelling them
          the other way round puts the scale backwards under the bar. */}
      <div className="mt-1.5 flex justify-between text-xs text-slate-500">
        <span className="num">{min}</span>
        {marker && <span className="text-slate-300">{marker.label}</span>}
        <span className="num">{max}</span>
      </div>

      {caption && <p className="mt-2 text-xs leading-relaxed text-slate-400">{caption}</p>}
    </div>
  );
}
