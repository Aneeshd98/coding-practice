import { useId } from 'react'

export interface Series {
  name: string
  y: ArrayLike<number>
  color: string
  dashed?: boolean
  fill?: boolean
  width?: number
}
export interface Band {
  from: number
  to: number
  color: string
  label?: string
  labelColor?: string
}

const niceStep = (span: number, target: number) => {
  const raw = span / target,
    mag = 10 ** Math.floor(Math.log10(raw))
  return [1, 2, 5, 10].map((m) => m * mag).find((m) => m >= raw)!
}
const superscript = (n: number) =>
  (n < 0 ? '⁻' : '') + String(Math.abs(n)).replace(/\d/g, (c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c])

/** SVG chart with min/max decimation so short events survive at any width. */
export function Chart({
  series,
  x0,
  x1,
  xLabel,
  yLabel,
  log = false,
  yRange,
  bands = [],
  vlines = [],
  markers = [],
  zero = false,
  height = 190,
  unit = '',
}: {
  series: Series[]
  x0: number
  x1: number
  xLabel: string
  yLabel: string
  log?: boolean
  yRange?: [number, number]
  bands?: Band[]
  vlines?: { at: number; label?: string }[]
  markers?: { x: number; y: number; label: string; color: string }[]
  zero?: boolean
  height?: number
  unit?: string
}) {
  const id = useId().replace(/:/g, '')
  const w = 680,
    h = height,
    L = 50,
    R = 14,
    T = 16,
    B = 34
  const pw = w - L - R,
    ph = h - T - B
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
  if (yRange) [lo, hi] = [tf(yRange[0]), tf(yRange[1])]
  if (!Number.isFinite(lo)) [lo, hi] = [0, 1]
  if (zero && !log) {
    lo = Math.min(lo, 0)
    hi = Math.max(hi, 0)
  }
  if (hi - lo < 1e-9) hi = lo + 1
  if (log) {
    lo = Math.floor(lo)
    hi = Math.ceil(hi)
  } else if (!yRange) {
    const pad = (hi - lo) * 0.1
    lo -= pad
    hi += pad
  }
  const X = (x: number) => L + ((x - x0) / (x1 - x0)) * pw
  const Y = (v: number) => T + ((hi - tf(v)) / (hi - lo)) * ph
  const Yraw = (t: number) => T + ((hi - t) / (hi - lo)) * ph
  const points = (s: Series) => {
    const n = s.y.length
    const step = Math.max(1, Math.floor(n / pw))
    const out: [number, number][] = []
    for (let i = 0; i < n; i += step) {
      let mn = i,
        mx = i
      for (let j = i + 1; j < Math.min(n, i + step); j++) {
        if (s.y[j] < s.y[mn]) mn = j
        if (s.y[j] > s.y[mx]) mx = j
      }
      for (const k of mn === mx ? [mn] : mn < mx ? [mn, mx] : [mx, mn])
        out.push([X(x0 + ((x1 - x0) * k) / Math.max(1, n - 1)), Math.max(T, Math.min(T + ph, Y(s.y[k])))])
    }
    return out
  }
  const xStep = niceStep(x1 - x0, 6)
  const xTicks: number[] = []
  for (let v = Math.ceil(x0 / xStep - 1e-9) * xStep; v <= x1 + 1e-9; v += xStep) xTicks.push(+(Math.round(v / xStep) * xStep).toFixed(6))
  const yTicks: number[] = []
  if (log) for (let v = lo; v <= hi; v++) yTicks.push(v)
  else {
    const step = niceStep(hi - lo, 4)
    for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) yTicks.push(+v.toFixed(6))
  }
  const fmtY = (v: number) => (log ? '10' + superscript(v) : Math.abs(v) >= 100 ? v.toFixed(0) : +v.toFixed(2) + '')
  return (
    <figure className="chart">
      <figcaption>
        <span>{yLabel}</span>
        {series.length > 0 && (
          <span className="legend">
            {series.map((s) => (
              <span key={s.name}>
                <i style={{ background: s.color }} />
                {s.name}
              </span>
            ))}
          </span>
        )}
      </figcaption>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${yLabel} against ${xLabel}: ${series.map((s) => s.name).join(', ')}`}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={i} id={`${id}-g${i}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={s.color} stopOpacity="0.28" />
              <stop offset="1" stopColor={s.color} stopOpacity="0.02" />
            </linearGradient>
          ))}
          <clipPath id={`${id}-clip`}>
            <rect x={L} y={T} width={pw} height={ph} />
          </clipPath>
        </defs>
        {bands.map((b, i) => (
          <g key={i}>
            <rect x={Math.max(L, X(b.from))} y={T} width={Math.max(1, Math.min(L + pw, X(b.to)) - Math.max(L, X(b.from)))} height={ph} fill={b.color} />
            {b.label && (
              <text className="band-label" x={Math.max(L, X(b.from)) + 6} y={T + 13} fill={b.labelColor ?? 'currentColor'}>
                {b.label}
              </text>
            )}
          </g>
        ))}
        <g className="grid">
          {yTicks.map((v) => (
            <line key={'y' + v} x1={L} x2={L + pw} y1={Yraw(v)} y2={Yraw(v)} />
          ))}
          {xTicks.map((v) => (
            <line key={'x' + v} x1={X(v)} x2={X(v)} y1={T} y2={T + ph} />
          ))}
        </g>
        {zero && !log && lo < 0 && hi > 0 && <line x1={L} x2={L + pw} y1={Yraw(0)} y2={Yraw(0)} stroke="var(--muted)" strokeOpacity="0.5" />}
        {yTicks.map((v) => (
          <text key={'yt' + v} className="tick" x={L - 8} y={Yraw(v) + 3.5} textAnchor="end">
            {fmtY(v)}
          </text>
        ))}
        {xTicks.map((v) => (
          <text key={'xt' + v} className="tick" x={X(v)} y={T + ph + 15} textAnchor="middle">
            {+v.toFixed(3)}
            {unit}
          </text>
        ))}
        {vlines.map((v, i) => (
          <g key={i}>
            <line className="vline" x1={X(v.at)} x2={X(v.at)} y1={T} y2={T + ph} />
            {v.label && (
              <text className="vline-label" x={X(v.at) + 5} y={T + 12}>
                {v.label}
              </text>
            )}
          </g>
        ))}
        <g clipPath={`url(#${id}-clip)`}>
          {series.map((s, i) => {
            const p = points(s)
            if (p.length < 2) return null
            const d = 'M' + p.map(([x, y]) => x.toFixed(1) + ',' + y.toFixed(1)).join('L')
            return (
              <g key={s.name}>
                {s.fill && <path d={`${d}L${p.at(-1)![0].toFixed(1)},${T + ph}L${p[0][0].toFixed(1)},${T + ph}Z`} fill={`url(#${id}-g${i})`} />}
                <path d={d} fill="none" stroke={s.color} strokeWidth={s.width ?? 1.7} strokeLinejoin="round" strokeDasharray={s.dashed ? '6 5' : undefined} />
              </g>
            )
          })}
        </g>
        {markers.map((m, i) => (
          <g key={i}>
            <circle cx={X(m.x)} cy={Y(m.y)} r={4.5} fill={m.color} stroke="var(--surface)" strokeWidth={2} />
            <text className="marker-label" x={X(m.x) > L + pw - 110 ? X(m.x) - 9 : X(m.x) + 9} y={Math.max(T + 10, Y(m.y) - 8)} fill={m.color} textAnchor={X(m.x) > L + pw - 110 ? 'end' : 'start'}>
              {m.label}
            </text>
          </g>
        ))}
        <text className="axis-label" x={L + pw / 2} y={h - 2} textAnchor="middle">
          {xLabel}
        </text>
      </svg>
    </figure>
  )
}
