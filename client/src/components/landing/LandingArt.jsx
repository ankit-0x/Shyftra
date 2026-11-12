// client/src/components/landing/LandingArt.jsx
// Decorative SVG artwork for the landing hero: two glowing clocks with
// orbit arcs, and the constellation graphic bottom-right. All colours come
// from the theme tokens, so it re-tints automatically in light/dark mode.

const SAGE = "var(--color-secondary)";
const CORAL = "var(--color-primary)";

// 4-point concave star centred on (0,0)
function Star({ x, y, r, color }) {
  const d = `M0 ${-r} Q0 0 ${r} 0 Q0 0 0 ${r} Q0 0 ${-r} 0 Q0 0 0 ${-r}Z`;
  return <path d={d} transform={`translate(${x} ${y})`} fill={color} />;
}

export function ClockArt({ className = "" }) {
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = (i * 30 * Math.PI) / 180;
    return { x: 100 + Math.sin(a) * 27, y: 100 - Math.cos(a) * 27 };
  });
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden="true" fill="none">
      <defs>
        <radialGradient id="clockGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={CORAL} stopOpacity="0.35" />
          <stop offset="70%" stopColor={CORAL} stopOpacity="0.08" />
          <stop offset="100%" stopColor={CORAL} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="62" fill="url(#clockGlow)" />
      {/* faint outer orbits */}
      <circle cx="100" cy="100" r="92" stroke={CORAL} strokeOpacity="0.18" strokeWidth="1" />
      <circle cx="100" cy="100" r="78" stroke={SAGE} strokeOpacity="0.14" strokeWidth="1" />
      {/* orbit arcs with end dots */}
      <path d="M57 52 Q100 20 144 52" stroke={SAGE} strokeOpacity="0.8" strokeWidth="1.6" />
      <circle cx="57" cy="52" r="3.4" fill={CORAL} />
      <circle cx="144" cy="52" r="3.4" fill={SAGE} />
      <path d="M57 148 Q100 180 144 148" stroke={SAGE} strokeOpacity="0.8" strokeWidth="1.6" />
      <circle cx="57" cy="148" r="3.4" fill={CORAL} />
      <circle cx="144" cy="148" r="3.4" fill={SAGE} />
      {/* clock face */}
      <circle cx="100" cy="100" r="41" stroke={CORAL} strokeWidth="2" />
      <circle cx="100" cy="100" r="34" stroke={CORAL} strokeOpacity="0.75" strokeWidth="1.6" />
      {ticks.map((t, i) => (
        <circle key={i} cx={t.x} cy={t.y} r="1.1" fill={CORAL} opacity="0.85" />
      ))}
      <path d="M100 100 L86 91" stroke={CORAL} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M100 100 L118 88" stroke={CORAL} strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="100" cy="100" r="2.6" fill={CORAL} />
    </svg>
  );
}

export function ConstellationArt({ className = "" }) {
  return (
    <svg viewBox="0 0 282 200" className={className} aria-hidden="true" fill="none">
      {/* coral road line with rounded corner, running off the right edge */}
      <path d="M10 141 H178 Q200 141 200 119 V36 Q200 8 232 0" stroke={CORAL} strokeOpacity="0.55" strokeWidth="1.4" />
      {/* constellation lines */}
      <g stroke={SAGE} strokeOpacity="0.7" strokeWidth="1">
        <path d="M78 134 L147 106 L201 119 L282 58" />
        <path d="M147 106 L96 188" />
        <path d="M78 134 L186 193" />
        <path d="M201 119 L160 174 L140 200" />
        <path d="M10 193 L78 134" />
        <path d="M10 193 L80 164 L96 188 L40 193" />
      </g>
      {/* stars */}
      <Star x={78} y={134} r={5} color={SAGE} />
      <Star x={147} y={106} r={8} color={CORAL} />
      <Star x={201} y={119} r={11} color={SAGE} />
      <Star x={80} y={164} r={11} color={SAGE} />
      <Star x={96} y={188} r={9} color={SAGE} />
      <Star x={160} y={174} r={6} color={CORAL} />
      <Star x={167} y={135} r={5} color={SAGE} />
      {/* stray dots */}
      <circle cx="120" cy="81" r="2.2" fill={SAGE} opacity="0.8" />
      <circle cx="261" cy="136" r="2" fill={SAGE} opacity="0.7" />
      <circle cx="231" cy="163" r="2.4" fill={SAGE} opacity="0.7" />
    </svg>
  );
}
