import { useLab, useTick } from '../app/lab'
import { CONTACTS, SIDES, contactZ, type Side } from '../sim/model'
import { rowNamed } from '../dsp/store'

const MM = 17,
  H = 290,
  BASE = 225
const y = (z: number) => BASE - z * MM

function Lead({ side }: { side: Side }) {
  const l = useLab()
  const cfg = l.signals.configAt(l.viewEnd() - 1)
  const focus = rowNamed(l.focus)
  const sensing =
    focus && focus.side === side
      ? [focus.a % 4, focus.b < 0 ? -1 : focus.b % 4]
      : []
  const stimContact = cfg.stim.on ? cfg.stim.contact[side] : -1
  const border = l.subject?.border[side]
  const cx = 80
  return (
    <svg viewBox={`0 0 160 ${H}`} className="lead" role="img" aria-label={`${side === 'L' ? 'Left' : 'Right'} lead with four contacts`}>
      <text x={cx} y={16} textAnchor="middle" className="lead-title">
        {side === 'L' ? 'Left STN' : 'Right STN'}
      </text>
      <ellipse cx={cx} cy={y(1.5)} rx={56} ry={4.6 * MM} className="stn" />
      <text x={cx + 58} y={y(-2.6)} textAnchor="end" className="tiny">
        STN (schematic)
      </text>
      {l.revealed && border !== undefined && (
        <g>
          <clipPath id={'clip-' + side}>
            <ellipse cx={cx} cy={y(1.5)} rx={56} ry={4.6 * MM} />
          </clipPath>
          <rect x={0} width={160} y={y(border)} height={H} className="beta-region" clipPath={`url(#clip-${side})`} />
          <line x1={14} x2={146} y1={y(border)} y2={y(border)} className="border-line" />
          <text x={146} y={y(border) - 4} textAnchor="end" className="tiny">
            beta edge
          </text>
        </g>
      )}
      <rect x={cx - 6} y={y(11)} width={12} height={y(-1.2) - y(11)} rx={6} className="shaft" />
      {Array.from({ length: CONTACTS }, (_, c) => {
        const top = y(contactZ(c) + 0.75)
        const cls =
          'contact' + (c === stimContact ? ' stim' : '') + (sensing.includes(c) ? ' sense' : '')
        return (
          <g key={c}>
            <rect x={cx - 8} y={top} width={16} height={1.5 * MM} rx={2} className={cls} />
            <text x={cx + 14} y={top + 0.75 * MM + 4} className="contact-label">
              {c}
            </text>
          </g>
        )
      })}
      {stimContact >= 0 && (
        <text x={cx - 14} y={y(contactZ(stimContact)) + 4} textAnchor="end" className="tiny stim-label">
          stim {cfg.stim.amplitude} mA
        </text>
      )}
    </svg>
  )
}

export function LeadView() {
  const l = useLab()
  useTick(l.signals, 700)
  return (
    <section className="panel lead-panel" aria-label="Lead diagram">
      <div className="panel-head">
        <h2>Leads</h2>
        <button className="btn ghost small" onClick={() => l.setRevealed(!l.revealed)}>
          {l.revealed ? 'Hide beta region' : 'Reveal beta region'}
        </button>
      </div>
      <div className="leads">
        {SIDES.map((s) => (
          <Lead key={s} side={s} />
        ))}
      </div>
      <p className="note">
        <span className="swatch sense" /> analysed pair <span className="swatch stim" /> stimulating contact · contact 0 is
        deepest
      </p>
    </section>
  )
}
