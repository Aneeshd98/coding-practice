import { SEGMENT_ANGLE, segLane, type Side } from '../sim/model'
import type { SignalStore } from './store'
import { bandpassZeroPhase } from './bursts'
import { BETA, bandPower, welch } from './spectrum'

/** Which way each segment faces, by the angle convention of SEGMENT_ANGLE (0° anterior, toward lateral). */
export const SEGMENT_FACING = ['anterior', 'posterolateral', 'posteromedial'] as const
/** Seconds of recording the directional estimate uses. */
export const DIRECTIONAL_SECONDS = 8

const CENTRE = (BETA[0] + BETA[1]) / 2,
  HALF = (BETA[1] - BETA[0]) / 2

export interface DirectionalBeta {
  /** Beta power of each segment against the case (µV², levels 1 and 2 summed). Shared pickup swamps the differences. */
  vsCase: number[]
  /**
   * Signed directional beta (µV²): beta-band covariance of each segment, minus its level's mean,
   * with that mean. Positive means the segment sees more of the level's beta than average.
   * What all three segments share (heart, far field) cancels, so the sign survives.
   */
  relative: number[]
  /** Estimated direction of the beta source, degrees (0 = segment a, anterior). */
  angle: number
  /** Segment index with the most directional beta. */
  strongest: number
}

export function segmentBeta(store: SignalStore, side: Side, from: number, to: number): DirectionalBeta {
  const vsCase = [0, 0, 0],
    relative = [0, 0, 0]
  for (const level of [1, 2] as const) {
    const raw = [0, 1, 2].map((g) => store.range(from, to, { name: '', side, a: segLane(side, level, g), b: -1 }))
    const n = raw[0].length
    if (n < 256) continue
    raw.forEach((x, g) => (vsCase[g] += bandPower(welch(x), BETA[0], BETA[1])))
    const ring = bandpassZeroPhase(
      Float64Array.from({ length: n }, (_, i) => (raw[0][i] + raw[1][i] + raw[2][i]) / 3),
      CENTRE,
      HALF,
    )
    raw.forEach((x, g) => {
      const seg = bandpassZeroPhase(x, CENTRE, HALF)
      let cov = 0
      for (let i = 0; i < n; i++) cov += (seg[i] - ring[i]) * ring[i]
      relative[g] += cov / n
    })
  }
  let vx = 0,
    vy = 0
  relative.forEach((q, g) => {
    vx += q * Math.cos((SEGMENT_ANGLE[g] * Math.PI) / 180)
    vy += q * Math.sin((SEGMENT_ANGLE[g] * Math.PI) / 180)
  })
  const angle = ((Math.atan2(vy, vx) * 180) / Math.PI + 360) % 360
  return { vsCase, relative, angle, strongest: relative.indexOf(Math.max(...relative)) }
}
