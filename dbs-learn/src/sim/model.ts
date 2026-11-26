/**
 * Teaching model of bilateral subthalamic (STN) local field potentials recorded
 * from two four-contact DBS leads. Every sample frame holds the acquired contact
 * voltages (referenced to the implant case), a matching artifact-free neural copy,
 * and witness lanes for the heart, stimulation and the true burst state.
 *
 * This is a simplified educational model. It is not a device model and must not
 * be used to choose stimulation settings for a person.
 */

export const FS = 250
export const SIDES = ['L', 'R'] as const
export type Side = (typeof SIDES)[number]
export const CONTACTS = 4
export const NCH = 8
/** Ring contacts are 1.5 mm long with 0.5 mm gaps: 2 mm between contact centres. */
export const PITCH_MM = 2
/** Each differential sensing channel in this teaching front end saturates at ±RANGE_UV. */
export const RANGE_UV = 400
export const TAU = Math.PI * 2

export const ch = (side: Side, contact: number) => (side === 'L' ? 0 : 4) + contact
/** Height of a contact centre above contact 0, the deepest contact. */
export const contactZ = (contact: number) => contact * PITCH_MM

export const LANE = { neural: 8, ecg: 16, stimL: 17, stimR: 18, burstL: 19, burstR: 20 } as const
export const STRIDE = 21

export type Movement = 'rest' | 'left' | 'right'
export interface StimSettings {
  on: boolean
  contact: Record<Side, number>
  amplitude: number
  frequency: number
}
export interface Config {
  medication: 'off' | 'on'
  movement: Movement
  stim: StimSettings
  ecg: boolean
}
export type ConfigPatch = Partial<Omit<Config, 'stim'>> & {
  stim?: Partial<Omit<StimSettings, 'contact'>> & { contact?: Partial<Record<Side, number>> }
}
export const INITIAL: Config = {
  medication: 'off',
  movement: 'rest',
  stim: { on: false, contact: { L: 1, R: 1 }, amplitude: 2, frequency: 130 },
  ecg: true,
}
export function applyPatch(config: Config, patch: ConfigPatch): Config {
  return {
    ...config,
    ...patch,
    stim: {
      ...config.stim,
      ...patch.stim,
      contact: { ...config.stim.contact, ...patch.stim?.contact },
    },
  }
}

export interface Mark {
  sample: number
  label: string
  kind: 'action' | 'cue' | 'move'
}
export interface StateChange {
  sample: number
  config: Config
}

/** Hidden anatomy and physiology of one virtual person. */
export interface Subject {
  seed: number
  betaHz: Record<Side, number>
  /** Height (mm above contact 0) of the dorsal edge of the beta-generating motor region. */
  border: Record<Side, number>
  gain: Record<Side, number>
}

export function randomGenerator(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let v = Math.imul(s ^ (s >>> 15), 1 | s)
    v = (v + Math.imul(v ^ (v >>> 7), 61 | v)) ^ v
    return ((v ^ (v >>> 14)) >>> 0) / 4294967296
  }
}

export function makeSubject(seed: number): Subject {
  const r = randomGenerator(seed ^ 0x5eed5)
  const side = () => ({ hz: Math.round((16 + 10 * r()) * 10) / 10, border: 1.3 + 3.4 * r(), gain: 0.8 + 0.4 * r() })
  const L = side(),
    R = side()
  return {
    seed,
    betaHz: { L: L.hz, R: R.hz },
    border: { L: L.border, R: R.border },
    gain: { L: L.gain, R: R.gain },
  }
}

/** Fraction of the local beta generator seen by a contact at height z. */
export const betaWeight = (z: number, border: number) => 1 / (1 + Math.exp((z - border) / 0.6))

const lerp = (a: number, b: number, f: number) => a + (b - a) * f
const bump = (x: number, m: number, s: number) => Math.exp(-0.5 * ((x - m) / s) ** 2)

export class Generator {
  sample = 0
  config: Config
  readonly subject: Subject
  marks: Mark[] = []
  states: StateChange[] = []
  private noise: () => number
  private bursts: () => number
  private heart: () => number
  private spare: number | null = null
  private local = new Float64Array(NCH * 2)
  private shared = new Float64Array(2)
  private phase = [0, 1.7]
  private remaining = [0, 0]
  private length = [1, 1]
  private amp = [0, 0]
  private med: number
  private moveF = [1, 1]
  private rebound = [0, 0]
  private stimF = [0, 0]
  private ramp = [0, 0]
  private beat = 0.3
  private rate = 1.15

  constructor(seed = 7, config: ConfigPatch = {}) {
    this.config = applyPatch(INITIAL, config)
    this.subject = makeSubject(seed)
    this.noise = randomGenerator(seed)
    this.bursts = randomGenerator(seed ^ 0xb0b)
    this.heart = randomGenerator(seed ^ 0xec9)
    this.med = this.config.medication === 'on' ? 1 : 0
    this.states.push({ sample: 0, config: this.config })
  }

  configure(patch: ConfigPatch, label?: string) {
    const old = this.config
    this.config = applyPatch(old, patch)
    if (old.movement !== 'rest' && this.config.movement === 'rest') {
      // Post-movement beta rebound, strongest contralateral to the moving hand.
      const contra = old.movement === 'right' ? 0 : 1
      this.rebound[contra] = Math.round(1.2 * FS)
      this.rebound[1 - contra] = Math.round(0.7 * FS)
    }
    this.states.push({ sample: this.sample, config: this.config })
    if (label) this.marks.push({ sample: this.sample, label, kind: 'action' })
  }

  mark(label: string, kind: Mark['kind'] = 'cue') {
    this.marks.push({ sample: this.sample, label, kind })
  }

  private gauss() {
    if (this.spare !== null) {
      const v = this.spare
      this.spare = null
      return v
    }
    const u = Math.max(1e-12, this.noise()),
      v = this.noise()
    const r = Math.sqrt(-2 * Math.log(u))
    this.spare = r * Math.sin(TAU * v)
    return r * Math.cos(TAU * v)
  }

  block(count: number): Float32Array {
    const out = new Float32Array(count * STRIDE)
    const cfg = this.config,
      sub = this.subject
    for (let n = 0; n < count; n++, this.sample++) {
      const t = this.sample / FS,
        o = n * STRIDE
      // Levodopa effect compressed into seconds for teaching (time constant 4 s).
      this.med += ((cfg.medication === 'on' ? 1 : 0) - this.med) / (4 * FS)
      this.beat += this.rate / FS
      if (this.beat >= 1) {
        this.beat -= 1
        this.rate = 1.1 + 0.24 * (this.heart() - 0.5)
      }
      const b = this.beat
      const ecg =
        1000 *
        (bump(b, 0.2, 0.011) - 0.22 * bump(b, 0.232, 0.011) - 0.08 * bump(b, 0.17, 0.01) + 0.28 * bump(b, 0.5, 0.05))
      out[o + LANE.ecg] = ecg
      for (let si = 0; si < 2; si++) {
        const side = SIDES[si],
          border = sub.border[side]
        const contra = (cfg.movement === 'right' && side === 'L') || (cfg.movement === 'left' && side === 'R')
        let target = cfg.movement === 'rest' ? 1 : contra ? 0.25 : 0.85
        if (cfg.movement === 'rest' && this.rebound[si] > 0) {
          target = 1.45
          this.rebound[si]--
        }
        this.moveF[si] += (target - this.moveF[si]) / (0.12 * FS)
        const k = cfg.stim.contact[side],
          amp = cfg.stim.amplitude
        const want = cfg.stim.on && amp > 0 ? 1 : 0
        // Soft start: amplitude ramps over half a second.
        this.ramp[si] = Math.max(0, Math.min(1, this.ramp[si] + (want ? 1 : -1) / (0.5 * FS)))
        const reach = Math.exp(-((contactZ(k) - (border - 1)) ** 2) / (2 * 2.2 ** 2))
        const effect = this.ramp[si] * (amp / (amp + 1.5)) * reach
        this.stimF[si] += (effect - this.stimF[si]) / (0.8 * FS)
        const sf = this.stimF[si]
        const rate = lerp(1.0, 1.3, this.med) * (1 - 0.45 * sf)
        const meanDuration = lerp(0.45, 0.2, this.med) * (1 - 0.5 * sf)
        if (this.remaining[si] <= 0 && this.bursts() < rate / FS) {
          const u = Math.max(1e-9, this.bursts()),
            g = Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * this.bursts())
          this.length[si] = Math.round(Math.max(0.1, meanDuration * Math.exp(0.45 * g)) * FS)
          this.remaining[si] = this.length[si]
          this.amp[si] = 0.75 + 0.5 * this.bursts()
        }
        let envelope = lerp(0.2, 0.1, this.med),
          inBurst = 0
        if (this.remaining[si] > 0) {
          const u = 1 - this.remaining[si] / this.length[si]
          envelope += this.amp[si] * Math.sin(Math.PI * u) ** 2
          this.remaining[si]--
          inBurst = 1
        }
        const level = sub.gain[side] * this.moveF[si] * (1 - 0.8 * sf) * lerp(1, 0.95, this.med)
        this.phase[si] += (TAU * (sub.betaHz[side] + 0.8 * Math.sin(0.27 * t + 1.3 * si))) / FS
        const beta = 3.6 * level * envelope * Math.sin(this.phase[si])
        const far = (this.shared[si] = 0.995 * this.shared[si] + 0.42 * this.gauss())
        const stimAmp = 250 * amp * this.ramp[si]
        const f = cfg.stim.frequency
        // The artifact after the analog anti-alias stage: the fundamental plus a weak harmonic.
        const wave = stimAmp ? Math.sin(TAU * f * t + 0.4) + 0.12 * Math.sin(2 * TAU * f * t + 1.1) : 0
        for (let c = 0; c < CONTACTS; c++) {
          const i = si * 4 + c
          const slow = (this.local[2 * i] = 0.97 * this.local[2 * i] + 0.2 * this.gauss())
          const fast = (this.local[2 * i + 1] = 0.5 * this.local[2 * i + 1] + 0.45 * this.gauss())
          const neural = betaWeight(contactZ(c), border) * beta + far + slow + fast
          // The implant case is the reference and sits in the chest, so the heart is a shared input.
          const cardiac = cfg.ecg ? ecg * 0.025 * (1 + 0.018 * c) * (si ? 0.8 : 1) : 0
          let artifact = 0
          if (stimAmp) {
            const d = Math.abs(contactZ(c) - contactZ(k))
            // Slight tissue asymmetry keeps the flanking-pair residual small but non-zero.
            artifact = ((stimAmp * (c > k ? 1.03 : 1)) / (1 + d / 0.75)) * wave
          }
          out[o + i] = neural + cardiac + artifact
          out[o + LANE.neural + i] = neural
        }
        out[o + (si ? LANE.burstR : LANE.burstL)] = inBurst
        out[o + (si ? LANE.stimR : LANE.stimL)] = this.ramp[si] * amp
      }
    }
    return out
  }
}
