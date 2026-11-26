import { useEffect, useMemo, useRef } from 'react'
import { useLab, useTick } from '../app/lab'
import { FS, RANGE_UV } from '../sim/model'
import { MONTAGES, rowsFor, type Montage } from '../dsp/store'

const LEFT = 92,
  RIGHT = 10,
  TOP = 6,
  BOTTOM = 22

export const clock = (sample: number) => {
  const s = Math.max(0, sample / FS)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${(s % 60).toFixed(1).padStart(4, '0')}`
}

export function Traces() {
  const l = useLab()
  const canvas = useRef<HTMLCanvasElement>(null),
    box = useRef<HTMLDivElement>(null)
  const rows = useMemo(() => rowsFor(l.montage), [l.montage])
  useEffect(() => {
    const cv = canvas.current!,
      root = box.current!,
      ctx = cv.getContext('2d')
    if (!ctx) return
    let frame = 0
    const draw = () => {
      frame = 0
      const css = getComputedStyle(document.documentElement)
      const color = (name: string) => css.getPropertyValue(name).trim() || '#888'
      const w = root.clientWidth,
        h = root.clientHeight,
        dpr = Math.min(2, window.devicePixelRatio || 1)
      if (w < 2 || h < 2) return
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
        cv.width = Math.round(w * dpr)
        cv.height = Math.round(h * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      const s = l.signals,
        end = l.frozen ?? s.end,
        count = l.seconds * FS,
        start = end - count
      const lane = (h - TOP - BOTTOM) / rows.length,
        plotW = w - LEFT - RIGHT
      const px = (sample: number) => LEFT + ((sample - start) / count) * plotW
      ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace'
      // Time grid every second.
      for (let t = Math.ceil(start / FS); t * FS < end; t++) {
        const x = px(t * FS)
        ctx.strokeStyle = color('--grid')
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x, TOP)
        ctx.lineTo(x, h - BOTTOM)
        ctx.stroke()
        ctx.fillStyle = color('--muted')
        ctx.textAlign = 'center'
        if (x > LEFT + 20 && x < w - 20) ctx.fillText(clock(t * FS).slice(0, 5), x, h - 7)
      }
      // Stimulation-on shading and cue markers.
      for (const m of s.marks) {
        if (m.sample < start || m.sample >= end || m.kind === 'action') continue
        const x = px(m.sample)
        ctx.strokeStyle = color('--accent-2')
        ctx.setLineDash([3, 3])
        ctx.beginPath()
        ctx.moveTo(x, TOP)
        ctx.lineTo(x, h - BOTTOM)
        ctx.stroke()
        ctx.setLineDash([])
      }
      rows.forEach((row, i) => {
        const y = TOP + (i + 0.5) * lane,
          selected = row.name === l.focus
        if (selected) {
          ctx.fillStyle = color('--select')
          ctx.fillRect(0, TOP + i * lane, w, lane)
        }
        ctx.fillStyle = selected ? color('--accent') : color('--text')
        ctx.textAlign = 'left'
        ctx.fillText(row.name, 8, y + 4)
        const gain = lane / 2 / l.scale
        ctx.save()
        ctx.beginPath()
        ctx.rect(LEFT, TOP + i * lane, plotW, lane)
        ctx.clip()
        ctx.strokeStyle = selected ? color('--accent') : color('--trace')
        ctx.lineWidth = selected ? 1.4 : 1
        ctx.beginPath()
        const first = Math.max(start, s.start),
          step = count / plotW
        let clipped = false
        if (step > 1.5) {
          for (let x = Math.floor((first - start) / step); x < plotW; x++) {
            const a = Math.max(first, Math.floor(start + x * step)),
              b = Math.min(end, Math.floor(start + (x + 1) * step))
            if (b <= a) continue
            let mn = Infinity,
              mx = -Infinity
            for (let k = a; k < b; k++) {
              const v = s.value(k, row)
              if (v < mn) mn = v
              if (v > mx) mx = v
            }
            if (mx >= RANGE_UV || mn <= -RANGE_UV) clipped = true
            ctx.moveTo(LEFT + x, y - mx * gain)
            ctx.lineTo(LEFT + x, y - mn * gain)
          }
        } else {
          for (let k = first; k < end; k++) {
            const v = s.value(k, row)
            if (Math.abs(v) >= RANGE_UV) clipped = true
            if (k === first) ctx.moveTo(px(k), y - v * gain)
            else ctx.lineTo(px(k), y - v * gain)
          }
        }
        ctx.stroke()
        ctx.restore()
        if (clipped) {
          ctx.fillStyle = color('--warn')
          ctx.fillText('CLIPPED', 8, y + 17)
        }
      })
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(draw)
    }
    const unsubscribe = l.signals.subscribe(schedule),
      observer = new ResizeObserver(schedule)
    observer.observe(root)
    const scheme = matchMedia('(prefers-color-scheme: dark)')
    scheme.addEventListener('change', schedule)
    schedule()
    return () => {
      unsubscribe()
      observer.disconnect()
      scheme.removeEventListener('change', schedule)
      cancelAnimationFrame(frame)
    }
  }, [l.signals, l.frozen, l.seconds, l.scale, l.montage, l.focus, rows])
  return (
    <section className="panel traces" aria-label="Live LFP recording">
      <div className="panel-head">
        <h2>LFP monitor</h2>
        <span className={'pill ' + (l.frozen !== null || l.paused ? 'muted' : 'live')}>
          {!l.ready ? 'Starting' : l.frozen !== null ? 'Frozen' : l.paused ? 'Paused' : 'Live'}
        </span>
      </div>
      <div className="toolbar">
        <label>
          Montage
          <select value={l.montage} onChange={(e) => l.setMontage(e.target.value as Montage)}>
            {MONTAGES.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        <label>
          Scale
          <select value={l.scale} onChange={(e) => l.setScale(+e.target.value)}>
            {[2, 5, 10, 20, 50, 200, 400].map((v) => (
              <option key={v} value={v}>
                ±{v} µV
              </option>
            ))}
          </select>
        </label>
        <label>
          Window
          <select value={l.seconds} onChange={(e) => l.setSeconds(+e.target.value)}>
            {[1, 2, 4, 8, 10].map((v) => (
              <option key={v} value={v}>
                {v} s
              </option>
            ))}
          </select>
        </label>
        <button className="btn" disabled={!l.ready} onClick={() => (l.frozen !== null ? l.live() : l.freeze())}>
          {l.frozen !== null ? 'Go live' : 'Freeze'}
        </button>
        <button className="btn ghost" onClick={l.pause}>
          {l.paused ? 'Resume' : 'Pause'}
        </button>
      </div>
      <div className="trace-canvas" ref={box}>
        <canvas
          ref={canvas}
          role="img"
          aria-label={`${rows.length} LFP derivations, positive up. Click a trace to analyse it.`}
          onPointerDown={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            const i = Math.floor(((e.clientY - r.top - TOP) / (r.height - TOP - BOTTOM)) * rows.length)
            const row = rows[Math.max(0, Math.min(rows.length - 1, i))]
            l.setFocus(row.name)
          }}
        />
      </div>
      <div className="strip">
        <span>Positive up · ±{l.scale} µV per lane half</span>
        <label className="sr-only" htmlFor="focus">
          Analysed derivation
        </label>
        <select id="focus" value={l.focus} onChange={(e) => l.setFocus(e.target.value)} aria-label="Analysed derivation">
          {rows.map((r) => (
            <option key={r.name}>{r.name}</option>
          ))}
        </select>
        <Clock />
      </div>
    </section>
  )
}

function Clock() {
  const l = useLab()
  useTick(l.signals, 200)
  return <time>{clock(l.frozen ?? l.signals.end)}</time>
}
