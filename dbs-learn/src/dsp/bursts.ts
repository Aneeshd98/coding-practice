import { FS } from '../sim/model'
import { fft, nextPow2 } from './fft'

/** Second-order band-pass (constant 0 dB peak gain), applied twice forward and backward. */
export function bandpassZeroPhase(x: ArrayLike<number>, centre: number, halfWidth = 3, rate = FS) {
  const w = (2 * Math.PI * centre) / rate,
    q = centre / (2 * halfWidth),
    alpha = Math.sin(w) / (2 * q),
    a0 = 1 + alpha
  const b0 = alpha / a0,
    b2 = -alpha / a0,
    a1 = (-2 * Math.cos(w)) / a0,
    a2 = (1 - alpha) / a0
  const pad = Math.min(x.length - 1, Math.round(0.5 * rate))
  // Reflect the ends so the filter settles outside the analysed interval.
  const padded = new Float64Array(x.length + 2 * pad)
  for (let i = 0; i < pad; i++) {
    padded[i] = 2 * x[0] - x[pad - i]
    padded[padded.length - 1 - i] = 2 * x[x.length - 1] - x[x.length - 1 - (pad - i)]
  }
  for (let i = 0; i < x.length; i++) padded[pad + i] = x[i]
  const pass = (v: Float64Array, reverse: boolean) => {
    let x1 = 0,
      x2 = 0,
      y1 = 0,
      y2 = 0
    for (let n = 0; n < v.length; n++) {
      const i = reverse ? v.length - 1 - n : n,
        xi = v[i],
        y = b0 * xi + b2 * x2 - a1 * y1 - a2 * y2
      x2 = x1
      x1 = xi
      y2 = y1
      y1 = y
      v[i] = y
    }
  }
  for (let k = 0; k < 2; k++) {
    pass(padded, false)
    pass(padded, true)
  }
  return padded.slice(pad, pad + x.length)
}

/** Amplitude envelope from the analytic signal. */
export function envelope(x: ArrayLike<number>) {
  const n = nextPow2(x.length),
    re = new Float64Array(n),
    im = new Float64Array(n)
  for (let i = 0; i < x.length; i++) re[i] = x[i]
  fft(re, im)
  for (let k = 1; k < n / 2; k++) {
    re[k] *= 2
    im[k] *= 2
  }
  for (let k = n / 2 + 1; k < n; k++) re[k] = im[k] = 0
  fft(re, im, true)
  return Float64Array.from({ length: x.length }, (_, i) => Math.hypot(re[i], im[i]))
}

export function percentile(values: ArrayLike<number>, p: number) {
  const sorted = Float64Array.from(values).sort()
  if (!sorted.length) return NaN
  const at = (p / 100) * (sorted.length - 1),
    lo = Math.floor(at)
  return sorted[lo] + (sorted[Math.min(sorted.length - 1, lo + 1)] - sorted[lo]) * (at - lo)
}

export interface Burst {
  start: number
  end: number
}
export interface BurstAnalysis {
  filtered: Float64Array
  envelope: Float64Array
  threshold: number
  bursts: Burst[]
  meanDurationMs: number
  ratePerSecond: number
  fractionOfTime: number
}

/**
 * Beta bursts: envelope above threshold for at least minMs. The threshold is the
 * 75th percentile of this signal's own envelope unless a fixed one is supplied.
 * Episodes touching either edge are excluded because their duration is unknown.
 */
export function analyzeBursts(
  x: ArrayLike<number>,
  centre: number,
  fixedThreshold?: number,
  minMs = 100,
  rate = FS,
): BurstAnalysis {
  const filtered = bandpassZeroPhase(x, centre, 3, rate)
  const env = envelope(filtered)
  const threshold = fixedThreshold ?? percentile(env, 75)
  const bursts: Burst[] = []
  const minimum = Math.round((minMs * rate) / 1000)
  let start = -1,
    above = 0
  for (let i = 0; i <= env.length; i++) {
    const on = i < env.length && env[i] > threshold
    if (on) above++
    if (on && start < 0) start = i
    if (!on && start >= 0) {
      if (start > 0 && i < env.length && i - start >= minimum) bursts.push({ start, end: i })
      start = -1
    }
  }
  const seconds = x.length / rate
  return {
    filtered,
    envelope: env,
    threshold,
    bursts,
    meanDurationMs: bursts.length
      ? (bursts.reduce((s, b) => s + b.end - b.start, 0) / bursts.length / rate) * 1000
      : 0,
    ratePerSecond: bursts.length / seconds,
    fractionOfTime: above / Math.max(1, env.length),
  }
}
