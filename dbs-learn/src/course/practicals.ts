import { FS, LANE, type Config } from '../sim/model'
import { rowNamed, type Montage, type Row, type SignalStore } from '../dsp/store'
import { BETA, bandPower, peak, welch } from '../dsp/spectrum'
import { analyzeBursts } from '../dsp/bursts'
import type { ModuleId } from './content'

export interface Capture {
  start: number
  end: number
  row: string
}
export interface Captures {
  off?: Capture
  on?: Capture
}
export interface PracticalContext {
  store: SignalStore
  viewEnd: number
  montage: Montage
  captures: Captures
}
export interface Exercise {
  steps: string[]
  question: string
  choices?: string[]
  unit?: string
  takeaway: string
}

export const CAPTURE_SECONDS = 20
export const ADAPTIVE_BETA = 0.65
export const ADAPTIVE_ENERGY = 0.4
const SETTLE = 12 * FS

const resting = (c: Config) => c.movement === 'rest' && !c.stim.on
export function betaPower(store: SignalStore, from: number, to: number, row: Row) {
  return bandPower(welch(store.range(from, to, row)), BETA[0], BETA[1])
}
/** Shared measurement used by the burst panel and the grader. */
export function captureBursts(store: SignalStore, captures: Captures, fixed: boolean) {
  const { off, on } = captures
  if (!off) return null
  const row = rowNamed(off.row)!
  const offSeries = store.range(off.start, off.end, row)
  const centre = peak(welch(offSeries), BETA[0], BETA[1]).hz
  const offResult = analyzeBursts(offSeries, centre)
  const onResult =
    on && on.row === off.row
      ? analyzeBursts(store.range(on.start, on.end, row), centre, fixed ? offResult.threshold : undefined)
      : null
  return { centre, off: offResult, on: onResult }
}

function checkCapture(store: SignalStore, c: Capture | undefined, medication: 'off' | 'on') {
  const label = medication.toUpperCase()
  if (!c) return `Capture an ${label} window first.`
  if (!store.has(c.start) || !store.has(c.end - 1))
    return `The ${label} capture has left the 5-minute buffer. Capture it again.`
  if (c.end - c.start < CAPTURE_SECONDS * FS - 1) return `The ${label} capture needs ${CAPTURE_SECONDS} seconds of data.`
  if (!store.spans(c.start, c.end, (cfg) => cfg.medication === medication && resting(cfg)))
    return `The ${label} capture must contain only medication ${label}, at rest, with stimulation off.`
  if (store.settledFor(c.start, (cfg) => cfg.medication) < SETTLE)
    return `The ${label} capture starts too soon after the medication changed. Wait at least 12 seconds, then capture again.`
}

export const exercises: Record<ModuleId, Exercise> = {
  sensing: {
    steps: [
      'Medication OFF, stimulation off, at rest. Set Montage to Adjacent pairs and wait 8 seconds.',
      'Compare the beta power of L 0–1, L 1–2 and L 2–3 in the spectrum panel over the last 8 seconds.',
    ],
    question: 'Which left adjacent pair has the most beta power?',
    choices: ['0–1', '1–2', '2–3'],
    takeaway: 'You located the edge of the beta generator from the recorded contact pairs.',
  },
  beta: {
    steps: [
      'Select L 0–2. With medication OFF and at rest, choose Capture OFF (20 seconds).',
      'Switch medication ON, wait at least 15 seconds, then choose Capture ON with L 0–2 still selected.',
    ],
    question: 'By what factor did beta power fall? (OFF power ÷ ON power)',
    unit: '×',
    takeaway: 'You measured a medication effect from two settled, matched windows on the same contact pair.',
  },
  bursts: {
    steps: [
      'Use your OFF and ON captures from L 0–2 (capture again if needed).',
      'In the burst panel, choose Threshold: fixed from OFF capture and read the ON mean burst duration.',
    ],
    question: 'What is the mean ON burst duration using the OFF threshold?',
    unit: 'ms',
    takeaway: 'With a fixed baseline threshold, levodopa’s effect shows up as shorter bursts.',
  },
  adaptive: {
    steps: [
      'Capture an OFF window (medication OFF, at rest, stimulation off) on L 0–2.',
      'Run adaptive DBS on left contact 1 with a maximum of at least 2.5 mA. Tune it, then leave the settings unchanged for 20 seconds.',
      `Goal: left beta at most ${ADAPTIVE_BETA * 100}% of your OFF capture, with a mean amplitude at most ${ADAPTIVE_ENERGY * 100}% of the maximum.`,
    ],
    question: 'What mean left amplitude did your controller deliver over the last 20 seconds?',
    unit: 'mA',
    takeaway: 'You tuned a closed-loop controller to suppress beta while delivering a fraction of continuous stimulation.',
  },
  stim: {
    steps: [
      'Set Montage to Adjacent pairs. Turn stimulation on at left contact 1, at least 1.5 mA, 130 Hz.',
      'Wait 2 seconds, select L 2–3 and find the artifact peak between 90 and 125 Hz in the spectrum (4 s window).',
    ],
    question: 'At what frequency does the stimulation artifact appear in L 2–3?',
    unit: 'Hz',
    takeaway: 'You found the aliased stimulation artifact where the sampling theory predicts it.',
  },
}

/** Mean delivered amplitude (mA) on the left lead over [from, to). */
export function meanDelivered(store: SignalStore, from: number, to: number) {
  let sum = 0
  for (let i = from; i < to; i++) sum += store.at(i, LANE.stimL)
  return sum / Math.max(1, to - from)
}
const near = (value: number, target: number, tolerance: number) =>
  Number.isFinite(value) && Math.abs(value - target) <= tolerance
const numeric = (answer: string) => (answer.trim() === '' ? NaN : Number(answer))

/** Returns a specific next step, or undefined when the practical is verified from the data. */
export function grade(module: ModuleId, ctx: PracticalContext, answer: string): string | undefined {
  const { store, viewEnd, captures } = ctx
  switch (module) {
    case 'sensing': {
      if (ctx.montage !== 'Adjacent pairs') return 'Set Montage to Adjacent pairs.'
      const from = viewEnd - 8 * FS
      if (!store.spans(from, viewEnd, (c) => c.medication === 'off' && resting(c)))
        return 'The last 8 seconds must be medication OFF, at rest, with stimulation off. Wait, then try again.'
      if (store.settledFor(from, (c) => c.medication) < SETTLE)
        return 'Medication changed recently. Wait 20 seconds with medication OFF.'
      const powers = ['0–1', '1–2', '2–3'].map((p) => betaPower(store, from, viewEnd, rowNamed('L ' + p)!))
      const best = ['0–1', '1–2', '2–3'][powers.indexOf(Math.max(...powers))]
      if (answer !== best) return 'Compare the beta power readout for each of the three left pairs over the same 8 seconds.'
      return
    }
    case 'beta': {
      const problem = checkCapture(store, captures.off, 'off') ?? checkCapture(store, captures.on, 'on')
      if (problem) return problem
      if (captures.off!.row !== captures.on!.row) return 'Capture OFF and ON from the same contact pair.'
      const row = rowNamed(captures.off!.row)!
      const ratio =
        betaPower(store, captures.off!.start, captures.off!.end, row) /
        betaPower(store, captures.on!.start, captures.on!.end, row)
      if (!near(numeric(answer), ratio, 0.15 * ratio))
        return 'Divide the OFF beta power by the ON beta power shown under the captures.'
      return
    }
    case 'bursts': {
      const problem = checkCapture(store, captures.off, 'off') ?? checkCapture(store, captures.on, 'on')
      if (problem) return problem
      const result = captureBursts(store, captures, true)
      if (!result?.on) return 'Capture OFF and ON from the same contact pair.'
      if (result.on.bursts.length < 3)
        return 'Fewer than three ON bursts crossed the OFF threshold. Capture a new ON window.'
      const target = result.on.meanDurationMs
      if (!near(numeric(answer), target, Math.max(15, 0.12 * target)))
        return 'Use the fixed OFF threshold, not the ON window’s own threshold, and read the ON mean duration.'
      return
    }
    case 'adaptive': {
      const off = captures.off
      if (!off || !store.has(off.start) || !store.has(off.end - 1)) return 'Capture an OFF window first, with stimulation off and the patient at rest.'
      if (!store.spans(off.start, off.end, (c) => c.medication === 'off' && resting(c))) return 'The OFF capture must contain only medication OFF, at rest, with stimulation off.'
      const from = viewEnd - CAPTURE_SECONDS * FS
      const settings = JSON.stringify(store.configAt(viewEnd - 1).adaptive)
      const ok = (c: Config) =>
        c.medication === 'off' &&
        c.movement === 'rest' &&
        c.stim.on &&
        c.stim.contact.L === 1 &&
        c.adaptive.on &&
        c.adaptive.max >= 2.5 &&
        JSON.stringify(c.adaptive) === settings
      if (!store.spans(from, viewEnd, ok))
        return 'The last 20 seconds must run adaptive DBS on left contact 1 (maximum at least 2.5 mA), medication OFF, at rest, with no setting changes.'
      const row = rowNamed('L 0–2')!
      const ratio = betaPower(store, from, viewEnd, row) / betaPower(store, off.start, off.end, row)
      const max = store.configAt(viewEnd - 1).adaptive.max
      const mean = meanDelivered(store, from, viewEnd)
      if (ratio > ADAPTIVE_BETA)
        return `Beta is ${(ratio * 100).toFixed(0)}% of OFF. Centre the sensing band on the beta peak, lower the threshold or speed up the ramp.`
      if (mean > ADAPTIVE_ENERGY * max)
        return `Mean amplitude is ${((mean / max) * 100).toFixed(0)}% of the maximum. Raise the threshold so stimulation pauses between bursts.`
      if (!near(numeric(answer), mean, 0.1)) return 'Read the mean delivered amplitude in the Adaptive DBS panel and enter it in mA.'
      return
    }
    case 'stim': {
      if (ctx.montage !== 'Adjacent pairs') return 'Set Montage to Adjacent pairs.'
      const from = viewEnd - 4 * FS
      const ok = (c: Config) =>
        c.stim.on && c.stim.contact.L === 1 && c.stim.amplitude >= 1.5 && c.stim.frequency === 130
      if (!store.spans(from, viewEnd, ok))
        return 'The last 4 seconds must have stimulation on at left contact 1, at least 1.5 mA, 130 Hz.'
      if (store.settledFor(from, (c) => JSON.stringify(c.stim)) < 1.5 * FS)
        return 'Stimulation settings changed recently. Wait 2 seconds.'
      const measured = peak(welch(store.range(from, viewEnd, rowNamed('L 2–3')!)), 90, 125).hz
      if (!near(numeric(answer), measured, 2))
        return 'Read the peak frequency between 90 and 125 Hz in L 2–3. Remember the 125 Hz Nyquist limit.'
      return
    }
  }
}
