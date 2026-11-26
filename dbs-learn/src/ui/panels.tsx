import { useMemo, useState } from 'react'
import { useLab, useTick } from '../app/lab'
import { FS, LANE, SIDES, type Movement } from '../sim/model'
import { rowNamed } from '../dsp/store'
import { BETA, bandPower, peak, welch } from '../dsp/spectrum'
import { analyzeBursts } from '../dsp/bursts'
import { POST_S, PRE_S, movementCourse } from '../dsp/movement'
import { betaPower, captureBursts } from '../course/practicals'
import { Plot } from './Plot'

export const TRIALS = 12
const C = { a: 'var(--accent)', b: 'var(--accent-2)', c: 'var(--warn)', d: 'var(--muted)' }

export function SubjectBar() {
  const l = useLab()
  useTick(l.signals, 500)
  const now = l.signals.configAt(l.signals.end - 1)
  const move = (m: Movement, label: string) => l.change({ movement: m }, label)
  return (
    <section className="subject-bar" aria-label="Virtual patient">
      <span className="who">
        <i className="dot" /> Virtual patient #{l.seed}
      </span>
      <div className="seg" role="group" aria-label="Medication">
        {(['off', 'on'] as const).map((m) => (
          <button key={m} aria-pressed={now.medication === m} onClick={() => l.change({ medication: m }, 'Medication ' + m.toUpperCase())}>
            Levodopa {m.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="seg" role="group" aria-label="Movement">
        <button aria-pressed={now.movement === 'rest'} disabled={!!l.protocol} onClick={() => move('rest', 'Rest')}>
          Rest
        </button>
        <button aria-pressed={now.movement === 'left'} disabled={!!l.protocol} onClick={() => move('left', 'Move left hand')}>
          Move left hand
        </button>
        <button aria-pressed={now.movement === 'right'} disabled={!!l.protocol} onClick={() => move('right', 'Move right hand')}>
          Move right hand
        </button>
      </div>
      <span className="state">Stimulation {now.stim.on ? `ON · L${now.stim.contact.L} R${now.stim.contact.R} · ${now.stim.amplitude} mA` : 'off'}</span>
      <button className="btn ghost small" onClick={l.newPatient}>
        New patient
      </button>
    </section>
  )
}

export function SensingPanel() {
  const l = useLab()
  useTick(l.signals, 400)
  const end = l.viewEnd(),
    n = Math.min(4 * FS, end - l.signals.start)
  const ecg = Float64Array.from({ length: Math.max(0, n) }, (_, i) => l.signals.at(end - n + i, LANE.ecg))
  return (
    <div className="tool">
      <h4>Sensing</h4>
      <label className="check">
        <input type="checkbox" checked={l.config.ecg} onChange={(e) => l.change({ ecg: e.target.checked }, 'ECG pickup ' + (e.target.checked ? 'on' : 'off'))} />
        Heartbeat pickup through the chest-mounted case
      </label>
      <Plot series={[{ name: 'ECG witness', y: ecg, color: C.c }]} x0={-n / FS} x1={0} xLabel="Seconds before view edge" yLabel="Heart (µV at the case)" height={120} />
    </div>
  )
}

export function SpectrumPanel({ upTo = 60 }: { upTo?: number }) {
  const l = useLab()
  useTick(l.signals, 600)
  const [win, setWin] = useState(8)
  const [max, setMax] = useState(upTo)
  const row = rowNamed(l.focus)!
  const x = l.signals.series(l.viewEnd(), win * FS, row)
  const sp = welch(x)
  const keep = sp.freqs.findIndex((f) => f > max)
  const p = peak(sp, BETA[0], BETA[1])
  const ready = x.length >= 256
  const cap = (k: 'off' | 'on') => {
    const c = l.captures[k]
    if (!c || !l.signals.has(c.start)) return null
    const r = rowNamed(c.row)!
    return { row: c.row, power: betaPower(l.signals, c.start, c.end, r), seconds: (c.end - c.start) / FS }
  }
  const off = cap('off'),
    on = cap('on')
  return (
    <div className="tool">
      <div className="tool-head">
        <h4>Spectrum · {row.name}</h4>
        <select aria-label="Analysis window" value={win} onChange={(e) => setWin(+e.target.value)}>
          {[4, 8, 16].map((v) => (
            <option key={v} value={v}>
              last {v} s
            </option>
          ))}
        </select>
        <select aria-label="Frequency range" value={max} onChange={(e) => setMax(+e.target.value)}>
          <option value={60}>1–60 Hz</option>
          <option value={125}>1–125 Hz</option>
        </select>
      </div>
      {ready ? (
        <>
          <Plot
            series={[{ name: row.name, y: sp.psd.slice(1, keep < 0 ? undefined : keep), color: C.a }]}
            x0={sp.freqs[1]}
            x1={sp.freqs[(keep < 0 ? sp.freqs.length : keep) - 1]}
            log
            bands={[{ from: BETA[0], to: BETA[1], color: 'var(--band)' }]}
            xLabel="Frequency (Hz)"
            yLabel="Power spectral density (µV²/Hz)"
          />
          <div className="readout">
            <span>
              Beta peak <b>{p.local ? p.hz.toFixed(1) + ' Hz' : 'no clear peak'}</b>
            </span>
            <span>
              Beta power 13–35 Hz <b>{bandPower(sp, BETA[0], BETA[1]).toFixed(3)} µV²</b>
            </span>
            {max > 60 && (
              <span>
                Peak 90–125 Hz <b>{(({ hz, local }) => (local ? hz.toFixed(1) + ' Hz' : 'none'))(peak(sp, 90, 125))}</b>
              </span>
            )}
          </div>
        </>
      ) : (
        <p className="note">Collecting samples…</p>
      )}
      <div className="captures">
        <button className="btn" onClick={() => l.capture('off')}>
          Capture OFF
        </button>
        <button className="btn" onClick={() => l.capture('on')}>
          Capture ON
        </button>
        <span>
          {off ? `OFF · ${off.row} · ${off.power.toFixed(3)} µV²` : 'No OFF capture'}
          {' · '}
          {on ? `ON · ${on.row} · ${on.power.toFixed(3)} µV²` : 'No ON capture'}
        </span>
      </div>
    </div>
  )
}

export function BurstPanel() {
  const l = useLab()
  useTick(l.signals, 900)
  const [fixed, setFixed] = useState(false)
  const result = captureBursts(l.signals, l.captures, fixed)
  const preview = useMemo(() => {
    if (result) return null
    const row = rowNamed(l.focus)!
    const x = l.signals.series(l.viewEnd(), 10 * FS, row)
    if (x.length < 2 * FS) return null
    return analyzeBursts(x, peak(welch(x), BETA[0], BETA[1]).hz)
  }, [result, l.focus, l.viewEnd(), l.signals])
  const shown = result?.off ?? preview
  const fmt = (r: ReturnType<typeof analyzeBursts> | null | undefined) =>
    r ? `${r.bursts.length} bursts · mean ${r.meanDurationMs.toFixed(0)} ms · ${(100 * r.fractionOfTime).toFixed(0)}% of time above threshold` : '—'
  const last = shown ? Math.min(shown.envelope.length, 5 * FS) : 0
  const offset = shown ? shown.envelope.length - last : 0
  return (
    <div className="tool">
      <div className="tool-head">
        <h4>Beta bursts</h4>
        <select aria-label="Burst threshold" value={fixed ? 'fixed' : 'own'} onChange={(e) => setFixed(e.target.value === 'fixed')}>
          <option value="own">Threshold: from each window (75th percentile)</option>
          <option value="fixed">Threshold: fixed from OFF capture</option>
        </select>
      </div>
      {shown ? (
        <>
          <Plot
            series={[
              { name: 'beta band-passed', y: shown.filtered.slice(offset), color: C.d },
              { name: 'envelope', y: shown.envelope.slice(offset), color: C.a },
              { name: 'threshold', y: new Float64Array(last).fill(shown.threshold), color: C.c, dashed: true },
            ]}
            x0={-last / FS}
            x1={0}
            bands={shown.bursts
              .filter((b) => b.end > offset)
              .map((b) => ({ from: (Math.max(b.start, offset) - offset - last) / FS, to: (b.end - offset - last) / FS, color: 'var(--band)' }))}
            xLabel={result ? 'Seconds before the end of the OFF capture' : 'Seconds before view edge'}
            yLabel="µV"
          />
          <table className="table">
            <tbody>
              {result ? (
                <>
                  <tr>
                    <th>OFF capture</th>
                    <td>{fmt(result.off)}</td>
                  </tr>
                  <tr>
                    <th>ON capture</th>
                    <td>{result.on ? fmt(result.on) : 'Capture ON from the same pair'}</td>
                  </tr>
                </>
              ) : (
                <tr>
                  <th>Live preview</th>
                  <td>{fmt(preview)}</td>
                </tr>
              )}
            </tbody>
          </table>
          <p className="note">
            Band-pass ±3 Hz around the beta peak{result ? ` (${result.centre.toFixed(1)} Hz, from the OFF capture)` : ''}, analytic
            envelope, minimum burst 100 ms. Bursts touching a window edge are not counted. This is an offline, zero-phase analysis.
          </p>
        </>
      ) : (
        <p className="note">Collecting samples…</p>
      )}
    </div>
  )
}

export function MovementPanel() {
  const l = useLab()
  useTick(l.signals, 1000)
  const [fast, setFast] = useState(true)
  const [pair, setPair] = useState('0–2')
  const bucket = l.signals.revision - (l.signals.revision % 25)
  const course = useMemo(
    () =>
      SIDES.map((side) => ({ name: side + ' ' + pair, result: movementCourse(l.signals, rowNamed(side + ' ' + pair)!) })),
    [l.signals, bucket, pair],
  )
  const ready = course.every((c) => c.result)
  return (
    <div className="tool">
      <div className="tool-head">
        <h4>Cued movement</h4>
        <select aria-label="Movement pair" value={pair} onChange={(e) => setPair(e.target.value)}>
          {['0–2', '1–3', '0–1', '1–2', '2–3'].map((p) => (
            <option key={p} value={p}>
              pair {p}
            </option>
          ))}
        </select>
      </div>
      <div className="captures">
        {l.protocol ? (
          <>
            <button className="btn" onClick={l.stopMovement}>
              Stop task
            </button>
            <span>
              Trial {Math.min(l.protocol.total, l.protocol.done + 1)} of {l.protocol.total}
            </span>
          </>
        ) : (
          <>
            <button className="btn primary" onClick={() => l.runMovement(fast, TRIALS)}>
              Run {TRIALS} right-hand trials
            </button>
            <label className="check">
              <input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} />
              Accelerate collection
            </label>
          </>
        )}
      </div>
      <p className="note">
        Each trial: 3 s rest, a move cue, 2 s of movement, then a stop cue. The envelope is computed per trial, then averaged.
      </p>
      {ready ? (
        <Plot
          series={course.map((c, i) => ({ name: c.name, y: c.result!.y, color: i ? C.b : C.a }))}
          x0={-PRE_S}
          x1={POST_S}
          vlines={[
            { at: 0, label: 'move' },
            { at: 2, label: 'stop' },
          ]}
          xLabel="Seconds from the move cue"
          yLabel={`Beta amplitude change from baseline (%) · ${course[0].result!.trials} trials`}
        />
      ) : (
        <p className="note">Run the task to build the average.</p>
      )}
    </div>
  )
}

export function StimPanel() {
  const l = useLab()
  const s = l.config.stim
  return (
    <div className="tool">
      <h4>Stimulation</h4>
      <div className="fields">
        <label className="check">
          <input type="checkbox" checked={s.on} onChange={(e) => l.change({ stim: { on: e.target.checked } }, 'Stimulation ' + (e.target.checked ? 'on' : 'off'))} />
          Stimulation on (both leads)
        </label>
        {SIDES.map((side) => (
          <label key={side}>
            {side === 'L' ? 'Left' : 'Right'} contact
            <select value={s.contact[side]} onChange={(e) => l.change({ stim: { contact: { [side]: +e.target.value } } }, `${side} stim contact ${e.target.value}`)}>
              {[0, 1, 2, 3].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        ))}
        <label>
          Amplitude <b>{s.amplitude.toFixed(1)} mA</b>
          <input type="range" min={0} max={4} step={0.5} value={s.amplitude} onChange={(e) => l.change({ stim: { amplitude: +e.target.value } })} />
        </label>
        <label>
          Frequency
          <select value={s.frequency} onChange={(e) => l.change({ stim: { frequency: +e.target.value } }, 'Stim ' + e.target.value + ' Hz')}>
            {[60, 130, 180].map((f) => (
              <option key={f} value={f}>
                {f} Hz
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="note">Teaching values only. Stimulation soft-starts over half a second. Nothing here reflects settings for a real device or patient.</p>
    </div>
  )
}
