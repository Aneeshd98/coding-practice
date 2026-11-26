import { useMemo, useState, type ReactNode } from 'react'
import { AudioWaveform, Camera, Gauge, Hand, HeartPulse, Minus, Plus, SlidersVertical, Pill, RefreshCw, Sparkles, Timer, UserRound, Waves, Zap } from 'lucide-react'
import { useLab, useTick } from '../app/lab'
import { FS, LANE, SIDES, type Movement } from '../sim/model'
import { rowNamed } from '../dsp/store'
import { BETA, bandPower, peak, prominent, welch } from '../dsp/spectrum'
import { analyzeBursts } from '../dsp/bursts'
import { POST_S, PRE_S, movementCourse } from '../dsp/movement'
import { TEST_MAX, response } from '../sim/field'
import { ADAPTIVE_BETA, ADAPTIVE_ENERGY, betaPower, captureBursts, meanDelivered } from '../course/practicals'
import { Chart } from './Chart'

export const TRIALS = 12
const color = { beta: 'var(--beta)', sense: 'var(--sense)', primary: 'var(--primary)', stim: 'var(--stim)', muted: 'var(--muted)' }

function heartRate(l: ReturnType<typeof useLab>) {
  const end = l.viewEnd(),
    n = Math.min(6 * FS, end - l.signals.start)
  const beats: number[] = []
  for (let i = end - n + 1; i < end - 1; i++) {
    const v = l.signals.at(i, LANE.ecg)
    if (v > 600 && v >= l.signals.at(i - 1, LANE.ecg) && v > l.signals.at(i + 1, LANE.ecg)) beats.push(i)
  }
  if (beats.length < 2) return null
  return Math.round((60 * FS * (beats.length - 1)) / (beats.at(-1)! - beats[0]))
}

export function PatientBar() {
  const l = useLab()
  useTick(l.signals, 500)
  // Settings the learner chose show immediately; movement can also change from the cued task, so it follows the recording.
  const delivered = l.signals.configAt(l.signals.end - 1)
  const now = { ...l.config, movement: delivered.movement }
  const bpm = heartRate(l)
  return (
    <section className="patient" aria-label="Virtual patient">
      <div className="patient-id">
        <span className="avatar">
          <UserRound size={18} />
        </span>
        <span>
          <b>Virtual patient #{l.seed}</b>
          <small>Bilateral STN · 4-contact leads</small>
        </span>
      </div>
      <div className="control">
        <span className="control-label">
          <Pill size={14} /> Levodopa
        </span>
        <div className="seg" role="group" aria-label="Medication">
          {(['off', 'on'] as const).map((m) => (
            <button key={m} aria-pressed={now.medication === m} onClick={() => l.change({ medication: m }, 'Medication ' + m.toUpperCase())}>
              {m.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div className="control">
        <span className="control-label">
          <Hand size={14} /> Movement
        </span>
        <div className="seg" role="group" aria-label="Movement">
          {(
            [
              ['rest', 'Rest'],
              ['left', 'Left hand'],
              ['right', 'Right hand'],
            ] as [Movement, string][]
          ).map(([m, label]) => (
            <button key={m} aria-pressed={now.movement === m} disabled={!!l.protocol} onClick={() => l.change({ movement: m }, m === 'rest' ? 'Rest' : 'Move ' + label.toLowerCase())}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <span className={'status-chip' + (now.stim.on ? ' stim' : '')}>
        <Zap size={13} />
        {!now.stim.on ? 'Stimulation off' : now.adaptive.on ? `Adaptive · up to ${now.adaptive.max} mA` : `Stim ${now.stim.amplitude.toFixed(1)} mA · ${now.stim.frequency} Hz`}
      </span>
      {bpm && (
        <span className="status-chip heart" title="Heart rate from the ECG witness">
          <HeartPulse size={13} /> {bpm} bpm
        </span>
      )}
      <span className="spacer" />
      <button className="btn ghost" onClick={l.newPatient}>
        <RefreshCw size={14} /> New patient
      </button>
    </section>
  )
}

function ToolHead({ icon, tone, title, children }: { icon: ReactNode; tone?: string; title: string; children?: ReactNode }) {
  return (
    <div className="tool-head">
      <h4>
        <span className={'icon-tile ' + (tone ?? '')}>{icon}</span>
        {title}
      </h4>
      {children}
    </div>
  )
}

export function SensingPanel() {
  const l = useLab()
  useTick(l.signals, 400)
  const end = l.viewEnd(),
    n = Math.min(4 * FS, end - l.signals.start)
  const ecg = Float64Array.from({ length: Math.max(0, n) }, (_, i) => l.signals.at(end - n + i, LANE.ecg))
  const row = rowNamed(l.focus)!
  const rms = (clean: boolean) => {
    const x = l.signals.series(end, 2 * FS, row, clean)
    return Math.sqrt(x.reduce((s, v) => s + v * v, 0) / Math.max(1, x.length))
  }
  return (
    <div className="tool">
      <ToolHead icon={<HeartPulse size={15} />} tone="beta" title="Sensing and the heartbeat">
        <label className="check">
          <input type="checkbox" checked={l.config.ecg} onChange={(e) => l.change({ ecg: e.target.checked }, 'ECG pickup ' + (e.target.checked ? 'on' : 'off'))} />
          Cardiac pickup through the case
        </label>
      </ToolHead>
      <div className="tool-body">
        <Chart series={[{ name: 'ECG witness', y: ecg, color: color.beta, width: 1.4 }]} x0={-n / FS} x1={0} xLabel="Seconds before the view edge" yLabel="Heart at the implant case (µV)" height={150} unit=" s" />
        <div className="metrics">
          <div className="metric">
            <small>{row.name} · RMS</small>
            <b>
              {rms(false).toFixed(1)}
              <em>µV</em>
            </b>
          </div>
          <div className="metric">
            <small>Same, artifact-free</small>
            <b>
              {rms(true).toFixed(1)}
              <em>µV</em>
            </b>
          </div>
        </div>
        <p className="note">Compare a monopolar contact with a bipolar pair: whatever both contacts share cancels in the pair.</p>
      </div>
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
  const last = keep < 0 ? sp.freqs.length : keep
  const raw = peak(sp, BETA[0], BETA[1])
  const p = { ...raw, local: prominent(sp, raw, BETA[0], BETA[1]) }
  const aliasRaw = peak(sp, 90, 125)
  const alias = { ...aliasRaw, local: prominent(sp, aliasRaw, 90, 125) }
  const ready = x.length >= 256
  const cap = (k: 'off' | 'on') => {
    const c = l.captures[k]
    if (!c || !l.signals.has(c.start)) return null
    return { row: c.row, power: betaPower(l.signals, c.start, c.end, rowNamed(c.row)!) }
  }
  const off = cap('off'),
    on = cap('on')
  const markers = []
  if (ready && p.local) markers.push({ x: p.hz, y: p.value, label: `β peak ${p.hz.toFixed(1)} Hz`, color: color.beta })
  if (ready && max > 60 && alias.local) markers.push({ x: alias.hz, y: alias.value, label: `${alias.hz.toFixed(1)} Hz`, color: color.stim })
  return (
    <div className="tool">
      <ToolHead icon={<AudioWaveform size={15} />} tone="beta" title={`Power spectrum · ${row.name}`}>
        <select aria-label="Analysis window" value={win} onChange={(e) => setWin(+e.target.value)}>
          {[4, 8, 16].map((v) => (
            <option key={v} value={v}>
              Last {v} s
            </option>
          ))}
        </select>
        <select aria-label="Frequency range" value={max} onChange={(e) => setMax(+e.target.value)}>
          <option value={60}>1–60 Hz</option>
          <option value={125}>1–125 Hz</option>
        </select>
      </ToolHead>
      <div className="tool-body">
        {ready ? (
          <>
            <Chart
              series={[{ name: row.name, y: sp.psd.slice(1, last), color: color.primary, fill: true }]}
              x0={sp.freqs[1]}
              x1={sp.freqs[last - 1]}
              log
              bands={[{ from: BETA[0], to: BETA[1], color: 'color-mix(in srgb, var(--beta) 10%, transparent)', label: 'β 13–35 Hz', labelColor: 'var(--beta)' }]}
              markers={markers}
              xLabel="Frequency (Hz)"
              yLabel="Power spectral density (µV²/Hz)"
            />
            <div className="metrics">
              <div className="metric beta">
                <small>Beta peak</small>
                <b>
                  {p.local ? p.hz.toFixed(1) : '—'}
                  <em>{p.local ? 'Hz' : 'no clear peak'}</em>
                </b>
              </div>
              <div className="metric beta">
                <small>Beta power 13–35 Hz</small>
                <b>
                  {bandPower(sp, BETA[0], BETA[1]).toFixed(3)}
                  <em>µV²</em>
                </b>
              </div>
              {max > 60 && (
                <div className="metric stim">
                  <small>Peak 90–125 Hz</small>
                  <b>
                    {alias.local ? alias.hz.toFixed(1) : '—'}
                    <em>{alias.local ? 'Hz' : 'none'}</em>
                  </b>
                </div>
              )}
            </div>
          </>
        ) : (
          <p className="note">Collecting samples…</p>
        )}
        <div className="captures">
          <button className="btn" onClick={() => l.capture('off')}>
            <Camera size={14} /> Capture OFF
          </button>
          <button className="btn" onClick={() => l.capture('on')}>
            <Camera size={14} /> Capture ON
          </button>
          <span className={'capture' + (off ? ' has' : '')}>
            OFF{' '}
            {off ? (
              <>
                · {off.row} · <b>{off.power.toFixed(3)} µV²</b>
              </>
            ) : (
              '· not captured'
            )}
          </span>
          <span className={'capture' + (on ? ' has' : '')}>
            ON{' '}
            {on ? (
              <>
                · {on.row} · <b>{on.power.toFixed(3)} µV²</b>
              </>
            ) : (
              '· not captured'
            )}
          </span>
        </div>
      </div>
    </div>
  )
}

export function BurstPanel() {
  const l = useLab()
  useTick(l.signals, 900)
  const [fixed, setFixed] = useState(false)
  const result = captureBursts(l.signals, l.captures, fixed)
  const end = l.viewEnd()
  const preview = useMemo(() => {
    if (result) return null
    const x = l.signals.series(end, 10 * FS, rowNamed(l.focus)!)
    if (x.length < 2 * FS) return null
    return analyzeBursts(x, peak(welch(x), BETA[0], BETA[1]).hz)
  }, [result, l.focus, end, l.signals])
  const shown = result?.off ?? preview
  const last = shown ? Math.min(shown.envelope.length, 6 * FS) : 0
  const offset = shown ? shown.envelope.length - last : 0
  const stats = (r: ReturnType<typeof analyzeBursts> | null | undefined) =>
    r ? [String(r.bursts.length), r.meanDurationMs.toFixed(0) + ' ms', (100 * r.fractionOfTime).toFixed(0) + '%'] : ['—', '—', '—']
  return (
    <div className="tool">
      <ToolHead icon={<Waves size={15} />} tone="beta" title="Beta bursts">
        <select aria-label="Burst threshold" value={fixed ? 'fixed' : 'own'} onChange={(e) => setFixed(e.target.value === 'fixed')}>
          <option value="own">Threshold: each window’s 75th percentile</option>
          <option value="fixed">Threshold: fixed from OFF capture</option>
        </select>
      </ToolHead>
      <div className="tool-body">
        {shown ? (
          <>
            <Chart
              series={[
                { name: 'β band-passed', y: shown.filtered.slice(offset), color: 'color-mix(in srgb, var(--muted) 55%, transparent)', width: 1 },
                { name: 'envelope', y: shown.envelope.slice(offset), color: color.beta, width: 2 },
                { name: 'threshold', y: new Float64Array(last).fill(shown.threshold), color: color.stim, dashed: true, width: 1.4 },
              ]}
              x0={-last / FS}
              x1={0}
              zero
              bands={shown.bursts
                .filter((b) => b.end > offset)
                .map((b) => ({ from: (Math.max(b.start, offset) - offset - last) / FS, to: (b.end - offset - last) / FS, color: 'color-mix(in srgb, var(--beta) 12%, transparent)' }))}
              xLabel={result ? 'Seconds before the end of the OFF capture' : 'Seconds before the view edge'}
              yLabel="Beta amplitude (µV)"
              unit=" s"
            />
            <table className="table">
              <thead>
                <tr>
                  <th>Window</th>
                  <th>Bursts</th>
                  <th>Mean duration</th>
                  <th>Above threshold</th>
                </tr>
              </thead>
              <tbody>
                {result ? (
                  <>
                    <tr>
                      <th>OFF capture</th>
                      {stats(result.off).map((v, i) => (
                        <td key={i}>{v}</td>
                      ))}
                    </tr>
                    <tr>
                      <th>ON capture</th>
                      {result.on ? stats(result.on).map((v, i) => <td key={i}>{v}</td>) : <td colSpan={3}>Capture ON from the same pair</td>}
                    </tr>
                  </>
                ) : (
                  <tr>
                    <th>Live · last 10 s</th>
                    {stats(preview).map((v, i) => (
                      <td key={i}>{v}</td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
            <p className="note">
              Band-pass ±3 Hz around the beta peak{result ? ` (${result.centre.toFixed(1)} Hz, from the OFF capture)` : ''}, analytic envelope, bursts ≥ 100 ms. Bursts touching an
              edge of the window are not counted. Offline, zero-phase analysis.
            </p>
          </>
        ) : (
          <p className="note">Collecting samples…</p>
        )}
      </div>
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
    () => SIDES.map((side) => ({ name: side + ' ' + pair, result: movementCourse(l.signals, rowNamed(side + ' ' + pair)!) })),
    [l.signals, bucket, pair],
  )
  const ready = course.every((c) => c.result)
  return (
    <div className="tool">
      <ToolHead icon={<Hand size={15} />} title="Cued movement">
        <select aria-label="Movement pair" value={pair} onChange={(e) => setPair(e.target.value)}>
          {['0–2', '1–3', '0–1', '1–2', '2–3'].map((p) => (
            <option key={p} value={p}>
              Pair {p}
            </option>
          ))}
        </select>
      </ToolHead>
      <div className="tool-body">
        <div className="captures" style={{ marginTop: 0 }}>
          {l.protocol ? (
            <>
              <button className="btn" onClick={l.stopMovement}>
                Stop task
              </button>
              <span className="capture has">
                <Timer size={14} /> Trial <b>{Math.min(l.protocol.total, l.protocol.done + 1)}</b> of {l.protocol.total}
              </span>
            </>
          ) : (
            <>
              <button className="btn primary" onClick={() => l.runMovement(fast, TRIALS)}>
                <Sparkles size={14} /> Run {TRIALS} right-hand trials
              </button>
              <label className="check">
                <input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} />
                Accelerate collection
              </label>
            </>
          )}
        </div>
        {ready ? (
          <Chart
            series={course.map((c, i) => ({ name: c.name, y: c.result!.y, color: i ? color.primary : color.beta, width: 2 }))}
            x0={-PRE_S}
            x1={POST_S}
            zero
            bands={[{ from: 0, to: 2, color: 'color-mix(in srgb, var(--primary) 7%, transparent)', label: 'moving', labelColor: 'var(--primary)' }]}
            vlines={[
              { at: 0, label: 'move cue' },
              { at: 2, label: 'stop cue' },
            ]}
            xLabel="Seconds from the move cue"
            yLabel={`Beta amplitude change from baseline (%) · ${course[0].result!.trials} trials`}
            unit=" s"
          />
        ) : (
          <p className="note">Run the task to build the cue-locked average.</p>
        )}
        <p className="note">Each trial: 3 s rest, a move cue, 2 s of right-hand movement, a stop cue. Envelopes are computed per trial, then averaged.</p>
      </div>
    </div>
  )
}

export function StimPanel() {
  const l = useLab()
  const s = l.config.stim
  return (
    <div className="tool">
      <ToolHead icon={<Zap size={15} />} tone="stim" title="Stimulation">
        <label className="switch">
          <input type="checkbox" role="switch" checked={s.on} aria-label="Stimulation on" onChange={(e) => l.change({ stim: { on: e.target.checked } }, 'Stimulation ' + (e.target.checked ? 'on' : 'off'))} />
          <span className="track" />
          {s.on ? 'On' : 'Off'}
        </label>
      </ToolHead>
      <div className="tool-body">
        <div className="fields">
          {SIDES.map((side) => (
            <label key={side}>
              {side === 'L' ? 'Left' : 'Right'} contact
              <select
                aria-label={(side === 'L' ? 'Left' : 'Right') + ' contact'}
                value={s.contact[side]}
                onChange={(e) => l.change({ stim: { contact: { [side]: +e.target.value } } }, `${side} stim contact ${e.target.value}`)}
              >
                {[0, 1, 2, 3].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          ))}
          <label>
            Amplitude <b>{s.amplitude.toFixed(1)} mA</b>
            <input type="range" min={0} max={4} step={0.5} value={s.amplitude} aria-label="Amplitude" onChange={(e) => l.change({ stim: { amplitude: +e.target.value } })} />
          </label>
          <label>
            Frequency
            <select aria-label="Frequency" value={s.frequency} onChange={(e) => l.change({ stim: { frequency: +e.target.value } }, 'Stim ' + e.target.value + ' Hz')}>
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
    </div>
  )
}

export function AdaptivePanel() {
  const l = useLab()
  useTick(l.signals, 500)
  const a = l.config.adaptive,
    k = l.config.stim.contact.L
  const pair = k >= 1 && k <= 2 ? `${k - 1}–${k + 1}` : k === 0 ? '0–1 (contains the stimulating contact)' : '2–3 (contains the stimulating contact)'
  const end = l.viewEnd(),
    n = Math.max(0, Math.min(15 * FS, end - l.signals.start))
  const lane = (id: number) => Float64Array.from({ length: n }, (_, i) => l.signals.at(end - n + i, id))
  const estimate = lane(LANE.senseL),
    amplitude = lane(LANE.stimL)
  const win = Math.min(20 * FS, end - l.signals.start)
  const mean = meanDelivered(l.signals, end - win, end)
  let active = 0
  for (let i = end - win; i < end; i++) if (l.signals.at(i, LANE.stimL) > 0.1) active++
  const row = rowNamed('L 0–2')!
  const beta = win > 2 * FS ? betaPower(l.signals, end - win, end, row) : NaN
  const off = l.captures.off && l.signals.has(l.captures.off.start) ? betaPower(l.signals, l.captures.off.start, l.captures.off.end, row) : null
  const ratio = off ? beta / off : null
  const set = (patch: Partial<typeof a>, label?: string) => l.change({ adaptive: patch }, label)
  return (
    <div className="tool">
      <ToolHead icon={<Gauge size={15} />} tone="stim" title="Adaptive DBS · left">
        <label className="switch">
          <input
            type="checkbox"
            role="switch"
            aria-label="Adaptive stimulation"
            checked={a.on && l.config.stim.on}
            onChange={(e) => l.change({ adaptive: { on: e.target.checked }, ...(e.target.checked ? { stim: { on: true } } : {}) }, 'Adaptive DBS ' + (e.target.checked ? 'on' : 'off'))}
          />
          <span className="track" />
          {a.on && l.config.stim.on ? 'Adaptive' : 'Off'}
        </label>
      </ToolHead>
      <div className="tool-body">
        <div className="fields">
          <label>
            Sensing centre <b>{a.centre} Hz</b>
            <input type="range" min={13} max={35} step={0.5} value={a.centre} aria-label="Sensing centre" onChange={(e) => set({ centre: +e.target.value })} />
          </label>
          <label>
            Threshold <b>{a.threshold.toFixed(2)} µV</b>
            <input type="range" min={0.2} max={2.5} step={0.05} value={a.threshold} aria-label="Threshold" onChange={(e) => set({ threshold: +e.target.value })} />
          </label>
          <label>
            Ramp
            <select aria-label="Ramp" value={a.ramp} onChange={(e) => set({ ramp: +e.target.value }, 'Ramp ' + e.target.value + ' mA/s')}>
              {[1.5, 3, 6, 12].map((v) => (
                <option key={v} value={v}>
                  {v} mA/s
                </option>
              ))}
            </select>
          </label>
          <label>
            Smoothing
            <select aria-label="Smoothing" value={a.smoothing} onChange={(e) => set({ smoothing: +e.target.value }, 'Smoothing ' + e.target.value + ' s')}>
              {[0.1, 0.25, 0.5, 1, 2].map((v) => (
                <option key={v} value={v}>
                  {v} s
                </option>
              ))}
            </select>
          </label>
          <label>
            Maximum
            <select aria-label="Maximum amplitude" value={a.max} onChange={(e) => set({ max: +e.target.value }, 'Adaptive maximum ' + e.target.value + ' mA')}>
              {[1.5, 2, 2.5, 3, 3.5, 4].map((v) => (
                <option key={v} value={v}>
                  {v} mA
                </option>
              ))}
            </select>
          </label>
        </div>
        <Chart
          series={[
            { name: 'sensed beta', y: estimate, color: color.beta, width: 1.6 },
            { name: 'threshold', y: new Float64Array(n).fill(a.threshold), color: color.stim, dashed: true, width: 1.3 },
          ]}
          x0={-n / FS}
          x1={0}
          zero
          xLabel="Seconds before the view edge"
          yLabel={`Controller estimate from L ${pair} (µV)`}
          height={150}
          unit=" s"
        />
        <Chart
          series={[{ name: 'delivered amplitude', y: amplitude, color: color.stim, fill: true, width: 1.6 }]}
          x0={-n / FS}
          x1={0}
          yRange={[0, Math.max(a.max, l.config.stim.amplitude) + 0.2]}
          xLabel="Seconds before the view edge"
          yLabel="Left stimulation amplitude (mA)"
          height={130}
          unit=" s"
        />
        <div className="metrics">
          <div className="metric stim">
            <small>Mean amplitude · 20 s</small>
            <b>
              {mean.toFixed(2)}
              <em>mA · {a.max ? ((mean / a.max) * 100).toFixed(0) : 0}% of max</em>
            </b>
          </div>
          <div className="metric stim">
            <small>Time stimulating</small>
            <b>
              {win ? ((100 * active) / win).toFixed(0) : '—'}
              <em>%</em>
            </b>
          </div>
          <div className="metric beta">
            <small>L 0–2 beta vs OFF capture</small>
            <b>
              {ratio === null ? '—' : (ratio * 100).toFixed(0)}
              <em>{ratio === null ? 'capture OFF first' : '% of OFF'}</em>
            </b>
          </div>
        </div>
        <p className="note">
          Single-threshold controller on the left lead (stimulating contact {k}): band-pass ±3 Hz around the centre, rectify, smooth, then ramp up above threshold and down below it.
          Practical goal: beta ≤ {ADAPTIVE_BETA * 100}% of OFF with mean amplitude ≤ {ADAPTIVE_ENERGY * 100}% of maximum.
        </p>
      </div>
    </div>
  )
}

export function ReviewPanel() {
  const l = useLab()
  const s = l.config.stim
  const contact = s.contact.L,
    mA = s.on ? s.amplitude : 0,
    pw = s.pulseWidth
  const r = l.subject ? response(l.subject, 'L', contact, mA, pw) : null
  const test = (patch: { contact?: number; amplitude?: number; pulseWidth?: number }) =>
    l.change({ stim: { on: true, ...(patch.contact !== undefined ? { contact: { L: patch.contact } } : {}), ...(patch.amplitude !== undefined ? { amplitude: patch.amplitude } : {}), ...(patch.pulseWidth ? { pulseWidth: patch.pulseWidth } : {}) } })
  const step = (d: number) => test({ amplitude: Math.max(0, Math.min(TEST_MAX, Math.round((mA + d) * 10) / 10)) })
  const record = (key: 'benefit' | 'side', value: number | null) =>
    l.setReview({ ...l.review, [contact]: { ...l.review[contact], pulseWidth: pw, [key]: value } })
  const fmt = (v: number | null | undefined) => (v === undefined ? '—' : v === null ? 'none' : v.toFixed(1) + ' mA')
  const windowOf = (e?: { benefit?: number | null; side?: number | null }) =>
    !e || e.benefit === undefined || e.side === undefined ? '—' : e.benefit === null ? 'no benefit' : ((e.side ?? TEST_MAX) - e.benefit).toFixed(1) + ' mA'
  return (
    <div className="tool">
      <ToolHead icon={<SlidersVertical size={15} />} tone="stim" title="Monopolar review · left lead">
        <label className="select">
          Pulse width
          <select aria-label="Pulse width" value={pw} onChange={(e) => test({ pulseWidth: +e.target.value })}>
            {[30, 60, 90].map((v) => (
              <option key={v} value={v}>
                {v} µs
              </option>
            ))}
          </select>
        </label>
      </ToolHead>
      <div className="tool-body">
        <div className="fields">
          <div className="seg" role="group" aria-label="Contact under test">
            {[0, 1, 2, 3].map((c) => (
              <button key={c} aria-pressed={contact === c} onClick={() => test({ contact: c, amplitude: 0 })}>
                Contact {c}
              </button>
            ))}
          </div>
          <div className="stepper">
            <button className="icon-btn" aria-label="Decrease amplitude" onClick={() => step(-0.1)}>
              <Minus size={15} />
            </button>
            <output aria-live="polite">{mA.toFixed(1)} mA</output>
            <button className="icon-btn" aria-label="Increase amplitude" onClick={() => step(0.1)}>
              <Plus size={15} />
            </button>
            <button className="btn ghost" onClick={() => step(0.5)}>
              +0.5
            </button>
          </div>
        </div>
        {r && (
          <div className="exam">
            <div className="exam-row">
              <span>Rigidity relief</span>
              <div className="bar wide">
                <i style={{ width: r.benefit * 100 + '%', background: r.benefit >= 0.5 ? 'var(--ok)' : 'var(--primary)' }} />
              </div>
              <b>{Math.round(r.benefit * 100)}%</b>
            </div>
            <div className="exam-row">
              <span>Side effects</span>
              <b className={r.effects.length ? 'warn' : ''}>{r.effects.length ? r.effects.map((e) => e.effect).join(' · ') : 'None observed'}</b>
            </div>
            <div className="exam-row">
              <span>Field radius</span>
              <b>{r.radius.toFixed(1)} mm</b>
            </div>
          </div>
        )}
        <div className="captures">
          <button className="btn" onClick={() => record('benefit', mA)}>
            Record benefit threshold · {mA.toFixed(1)} mA
          </button>
          <button className="btn" onClick={() => record('benefit', null)}>
            No benefit before side effects
          </button>
          <button className="btn" onClick={() => record('side', mA)}>
            Record side-effect threshold · {mA.toFixed(1)} mA
          </button>
          <button className="btn" onClick={() => record('side', null)}>
            No side effect by {TEST_MAX} mA
          </button>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Contact</th>
              <th>Benefit threshold</th>
              <th>Side-effect threshold</th>
              <th>Window</th>
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2, 3].map((c) => (
              <tr key={c} className={c === contact ? 'current' : ''}>
                <th>
                  {c}
                  {l.review[c] && l.review[c].pulseWidth !== 60 ? ` · ${l.review[c].pulseWidth} µs` : ''}
                </th>
                <td>{fmt(l.review[c]?.benefit)}</td>
                <td>{fmt(l.review[c]?.side)}</td>
                <td>{windowOf(l.review[c])}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="note">
          Benefit means at least 50% rigidity relief. Testing stops at {TEST_MAX} mA. Use the brain model in Target view to see the field and any pathway it reaches. Teaching model only: thresholds come from a schematic field, not a validated volume-of-tissue-activated model.
        </p>
      </div>
    </div>
  )
}
