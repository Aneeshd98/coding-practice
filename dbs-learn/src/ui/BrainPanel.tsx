import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Brain, Crosshair, Eye, EyeOff, Maximize2, Minimize2, RotateCcw, Tag } from 'lucide-react'
import { useLab, useTick } from '../app/lab'
import { FS, LANE, type Side } from '../sim/model'
import { rowNamed } from '../dsp/store'
import { BrainScene, type CortexMode, type Label, type ViewPreset } from '../three/BrainScene'
import { LeadSchematic } from './LeadSchematic'

const VIEWS: { id: ViewPreset; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'coronal', label: 'Coronal' },
  { id: 'sagittal', label: 'Sagittal' },
  { id: 'target', label: 'Target' },
]

function useWebGL() {
  const [ok] = useState(() => {
    try {
      const c = document.createElement('canvas')
      return !!(c.getContext('webgl2') || c.getContext('webgl'))
    } catch {
      return false
    }
  })
  return ok
}

export function BrainPanel() {
  const l = useLab()
  useTick(l.signals, 500)
  const host = useRef<HTMLDivElement>(null)
  const scene = useRef<BrainScene | null>(null)
  const [labels, setLabels] = useState<Label[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [view, setView] = useState<ViewPreset>('overview')
  const [side, setSide] = useState<Side>('L')
  const [cortex, setCortex] = useState<CortexMode>('glass')
  const [head, setHead] = useState(true)
  const [showLabels, setShowLabels] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const webgl = useWebGL()
  const live = useRef(l)
  live.current = l

  useEffect(() => {
    if (!webgl || !host.current) return
    let s: BrainScene
    try {
      s = new BrainScene(host.current)
    } catch {
      setFailed(true)
      return
    }
    scene.current = s
    s.labelRoot = host.current.parentElement?.querySelector<HTMLElement>('.labels') ?? null
    s.onLabels = setLabels
    s.onReady = () => setLoading(false)
    s.live = () => {
      const lab = live.current,
        end = lab.frozen ?? lab.signals.end
      const mean = (lane: number) => {
        let sum = 0,
          n = 0
        for (let i = Math.max(lab.signals.start, end - Math.round(0.12 * FS)); i < end; i++, n++) sum += lab.signals.at(i, lane)
        return n ? sum / n : 0
      }
      return {
        beta: { L: mean(LANE.betaL), R: mean(LANE.betaR) },
        stim: { L: lab.signals.at(end - 1, LANE.stimL), R: lab.signals.at(end - 1, LANE.stimR) },
      }
    }
    s.load(import.meta.env.BASE_URL + 'anatomy/').catch(() => {
      setFailed(true)
      setLoading(false)
    })
    return () => {
      s.dispose()
      scene.current = null
    }
  }, [webgl])

  const focus = rowNamed(l.focus)
  const delivered = l.signals.configAt(l.viewEnd() - 1)
  useLayoutEffect(() => {
    scene.current?.update({
      border: l.subject?.border ?? null,
      revealed: l.revealed,
      sensing: focus ? { side: focus.side, contacts: [focus.a % 4, ...(focus.b < 0 ? [] : [focus.b % 4])] } : null,
      stimContact: delivered.stim.on ? delivered.stim.contact : null,
      cortex,
      head,
      view,
      targetSide: side,
      labels: showLabels,
    })
  })

  const stim = l.config.stim
  const sensing = focus ? focus.name : '—'
  const usable = webgl && !failed
  return (
    <section className={'card brain-card' + (expanded ? ' expanded' : '')} aria-label="3D brain model">
      <header className="card-head">
        <div className="card-title">
          <span className="icon-tile">
            <Brain size={17} />
          </span>
          <h2>Brain model</h2>
        </div>
        <div className="card-actions">
          {usable && (
            <button className="icon-btn" title="Reset camera" aria-label="Reset camera" onClick={() => scene.current?.resetView()}>
              <RotateCcw size={15} />
            </button>
          )}
          <button className="icon-btn" title={expanded ? 'Collapse' : 'Expand'} aria-label={expanded ? 'Collapse brain model' : 'Expand brain model'} onClick={() => setExpanded(!expanded)}>
            {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </div>
      </header>
      <div className="viewport">
        {usable ? (
          <>
            <div className="viewport-host" ref={host} />
            <div className="labels" aria-hidden="true" ref={(el) => {
              if (scene.current) scene.current.labelRoot = el
            }}>
              {labels.map((x) => (
                <span key={x.id} data-label={x.id} className={'label3d ' + x.kind}>
                  <i />
                  {x.text}
                </span>
              ))}
            </div>
            <div className="vp-top">
              <div className="seg dark" role="group" aria-label="Camera view">
                {VIEWS.map((v) => (
                  <button key={v.id} aria-pressed={view === v.id} onClick={() => setView(v.id)}>
                    {v.id === 'target' && <Crosshair size={13} />}
                    {v.label}
                  </button>
                ))}
              </div>
              {view === 'target' ? (
                <div className="seg dark" role="group" aria-label="Target side">
                  {(['L', 'R'] as Side[]).map((s) => (
                    <button key={s} aria-pressed={side === s} onClick={() => setSide(s)}>
                      {s === 'L' ? 'Left' : 'Right'}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="seg dark" role="group" aria-label="Cortex">
                  {(['glass', 'solid', 'hidden'] as CortexMode[]).map((m) => (
                    <button key={m} aria-pressed={cortex === m} onClick={() => setCortex(m)}>
                      {m === 'glass' ? 'Glass' : m === 'solid' ? 'Solid' : 'No cortex'}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="vp-bottom">
              <div className="legend3d">
                <span>
                  <i className="sw stn" /> STN · glows with beta
                </span>
                <span>
                  <i className="sw sense" /> sensing pair
                </span>
                <span>
                  <i className="sw stim" /> stimulation
                </span>
              </div>
              <div className="vp-tools">
                {view === 'overview' && (
                  <button className="chip-btn" aria-pressed={head} onClick={() => setHead(!head)}>
                    Head
                  </button>
                )}
                <button className="chip-btn" aria-pressed={showLabels} onClick={() => setShowLabels(!showLabels)}>
                  <Tag size={12} /> Labels
                </button>
                <button className="chip-btn beta" aria-pressed={l.revealed} onClick={() => l.setRevealed(!l.revealed)}>
                  {l.revealed ? <EyeOff size={12} /> : <Eye size={12} />} {l.revealed ? 'Hide' : 'Reveal'} β region
                </button>
              </div>
            </div>
            {loading && <div className="vp-status">Loading anatomy…</div>}
          </>
        ) : (
          <LeadSchematic />
        )}
      </div>
      <footer className="card-foot">
        <span className="kv">
          <b>Sensing</b> {sensing}
        </span>
        <span className="kv">
          <b>Stimulation</b> {stim.on ? `L${stim.contact.L} · R${stim.contact.R} · ${l.config.adaptive.on ? 'adaptive ≤ ' + l.config.adaptive.max : stim.amplitude.toFixed(1)} mA · ${stim.frequency} Hz` : 'off'}
        </span>
        <span className="kv muted">{usable ? 'Drag to rotate · scroll to zoom · nuclei are schematic' : 'Deep nuclei are schematic'}</span>
      </footer>
    </section>
  )
}
