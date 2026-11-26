import { FS } from '../sim/model'
import type { Row, SignalStore } from './store'
import { BETA, peak, welch } from './spectrum'
import { bandpassZeroPhase, envelope } from './bursts'

export const PRE_S = 2,
  POST_S = 4,
  STEP_S = 0.05

/**
 * Cue-locked beta amplitude, as % change from the −2 to −0.5 s baseline, averaged
 * across trials. Each trial's envelope is computed first, so phase cannot cancel.
 */
export function movementCourse(store: SignalStore, row: Row, smoothS = 0.2) {
  const cues = store.marks.filter((m) => m.kind === 'cue' && store.has(m.sample - 3 * FS) && store.has(m.sample + 5 * FS - 1))
  if (!cues.length) return null
  // One centre frequency for every trial, from all trial data concatenated.
  const pieces = cues.map((c) => store.range(c.sample - 3 * FS, c.sample + 5 * FS, row))
  const joined = new Float64Array(pieces.reduce((n, p) => n + p.length, 0))
  pieces.reduce((at, p) => (joined.set(p, at), at + p.length), 0)
  const centre = peak(welch(joined), BETA[0], BETA[1]).hz
  const length = Math.round((PRE_S + POST_S) * FS)
  const mean = new Float64Array(length)
  for (const x of pieces) {
    const env = envelope(bandpassZeroPhase(x, centre)).subarray((3 - PRE_S) * FS, (3 - PRE_S) * FS + length)
    let base = 0
    const b0 = 0,
      b1 = Math.round(1.5 * FS)
    for (let i = b0; i < b1; i++) base += env[i]
    base /= b1 - b0
    for (let i = 0; i < length; i++) mean[i] += (100 * (env[i] - base)) / base / pieces.length
  }
  const half = Math.round((smoothS * FS) / 2),
    step = Math.round(STEP_S * FS)
  const y = Float64Array.from({ length: Math.floor(length / step) }, (_, k) => {
    const centreAt = k * step
    let sum = 0,
      n = 0
    for (let i = Math.max(0, centreAt - half); i <= Math.min(length - 1, centreAt + half); i++) {
      sum += mean[i]
      n++
    }
    return sum / n
  })
  return { trials: cues.length, centre, y }
}
