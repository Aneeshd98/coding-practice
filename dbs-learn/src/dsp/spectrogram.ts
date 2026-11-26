import { FS } from '../sim/model'
import { fft } from './fft'

export interface Spectrogram {
  /** Window centres, in samples from the start of the input. */
  centres: number[]
  freqs: number[]
  /** Power relative to each frequency's median over all windows, in dB: columns[t][f]. */
  columns: Float32Array[]
}

/**
 * Short-time power spectrum (Hann window, mean removed) from just above 0 Hz up to maxHz. Each frequency
 * is expressed relative to its own median across the windows, so the 1/f background does not
 * hide changes over time and bursts stand out at their frequency.
 *
 * A single short window gives each cell a large chance variation, so power is averaged over
 * `smooth` neighbouring windows and frequency bins (each an odd count) before conversion to dB.
 */
export function spectrogram(x: ArrayLike<number>, win = 256, hop = Math.round(FS / 4), maxHz = 60, rate = FS, smooth: [number, number] = [7, 3]): Spectrogram {
  const bins = Math.min(win / 2, Math.floor((maxHz * win) / rate))
  const freqs = Array.from({ length: bins }, (_, k) => ((k + 1) * rate) / win)
  const hann = Float64Array.from({ length: win }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / win))
  const centres: number[] = [],
    raw: Float64Array[] = []
  const re = new Float64Array(win),
    im = new Float64Array(win)
  for (let start = 0; start + win <= x.length; start += hop) {
    let mean = 0
    for (let i = 0; i < win; i++) mean += x[start + i]
    mean /= win
    for (let i = 0; i < win; i++) {
      re[i] = (x[start + i] - mean) * hann[i]
      im[i] = 0
    }
    fft(re, im)
    raw.push(Float64Array.from({ length: bins }, (_, k) => re[k + 1] ** 2 + im[k + 1] ** 2 + 1e-12))
    centres.push(start + win / 2)
  }
  const [ht, hf] = [Math.floor(smooth[0] / 2), Math.floor(smooth[1] / 2)]
  const smoothed = raw.map((_, t) =>
    Float64Array.from({ length: bins }, (_, k) => {
      let sum = 0,
        n = 0
      for (let dt = -ht; dt <= ht; dt++)
        for (let dk = -hf; dk <= hf; dk++) {
          const c = raw[t + dt]
          if (c && k + dk >= 0 && k + dk < bins) {
            sum += c[k + dk]
            n++
          }
        }
      return sum / n
    }),
  )
  const median = Float64Array.from({ length: bins }, (_, k) => {
    const v = smoothed.map((c) => c[k]).sort((a, b) => a - b)
    return v.length ? v[Math.floor(v.length / 2)] : 1
  })
  const columns = smoothed.map((c) => Float32Array.from(c, (p, k) => 10 * Math.log10(p / median[k])))
  return { centres, freqs, columns }
}
