// Festive hanging lights for the upper corners. Decorative only; kept away from controls.
export default function Lights({ side = 'left' }) {
  const bulbs = [['#ffcc66', 14, 22], ['#f08a5d', 40, 34], ['#ffcc66', 66, 40], ['#e2574c', 92, 41], ['#ffcc66', 118, 37], ['#f2a541', 144, 28]];
  return (
    <svg className={`lights ${side}`} viewBox="0 0 160 56" aria-hidden="true">
      <path d="M0 8 Q 80 60 160 6" fill="none" stroke="#6b3a2e" strokeWidth="1.5" />
      {bulbs.map(([c, x, y], i) => (
        <g key={i}><rect x={x - 2} y={y - 7} width="4" height="5" fill="#6b3a2e" /><ellipse cx={x} cy={y + 3} rx="5" ry="7" fill={c} className="bulb" style={{ animationDelay: `${i * 0.35}s` }} /></g>
      ))}
    </svg>
  );
}
