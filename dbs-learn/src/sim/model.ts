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

/**
 * Witness lanes: the heart, delivered stimulation (mA), true burst state, the true beta envelope,
 * and the adaptive controller's own beta estimate (µV).
 */
export const LANE = { neural: 8, ecg: 16, stimL: 17, stimR: 18, burstL: 19, burstR: 20, betaL: 21, betaR: 22, senseL: 23, senseR: 24 } as const
export const STRIDE = 25

export type Movement = 'rest' | 'left' | 'right'
export interface StimSettings {
  on: boolean
  contact: Record<Side, number>
  amplitude: number
  frequency: number
  /** Pulse width (µs). */
  pulseWidth: number
}
/** Single-threshold adaptive DBS: amplitude ramps up while sensed beta exceeds the threshold. */
export interface AdaptiveSettings {
  on: boolean
  /** Centre of the ±3 Hz sensing band (Hz). */
  centre: number
  /** Beta amplitude threshold (µV). */
  threshold: number
  /** Ramp speed (mA per second). */
  ramp: number
  /** Time constant of the smoothed beta estimate (s). */
  smoothing: number
  min: number
  max: number
}
export interface Config {
  medication: 'off' | 'on'
  movement: Movement
  stim: StimSettings
  adaptive: AdaptiveSettings
  ecg: boolean
  /** Peak-dose dyskinesia; only expressed while levodopa is ON. */
  dyskinesia: boolean
}
export type ConfigPatch = Partial<Omit<Config, 'stim' | 'adaptive'>> & {
  stim?: Partial<Omit<StimSettings, 'contact'>> & { contact?: Partial<Record<Side, number>> }
  adaptive?: Partial<AdaptiveSettings>
}
export const INITIAL: Config = {
  medication: 'off',
  movement: 'rest',
  stim: { on: false, contact: { L: 1, R: 1 }, amplitude: 2, frequency: 130, pulseWidth: 60 },
  adaptive: { on: false, centre: 20, threshold: 1.0, ramp: 6, smoothing: 0.25, min: 0, max: 3 },
  ecg: true,
  dyskinesia: false,
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
    adaptive: { ...config.adaptive, ...patch.adaptive },
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
  /** Frequency of dyskinesia-related narrowband gamma (Hz). */
  gammaHz: Record<Side, number>
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
  // Properties added later draw from their own stream so existing patients keep their values.
  const extra = randomGenerator(seed ^ 0x6a33a)
  return {
    seed,
    betaHz: { L: L.hz, R: R.hz },
    border: { L: L.border, R: R.border },
    gain: { L: L.gain, R: R.gain },
    gammaHz: { L: Math.round((66 + 16 * extra()) * 10) / 10, R: Math.round((66 + 16 * extra()) * 10) / 10 },
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
  private dysk = 0
  private gammaPhase = [0.3, 2.1]
  private moveF = [1, 1]
  private rebound = [0, 0]
  private stimF = [0, 0]
  private ramp = [0, 0]
  private beat = 0.3
  private rate = 1.15
  /** Adaptive controller state per side: delivered amplitude, band-pass memory, smoothed estimate. */
  private adaptAmp = [0, 0]
  private bp = new Float64Array(8)
  private estimate = [0, 0]

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
      this.dysk += ((cfg.dyskinesia ? this.med : 0) - this.dysk) / (2 * FS)
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
        const k = cfg.stim.contact[side]
        const adaptive = cfg.adaptive.on && cfg.stim.on
        const amp = adaptive ? this.adaptAmp[si] : cfg.stim.amplitude
        const want = cfg.stim.on && (adaptive || amp > 0) ? 1 : 0
        // Soft start: amplitude ramps over half a second.
        this.ramp[si] = Math.max(0, Math.min(1, this.ramp[si] + (want ? 1 : -1) / (0.5 * FS)))
        const reach = Math.exp(-((contactZ(k) - (border - 1)) ** 2) / (2 * 2.2 ** 2))
        // Charge per pulse matters: express the amplitude as its 60 µs equivalent (strength–duration, chronaxie 40 µs).
        const pw = cfg.stim.pulseWidth || 60
        const equivalent = (amp * (1 + 40 / 60)) / (1 + 40 / pw)
        const effect = this.ramp[si] * (equivalent / (equivalent + 1.5)) * reach
        // Suppression builds within a few hundred milliseconds and outlasts the stimulation by about a second.
        this.stimF[si] += (effect - this.stimF[si]) / ((effect > this.stimF[si] ? 0.25 : 1.2) * FS)
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
        // Narrowband gamma with dyskinesia; under stimulation it entrains to half the stimulation frequency.
        const half = cfg.stim.frequency / 2
        const entrained = this.ramp[si] > 0.5 && half >= 55 && half <= 95
        this.gammaPhase[si] += (TAU * (entrained ? half : sub.gammaHz[side] + 0.6 * Math.sin(0.19 * t + si))) / FS
        const gamma = 1.6 * this.dysk * Math.sin(this.gammaPhase[si])
        const far = (this.shared[si] = 0.995 * this.shared[si] + 0.42 * this.gauss())
        const stimAmp = 250 * amp * this.ramp[si]
        const f = cfg.stim.frequency
        // The artifact after the analog anti-alias stage: the fundamental plus a weak harmonic.
        const wave = stimAmp ? Math.sin(TAU * f * t + 0.4) + 0.12 * Math.sin(2 * TAU * f * t + 1.1) : 0
        const acquired = [0, 0, 0, 0]
        for (let c = 0; c < CONTACTS; c++) {
          const i = si * 4 + c
          const slow = (this.local[2 * i] = 0.97 * this.local[2 * i] + 0.2 * this.gauss())
          const fast = (this.local[2 * i + 1] = 0.5 * this.local[2 * i + 1] + 0.45 * this.gauss())
          const neural = betaWeight(contactZ(c), border) * (beta + gamma) + far + slow + fast
          // The implant case is the reference and sits in the chest, so the heart is a shared input.
          const cardiac = cfg.ecg ? ecg * 0.025 * (1 + 0.018 * c) * (si ? 0.8 : 1) : 0
          let artifact = 0
          if (stimAmp) {
            const d = Math.abs(contactZ(c) - contactZ(k))
            // Slight tissue asymmetry keeps the flanking-pair residual small but non-zero.
            artifact = ((stimAmp * (c > k ? 1.03 : 1)) / (1 + d / 0.75)) * wave
          }
          out[o + i] = acquired[c] = neural + cardiac + artifact
          out[o + LANE.neural + i] = neural
        }
        // The controller senses the pair flanking the stimulating contact; without one it must use a pair that contains it.
        const [a, b] = k >= 1 && k <= 2 ? [k - 1, k + 1] : k === 0 ? [0, 1] : [2, 3]
        const sensed = Math.max(-RANGE_UV, Math.min(RANGE_UV, acquired[a] - acquired[b]))
        const ad = cfg.adaptive
        const w = (TAU * ad.centre) / FS,
          alpha = Math.sin(w) / (2 * (ad.centre / 6)),
          a0 = 1 + alpha
        const m = si * 4,
          y = (alpha / a0) * sensed - (alpha / a0) * this.bp[m + 1] + ((2 * Math.cos(w)) / a0) * this.bp[m + 2] - ((1 - alpha) / a0) * this.bp[m + 3]
        this.bp[m + 1] = this.bp[m]
        this.bp[m] = sensed
        this.bp[m + 3] = this.bp[m + 2]
        this.bp[m + 2] = y
        this.estimate[si] += ((Math.abs(y) * Math.PI) / 2 - this.estimate[si]) / Math.max(1, ad.smoothing * FS)
        if (adaptive) {
          const step = ad.ramp / FS
          this.adaptAmp[si] = Math.max(ad.min, Math.min(ad.max, this.adaptAmp[si] + (this.estimate[si] > ad.threshold ? step : -step)))
        } else this.adaptAmp[si] = cfg.adaptive.min
        out[o + (si ? LANE.senseR : LANE.senseL)] = this.estimate[si]
        out[o + (si ? LANE.burstR : LANE.burstL)] = inBurst
        out[o + (si ? LANE.stimR : LANE.stimL)] = this.ramp[si] * amp
        out[o + (si ? LANE.betaR : LANE.betaL)] = level * envelope
      }
    }
    return out
  }
}
