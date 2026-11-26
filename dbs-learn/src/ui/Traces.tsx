import { useEffect, useMemo, useRef } from 'react'
import { Activity, Pause, Play, Snowflake } from 'lucide-react'
import { useLab, useTick } from '../app/lab'
import { FS, LANE, RANGE_UV } from '../sim/model'
import { MONTAGES, rowsFor, type Montage } from '../dsp/store'
import { SpectrogramStrip } from './Spectrogram'

const GUTTER = 78,
  RIGHT = 14,
  TOP = 18,
  BOTTOM = 26

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
      const c = (name: string) => css.getPropertyValue(name).trim() || '#888'
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
      const plotW = w - GUTTER - RIGHT,
        lane = (h - TOP - BOTTOM) / rows.length
      const px = (sample: number) => GUTTER + ((sample - start) / count) * plotW
      // Stimulation band along the top edge.
      ctx.fillStyle = c('--stim')
      for (let k = Math.max(start, s.start); k < end; k += 4) {
        if (s.at(k, LANE.stimL) > 0.05 || s.at(k, LANE.stimR) > 0.05) ctx.fillRect(px(k), 4, Math.max(1, plotW / count * 4 + 0.5), 4)
      }
      ctx.font = '10.5px "JetBrains Mono", monospace'
      // Time grid: major each second, minor each 200 ms when zoomed in.
      for (let t = Math.ceil(start / (FS / 5)); (t * FS) / 5 < end; t++) {
        const x = px((t * FS) / 5),
          major = t % 5 === 0
        if (!major && l.seconds > 4) continue
        ctx.strokeStyle = c('--grid')
        ctx.lineWidth = major ? 1 : 0.6
        ctx.beginPath()
        ctx.moveTo(x, TOP)
        ctx.lineTo(x, h - BOTTOM)
        ctx.stroke()
        if (major && x > GUTTER + 24 && x < w - 24) {
          ctx.fillStyle = c('--muted')
          ctx.textAlign = 'center'
          ctx.fillText(clock((t * FS) / 5).slice(0, 5), x, h - 9)
        }
      }
      // Cue markers.
      for (const m of s.marks) {
        if (m.sample < start || m.sample >= end || m.kind === 'action') continue
        const x = px(m.sample)
        ctx.strokeStyle = m.kind === 'cue' ? c('--primary') : c('--muted')
        ctx.setLineDash([4, 4])
        ctx.beginPath()
        ctx.moveTo(x, TOP)
        ctx.lineTo(x, h - BOTTOM)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = ctx.strokeStyle
        ctx.textAlign = 'left'
        ctx.fillText(m.kind === 'cue' ? 'move' : 'stop', x + 4, TOP + 10)
      }
      rows.forEach((row, i) => {
        const top = TOP + i * lane,
          y = top + lane / 2,
          selected = row.name === l.focus
        if (i > 0 && rows[i - 1].side !== row.side) {
          ctx.strokeStyle = c('--line')
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(0, top)
          ctx.lineTo(w, top)
          ctx.stroke()
        }
        if (selected) {
          ctx.fillStyle = c('--select')
          ctx.fillRect(0, top + 1, w, lane - 2)
          ctx.fillStyle = c('--primary')
          ctx.fillRect(0, top + 1, 3, lane - 2)
        }
        ctx.textAlign = 'left'
        ctx.font = (selected ? '600 ' : '500 ') + '12px "JetBrains Mono", monospace'
        ctx.fillStyle = selected ? c('--primary') : c('--ink-2')
        ctx.fillText(row.name.replace(' vs case', ''), 14, y + 4)
        if (row.b < 0) {
          ctx.font = '10px "JetBrains Mono", monospace'
          ctx.fillStyle = c('--muted')
          ctx.fillText('vs case', 14, y + 16)
        }
        const gain = lane / 2 / l.scale
        ctx.save()
        ctx.beginPath()
        ctx.rect(GUTTER, top, plotW, lane)
        ctx.clip()
        ctx.strokeStyle = selected ? c('--primary') : c('--trace')
        ctx.lineWidth = selected ? 1.4 : 1.05
        ctx.lineJoin = 'round'
        ctx.beginPath()
        const first = Math.max(start, s.start),
          step = count / plotW
        let clipped = false
        if (step > 1.5) {
          for (let x = Math.max(0, Math.floor((first - start) / step)); x < plotW; x++) {
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
            ctx.moveTo(GUTTER + x, y - mx * gain)
            ctx.lineTo(GUTTER + x, y - mn * gain)
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
          ctx.font = '600 9.5px "JetBrains Mono", monospace'
          const label = 'CLIPPED'
          const tw = ctx.measureText(label).width + 10
          ctx.fillStyle = c('--warn')
          ctx.globalAlpha = 0.14
          ctx.fillRect(w - RIGHT - tw - 2, top + 4, tw, 15)
          ctx.globalAlpha = 1
          ctx.textAlign = 'center'
          ctx.fillText(label, w - RIGHT - tw / 2 - 2, top + 15)
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
  const status = !l.ready ? 'Starting' : l.frozen !== null ? 'Frozen' : l.paused ? 'Paused' : 'Live'
  return (
    <section className="card traces" aria-label="Live LFP recording">
      <header className="card-head">
        <div className="card-title">
          <span className="icon-tile sense">
            <Activity size={17} />
          </span>
          <h2>LFP monitor</h2>
          <span className="tag">Simulated STN LFP</span>
        </div>
        <span className={'pill ' + (status === 'Live' ? 'live' : '')}>
          <i />
          {status}
        </span>
      </header>
      <div className="toolbar">
        <label className="select">
          <span className="sr-only">Montage</span>
          <select aria-label="Montage" value={l.montage} onChange={(e) => l.setMontage(e.target.value as Montage)}>
            {MONTAGES.map((m) => (
              <option key={m} disabled={m === 'Segments' && l.config.lead !== 'directional'}>
                {m === 'Segments' && l.config.lead !== 'directional' ? 'Segments (directional lead only)' : m}
              </option>
            ))}
          </select>
        </label>
        <span className="meta">
          {rows.length} channels · {FS} Hz
        </span>
        <span className="grow" />
        <label className="select">
          Scale
          <select aria-label="Scale" value={l.scale} onChange={(e) => l.setScale(+e.target.value)}>
            {[2, 5, 10, 20, 50, 200, 400].map((v) => (
              <option key={v} value={v}>
                ±{v} µV
              </option>
            ))}
          </select>
        </label>
        <label className="select">
          Window
          <select aria-label="Window" value={l.seconds} onChange={(e) => l.setSeconds(+e.target.value)}>
            {[1, 2, 4, 8, 10].map((v) => (
              <option key={v} value={v}>
                {v} s
              </option>
            ))}
          </select>
        </label>
        <button className="btn" disabled={!l.ready} onClick={() => (l.frozen !== null ? l.live() : l.freeze())}>
          {l.frozen !== null ? <Play size={14} /> : <Snowflake size={14} />}
          {l.frozen !== null ? 'Go live' : 'Freeze'}
        </button>
        <button className="icon-btn" title={l.paused ? 'Resume acquisition' : 'Pause acquisition'} aria-label={l.paused ? 'Resume acquisition' : 'Pause acquisition'} onClick={l.pause}>
          {l.paused ? <Play size={16} /> : <Pause size={16} />}
        </button>
      </div>
      <div className="trace-area" ref={box}>
        <canvas
          ref={canvas}
          role="img"
          aria-label={`${rows.length} LFP derivations, positive up. Click a trace to analyse it.`}
          onPointerDown={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            const i = Math.floor(((e.clientY - r.top - TOP) / (r.height - TOP - BOTTOM)) * rows.length)
            l.setFocus(rows[Math.max(0, Math.min(rows.length - 1, i))].name)
          }}
        />
      </div>
      <SpectrogramStrip />
      <footer className="trace-foot">
        <span>Positive up</span>
        <span>±{l.scale} µV per half-lane</span>
        <label className="select">
          Analysed
          <select aria-label="Analysed derivation" value={l.focus} onChange={(e) => l.setFocus(e.target.value)}>
            {rows.map((r) => (
              <option key={r.name}>{r.name}</option>
            ))}
          </select>
        </label>
        <Clock />
      </footer>
    </section>
  )
}

function Clock() {
  const l = useLab()
  useTick(l.signals, 200)
  return <time className="clock">{clock(l.frozen ?? l.signals.end)}</time>
}
