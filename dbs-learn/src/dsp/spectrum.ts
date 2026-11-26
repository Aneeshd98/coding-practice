import { FS } from '../sim/model'
import { fft } from './fft'

export interface Spectrum {
  freqs: number[]
  psd: number[]
  segments: number
}

/** Welch power spectral density (µV²/Hz): Hann window, 50% overlap, mean removed per segment. */
export function welch(x: ArrayLike<number>, nfft = 256, rate = FS): Spectrum {
  const half = nfft / 2
  const window = Float64Array.from({ length: nfft }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / nfft))
  const norm = window.reduce((s, w) => s + w * w, 0) * rate
  const psd = new Array(half + 1).fill(0)
  let segments = 0
  for (let start = 0; start + nfft <= x.length; start += half) {
    let mean = 0
    for (let i = 0; i < nfft; i++) mean += x[start + i]
    mean /= nfft
    const re = new Float64Array(nfft),
      im = new Float64Array(nfft)
    for (let i = 0; i < nfft; i++) re[i] = (x[start + i] - mean) * window[i]
    fft(re, im)
    for (let k = 0; k <= half; k++)
      psd[k] += ((re[k] ** 2 + im[k] ** 2) * (k === 0 || k === half ? 1 : 2)) / norm
    segments++
  }
  return {
    freqs: Array.from({ length: half + 1 }, (_, k) => (k * rate) / nfft),
    psd: psd.map((p) => p / Math.max(1, segments)),
    segments,
  }
}

/** Integrated power (µV²) between lo and hi Hz inclusive. */
export function bandPower(s: Spectrum, lo: number, hi: number) {
  const df = s.freqs[1] - s.freqs[0]
  let total = 0
  s.freqs.forEach((f, k) => {
    if (f >= lo && f <= hi) total += s.psd[k] * df
  })
  return total
}

/** Largest PSD bin between lo and hi, refined by a parabolic fit across neighbouring bins. */
export function peak(s: Spectrum, lo: number, hi: number) {
  let best = -1
  s.freqs.forEach((f, k) => {
    if (f >= lo && f <= hi && (best < 0 || s.psd[k] > s.psd[best])) best = k
  })
  if (best < 0) return { hz: NaN, value: NaN, local: false }
  const df = s.freqs[1] - s.freqs[0]
  let hz = s.freqs[best]
  // Refine only a true local maximum; a band-edge maximum is not a peak.
  const local = best > 0 && best < s.psd.length - 1 && s.psd[best - 1] < s.psd[best] && s.psd[best + 1] < s.psd[best]
  if (local) {
    const [a, b, c] = [s.psd[best - 1], s.psd[best], s.psd[best + 1]]
    hz += (0.5 * (a - c) * df) / (a - 2 * b + c)
  }
  return { hz, value: s.psd[best], local: local && hz >= lo && hz <= hi }
}

export const BETA: [number, number] = [13, 35]

/**
 * A peak counts as an oscillation only if it is a local maximum inside the band and rises well
 * above its own flanks (bins 3–6 Hz either side). Comparing with flanks rather than the band's
 * median keeps the sloping 1/f background from looking like a peak.
 */
export function prominent(s: Spectrum, p: { local: boolean; value: number; hz?: number }, lo: number, hi: number, ratio = 2.5) {
  if (!p.local || p.hz === undefined || p.hz < lo || p.hz > hi) return false
  const flank = s.psd.filter((_, k) => {
    const d = Math.abs(s.freqs[k] - p.hz!)
    return d >= 3 && d <= 6 && s.freqs[k] > 0.5
  })
  if (!flank.length) return false
  return p.value > ratio * (flank.reduce((a, b) => a + b, 0) / flank.length)
}
