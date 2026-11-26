import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { load, store, useLab, useTick } from '../app/lab'
import { FS } from '../sim/model'
import { rowNamed } from '../dsp/store'
import { spectrogram } from '../dsp/spectrogram'
import { BETA, peak, prominent, welch } from '../dsp/spectrum'

const SPAN_S = 30,
  MAX_HZ = 60,
  DB: [number, number] = [-2, 8]

/** OKLCH to 8-bit sRGB. */
function oklch(L: number, C: number, h: number): [number, number, number] {
  const a = C * Math.cos((h * Math.PI) / 180),
    b = C * Math.sin((h * Math.PI) / 180)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3,
    m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3,
    s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const lin = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s]
  return lin.map((v) => {
    const c = Math.max(0, Math.min(1, v))
    return Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055))
  }) as [number, number, number]
}

/** One hue, more power is darker in light mode and brighter in dark mode. */
function ramp(dark: boolean) {
  return Array.from({ length: 256 }, (_, i) => {
    const t = i / 255
    return dark ? oklch(0.2 + 0.7 * t, 0.03 + 0.09 * t, 272) : oklch(0.975 - 0.67 * t, 0.012 + 0.16 * Math.min(1, t * 1.4), 268)
  })
}
const css = (rgb: [number, number, number]) => `rgb(${rgb.join(' ')})`

function useDark() {
  const [dark, setDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches)
  useEffect(() => {
    const m = matchMedia('(prefers-color-scheme: dark)')
    const on = () => setDark(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return dark
}

export function SpectrogramStrip() {
  const l = useLab()
  useTick(l.signals, 500)
  const [open, setOpen] = useState(() => load('spectrogram', true))
  const [hover, setHover] = useState<{ left: number; top: number; text: string } | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const dark = useDark()
  const colors = useRef<{ dark: boolean; lut: [number, number, number][] } | null>(null)
  if (!colors.current || colors.current.dark !== dark) colors.current = { dark, lut: ramp(dark) }
  const lut = colors.current.lut

  const row = rowNamed(l.focus)
  const end = l.viewEnd(),
    from = end - SPAN_S * FS
  const x = open && row ? l.signals.series(end, SPAN_S * FS, row) : new Float64Array()
  const first = end - x.length
  const sg = x.length >= 256 ? spectrogram(x, 256, Math.round(FS / 4), MAX_HZ) : null
  const hop = Math.round(FS / 4)
  // Columns span from half a hop before the first centre to half a hop after the last.
  const span = sg ? { a: first + sg.centres[0] - hop / 2, b: first + sg.centres.at(-1)! + hop / 2 } : null
  const pct = (sample: number) => (100 * (sample - from)) / (SPAN_S * FS)

  useEffect(() => {
    const cv = canvas.current
    if (!cv || !sg) return
    const cols = sg.columns.length,
      bins = sg.freqs.length
    if (cv.width !== cols) cv.width = cols
    if (cv.height !== bins) cv.height = bins
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const img = ctx.createImageData(cols, bins)
    for (let t = 0; t < cols; t++)
      for (let k = 0; k < bins; k++) {
        const v = Math.max(0, Math.min(1, (sg.columns[t][k] - DB[0]) / (DB[1] - DB[0])))
        const [r, g, b] = lut[Math.round(v * 255)]
        const p = ((bins - 1 - k) * cols + t) * 4
        img.data[p] = r
        img.data[p + 1] = g
        img.data[p + 2] = b
        img.data[p + 3] = 255
      }
    ctx.putImageData(img, 0, 0)
  })

  const toggle = () => {
    store('spectrogram', !open)
    setOpen(!open)
    setHover(null)
  }
  if (!open)
    return (
      <div className="spectro closed">
        <button className="spectro-toggle" aria-expanded={false} onClick={toggle}>
          <ChevronDown size={14} /> Show spectrogram
        </button>
      </div>
    )

  // A summary for screen readers: power at the beta peak in the last 5 s, relative to its usual level in this window.
  let summary = 'Collecting data.'
  if (sg) {
    const spectrum = welch(x),
      p = peak(spectrum, BETA[0], BETA[1])
    if (!prominent(spectrum, p, BETA[0], BETA[1])) summary = 'No clear beta peak in this window.'
    else {
      const near = sg.freqs.map((f, k) => (Math.abs(f - p.hz) <= 2 ? k : -1)).filter((k) => k >= 0)
      const recent = sg.columns.filter((_, t) => first + sg.centres[t] > end - 5 * FS)
      const db = recent.reduce((s, c) => s + near.reduce((a, k) => a + c[k], 0) / near.length, 0) / Math.max(1, recent.length)
      summary = `Beta peak near ${p.hz.toFixed(0)} Hz; in the last 5 seconds it is ${db >= 0 ? '+' : ''}${db.toFixed(1)} dB relative to its median over the window.`
    }
  }
  const events = l.signals.marks.filter((m) => m.kind === 'action' && m.sample > from && m.sample <= end)
  let lastLabel = -Infinity
  const freqY = (f: number) => 100 * (1 - f / MAX_HZ)

  return (
    <div className="spectro">
      <div className="spectro-head">
        <button className="spectro-toggle" aria-expanded onClick={toggle}>
          <ChevronUp size={14} /> Spectrogram · {row?.name} · last {SPAN_S} s
        </button>
        <span className="spectro-scale" aria-hidden="true">
          {DB[0]} dB
          <i style={{ background: `linear-gradient(90deg, ${[0, 64, 128, 192, 255].map((i) => css(lut[i])).join(', ')})` }} />+{DB[1]} dB
          <small>vs each frequency’s median</small>
        </span>
      </div>
      <div className="spectro-plot">
        <div className="spectro-y" aria-hidden="true">
          {[20, 40, 60].map((f) => (
            <span key={f} style={{ top: freqY(f) + '%' }}>
              {f} Hz
            </span>
          ))}
        </div>
        <div
          className="spectro-area"
          role="img"
          aria-label={`Spectrogram of ${row?.name} over the last ${SPAN_S} seconds, up to ${MAX_HZ} Hz. ${summary}`}
          onPointerMove={(e) => {
            if (!sg || !span) return
            const r = e.currentTarget.getBoundingClientRect()
            const fx = (e.clientX - r.left) / r.width,
              fy = (e.clientY - r.top) / r.height
            const sample = from + fx * SPAN_S * FS
            const t = Math.round((sample - first - sg.centres[0]) / hop)
            const f = (1 - fy) * MAX_HZ
            const k = sg.freqs.reduce((best, v, i) => (Math.abs(v - f) < Math.abs(sg.freqs[best] - f) ? i : best), 0)
            if (t < 0 || t >= sg.columns.length) return setHover(null)
            const db = sg.columns[t][k]
            setHover({
              // Keep the readout inside the plot near its edges.
              left: Math.max(80, Math.min(r.width - 80, e.clientX - r.left)),
              top: e.clientY - r.top,
              text: `${((end - sample) / FS).toFixed(1)} s ago · ${sg.freqs[k].toFixed(0)} Hz · ${db >= 0 ? '+' : ''}${db.toFixed(1)} dB`,
            })
          }}
          onPointerLeave={() => setHover(null)}
        >
          {sg && span ? (
            <canvas ref={canvas} style={{ left: pct(span.a) + '%', width: pct(span.b) - pct(span.a) + '%' }} />
          ) : (
            <span className="spectro-wait">Collecting…</span>
          )}
          <svg className="spectro-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {BETA.map((f) => (
              <line key={f} x1={0} x2={100} y1={freqY(f)} y2={freqY(f)} className="spectro-beta" vectorEffect="non-scaling-stroke" />
            ))}
            {events.map((m) => (
              <line key={m.sample} x1={pct(m.sample)} x2={pct(m.sample)} y1={0} y2={100} className="spectro-event" vectorEffect="non-scaling-stroke" />
            ))}
          </svg>
          <span className="spectro-band" style={{ top: freqY(BETA[1]) + '%' }}>
            β
          </span>
          {events.map((m) => {
            const at = pct(m.sample)
            if (at - lastLabel < 18) return null
            lastLabel = at
            return (
              // A recent event sits near the right edge: its label goes to the left of the line so it stays in the plot.
              <span key={m.sample} className={'spectro-label' + (at > 66 ? ' before' : '')} style={at > 66 ? { right: 100 - at + '%' } : { left: at + '%' }} title={m.label}>
                {m.label}
              </span>
            )
          })}
          {hover && (
            <span className="spectro-tip" style={{ left: hover.left, top: hover.top }}>
              {hover.text}
            </span>
          )}
        </div>
        <div className="spectro-x" aria-hidden="true">
          {[30, 20, 10, 0].map((s) => (
            <span key={s} style={{ left: 100 - (100 * s) / SPAN_S + '%' }}>
              {s ? `−${s} s` : 'now'}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
