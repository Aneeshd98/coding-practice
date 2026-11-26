import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { FS, INITIAL, applyPatch, type Config, type ConfigPatch, type Movement, type Subject } from '../sim/model'
import { SignalStore, rowsFor, type Montage } from '../dsp/store'
import { CAPTURE_SECONDS, type Captures } from '../course/practicals'

export function load<T>(key: string, fallback: T): T {
  try {
    const v = JSON.parse(localStorage.getItem('dbs-learn.' + key) ?? 'null')
    return v === null || typeof v !== typeof fallback ? fallback : v
  } catch {
    return fallback
  }
}
export function store<T>(key: string, value: T) {
  try {
    localStorage.setItem('dbs-learn.' + key, JSON.stringify(value))
  } catch {
    /* Private browsing: progress lasts for this tab only. */
  }
}

function useController() {
  const [signals] = useState(() => new SignalStore(300))
  const worker = useRef<Worker | null>(null)
  const [config, setConfig] = useState<Config>(INITIAL)
  const [seed, setSeed] = useState(() => load('seed', 7))
  const [subject, setSubject] = useState<Subject | null>(null)
  const [ready, setReady] = useState(false)
  const [paused, setPaused] = useState(false)
  const [frozen, setFrozen] = useState<number | null>(null)
  const [seconds, setSeconds] = useState(4)
  const [scale, setScale] = useState(5)
  const [montage, setMontageState] = useState<Montage>('Sandwich pairs')
  const [focus, setFocus] = useState('L 0–2')
  const [captures, setCaptures] = useState<Captures>({})
  const [protocol, setProtocol] = useState<{ done: number; total: number } | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const w = new Worker(new URL('../sim/worker.ts', import.meta.url), { type: 'module' })
    worker.current = w
    w.onmessage = ({ data: m }) => {
      if (m.type === 'block') {
        signals.ingest(m.start, m.data, m.marks, m.states)
        setReady(true)
      } else if (m.type === 'subject') setSubject(m.subject)
      else if (m.type === 'protocol') setProtocol(m.status)
    }
    w.postMessage({ type: 'init', seed })
    setConfig(INITIAL)
    setCaptures({})
    setRevealed(false)
    setFrozen(null)
    return () => w.terminate()
  }, [signals, seed])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(''), 3200)
    return () => clearTimeout(t)
  }, [notice])

  const change = (patch: ConfigPatch, label?: string) => {
    setConfig((c) => applyPatch(c, patch))
    worker.current?.postMessage({ type: 'config', patch, label })
    setFrozen(null)
  }
  const setMontage = (m: Montage) => {
    setMontageState(m)
    const rows = rowsFor(m)
    if (!rows.some((r) => r.name === focus)) setFocus(rows.find((r) => r.side === focus[0])?.name ?? rows[0].name)
  }
  // Read on demand: samples arrive without re-rendering the controller.
  const viewEnd = () => frozen ?? signals.end
  const capture = (kind: 'off' | 'on') => {
    const end = viewEnd(),
      start = Math.max(signals.start, end - CAPTURE_SECONDS * FS)
    setCaptures((c) => ({ ...c, [kind]: { start, end, row: focus } }))
    setNotice(`Captured ${kind.toUpperCase()} · ${focus} · ${((end - start) / FS).toFixed(0)} s`)
  }
  return {
    signals,
    config,
    change,
    subject,
    seed,
    newPatient: () => {
      const next = seed + 1
      store('seed', next)
      setSeed(next)
      setNotice('New virtual patient. Their beta region and frequencies differ.')
    },
    ready,
    paused,
    pause: () => {
      worker.current?.postMessage({ type: 'pause', value: !paused })
      setPaused(!paused)
    },
    frozen,
    freeze: () => setFrozen(signals.end),
    live: () => setFrozen(null),
    viewEnd,
    seconds,
    setSeconds,
    scale,
    setScale,
    montage,
    setMontage,
    focus,
    setFocus,
    captures,
    capture,
    protocol,
    runMovement: (fast: boolean, cycles = 12, hand: Movement = 'right') => {
      setFrozen(null)
      setConfig((c) => ({ ...c, movement: 'rest' }))
      worker.current?.postMessage({ type: 'protocol', start: true, cycles, hand, fast })
    },
    stopMovement: () => worker.current?.postMessage({ type: 'protocol', start: false }),
    revealed,
    setRevealed,
    notice,
    tell: setNotice,
  }
}

export type Lab = ReturnType<typeof useController>
const Context = createContext<Lab | null>(null)
export function LabProvider({ children }: { children: ReactNode }) {
  return <Context.Provider value={useController()}>{children}</Context.Provider>
}
export function useLab() {
  const lab = useContext(Context)
  if (!lab) throw new Error('LabProvider missing')
  return lab
}

/** Re-render at most every `ms` while samples arrive. */
export function useTick(signals: SignalStore, ms = 300) {
  const [, setTick] = useState(0)
  useEffect(() => {
    let last = 0
    return signals.subscribe(() => {
      const now = performance.now()
      if (now - last >= ms) {
        last = now
        setTick((v) => v + 1)
      }
    })
  }, [signals, ms])
}
