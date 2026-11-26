export interface Series {
  name: string
  y: ArrayLike<number>
  color: string
  dashed?: boolean
}

/** Lightweight SVG line plot. Keeps per-pixel extremes so short events survive decimation. */
export function Plot({
  series,
  x0,
  x1,
  xLabel,
  yLabel,
  log = false,
  yRange,
  bands = [],
  vlines = [],
  height = 170,
}: {
  series: Series[]
  x0: number
  x1: number
  xLabel: string
  yLabel: string
  log?: boolean
  yRange?: [number, number]
  bands?: { from: number; to: number; color: string }[]
  vlines?: { at: number; label?: string }[]
  height?: number
}) {
  const w = 640,
    h = height,
    left = 52,
    right = 12,
    top = 10,
    bottom = 30
  const pw = w - left - right,
    ph = h - top - bottom
  const tf = (v: number) => (log ? Math.log10(Math.max(v, 1e-6)) : v)
  let lo = Infinity,
    hi = -Infinity
  for (const s of series)
    for (let i = 0; i < s.y.length; i++) {
      const v = tf(s.y[i])
      if (Number.isFinite(v)) {
        lo = Math.min(lo, v)
        hi = Math.max(hi, v)
      }
    }
  if (yRange) [lo, hi] = yRange.map(tf) as [number, number]
  if (!Number.isFinite(lo)) [lo, hi] = [0, 1]
  if (hi - lo < 1e-9) hi = lo + 1
  if (!yRange && !log) {
    const pad = (hi - lo) * 0.08
    lo -= pad
    hi += pad
  }
  const X = (x: number) => left + ((x - x0) / (x1 - x0)) * pw
  const Y = (v: number) => top + ((hi - tf(v)) / (hi - lo)) * ph
  const path = (s: Series) => {
    const n = s.y.length
    if (n < 2) return ''
    const step = Math.max(1, Math.floor(n / pw))
    let d = ''
    for (let i = 0; i < n; i += step) {
      let mn = i,
        mx = i
      for (let j = i + 1; j < Math.min(n, i + step); j++) {
        if (s.y[j] < s.y[mn]) mn = j
        if (s.y[j] > s.y[mx]) mx = j
      }
      for (const k of mn < mx ? [mn, mx] : mn === mx ? [mn] : [mx, mn]) {
        const x = X(x0 + ((x1 - x0) * k) / (n - 1)),
          y = Math.max(top, Math.min(top + ph, Y(s.y[k])))
        d += (d ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1)
      }
    }
    return d
  }
  // Round x ticks: 1, 2 or 5 × 10ⁿ, about five across the axis.
  const raw = (x1 - x0) / 5,
    mag = 10 ** Math.floor(Math.log10(raw)),
    unit = [1, 2, 5, 10].map((m) => m * mag).find((m) => m >= raw)!
  const xTicks: number[] = []
  for (let v = Math.ceil(x0 / unit - 1e-9) * unit; v <= x1 + 1e-9; v += unit) xTicks.push(Math.round(v / unit) * unit)
  const yTicks = log
    ? Array.from({ length: Math.floor(hi) - Math.ceil(lo) + 1 }, (_, i) => Math.ceil(lo) + i)
    : [lo, (lo + hi) / 2, hi]
  const fmt = (v: number) => (log ? '10' + (v < 0 ? '⁻' : '') + String(Math.abs(v)).replace(/\d/g, (c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c]) : Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(1))
  return (
    <figure className="plot">
      <figcaption>
        <span>{yLabel}</span>
        <span className="legend">
          {series.map((s) => (
            <span key={s.name}>
              <i style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${series.map((s) => s.name).join(', ')}: ${yLabel} against ${xLabel}`}>
        {bands.map((b, i) => (
          <rect key={i} x={X(b.from)} width={Math.max(1, X(b.to) - X(b.from))} y={top} height={ph} fill={b.color} />
        ))}
        {yTicks.map((v) => (
          <g key={v} className="grid">
            <line x1={left} x2={w - right} y1={top + ((hi - v) / (hi - lo)) * ph} y2={top + ((hi - v) / (hi - lo)) * ph} />
            <text x={left - 6} y={top + ((hi - v) / (hi - lo)) * ph + 4} textAnchor="end">
              {fmt(v)}
            </text>
          </g>
        ))}
        {xTicks.map((v) => (
          <g key={v} className="grid">
            <line x1={X(v)} x2={X(v)} y1={top} y2={top + ph} />
            <text x={X(v)} y={h - 14} textAnchor="middle">
              {+v.toFixed(2)}
            </text>
          </g>
        ))}
        {vlines.map((v, i) => (
          <g key={i} className="vline">
            <line x1={X(v.at)} x2={X(v.at)} y1={top} y2={top + ph} />
            {v.label && (
              <text x={X(v.at) + 4} y={top + 12}>
                {v.label}
              </text>
            )}
          </g>
        ))}
        {series.map((s) => (
          <path key={s.name} d={path(s)} fill="none" stroke={s.color} strokeWidth={1.5} strokeDasharray={s.dashed ? '5 4' : undefined} />
        ))}
        <text x={left + pw / 2} y={h - 1} textAnchor="middle" className="axis">
          {xLabel}
        </text>
      </svg>
    </figure>
  )
}
