import { useLab } from '../app/lab'
import { CONTACTS, SIDES, contactZ, type Side } from '../sim/model'
import { rowNamed } from '../dsp/store'

const MM = 17,
  BASE = 250
const y = (z: number) => BASE - z * MM

/** 2D fallback when WebGL is unavailable: both leads in their STN, drawn to scale along the lead. */
function Lead({ side }: { side: Side }) {
  const l = useLab()
  const cfg = l.signals.configAt(l.viewEnd() - 1)
  const focus = rowNamed(l.focus)
  const sensing = focus && focus.side === side ? [focus.a % 4, focus.b < 0 ? -1 : focus.b % 4] : []
  const stim = cfg.stim.on ? cfg.stim.contact[side] : -1
  const border = l.subject?.border[side]
  return (
    <svg viewBox="0 0 160 300" role="img" aria-label={`${side === 'L' ? 'Left' : 'Right'} lead with four contacts`}>
      <text x={80} y={22} textAnchor="middle" fill="#dfe7fb" fontSize={12} fontWeight={600}>
        {side === 'L' ? 'Left STN' : 'Right STN'}
      </text>
      <ellipse cx={80} cy={y(1.5)} rx={58} ry={4.8 * MM} fill="rgba(242,166,90,0.16)" stroke="rgba(242,166,90,0.5)" />
      {l.revealed && border !== undefined && (
        <line x1={20} x2={140} y1={y(border)} y2={y(border)} stroke="#ff7fb0" strokeDasharray="4 3" />
      )}
      <rect x={74} y={y(12)} width={12} height={y(-1.2) - y(12)} rx={6} fill="#cfd8ea" opacity={0.85} />
      {Array.from({ length: CONTACTS }, (_, c) => (
        <g key={c}>
          <rect
            x={72}
            y={y(contactZ(c) + 0.75)}
            width={16}
            height={1.5 * MM}
            rx={2}
            fill={c === stim ? '#ffb020' : sensing.includes(c) ? '#2ee6d6' : '#9aa6bd'}
          />
          <text x={96} y={y(contactZ(c)) + 4} fill="#dfe7fb" fontSize={11} fontFamily="JetBrains Mono, monospace">
            {c}
          </text>
        </g>
      ))}
    </svg>
  )
}

export function LeadSchematic() {
  return (
    <div className="schematic">
      {SIDES.map((s) => (
        <Lead key={s} side={s} />
      ))}
    </div>
  )
}
