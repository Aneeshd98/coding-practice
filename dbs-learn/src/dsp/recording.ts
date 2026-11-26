/**
 * A real recording: one minute of resting STN LFP per condition from OpenNeuro ds004998
 * (see public/recordings). Contacts are stored as recorded; bipolar pairs are formed here.
 */
import type { Side } from '../sim/model'
import { BETA, bandPower, peak, prominent, welch, type Spectrum } from './spectrum'

export type Condition = 'off' | 'on'
export interface RecordingManifest {
  title: string
  source: string
  citation: string
  doi: string
  licence: string
  subject: string
  window_s: [number, number]
  fs: number
  scale_uv: number
  channels: string[]
  bad: Record<Condition, string[]>
  files: Record<Condition, string>
  selection: { reason: string; screened: number; excluded: number; clear_off_peak: number; fell_on_of_those: number; criterion: string }
}
export interface Recording {
  manifest: RecordingManifest
  data: Record<Condition, Int16Array>
}

export const REAL_PAIRS: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [0, 2],
  [1, 3],
]
export const MANIFEST = 'recordings/ds004998-sub-2IhVOz.json'

export async function loadRecording(base: string, fetcher: (url: string) => Promise<Response> = fetch): Promise<Recording> {
  const manifest = (await (await fetcher(base + MANIFEST)).json()) as RecordingManifest
  const folder = base + MANIFEST.slice(0, MANIFEST.lastIndexOf('/') + 1)
  const read = async (c: Condition) => {
    const r = await fetcher(folder + manifest.files[c])
    if (!r.ok) throw new Error('Recording unavailable')
    return new Int16Array(await r.arrayBuffer())
  }
  const [off, on] = await Promise.all([read('off'), read('on')])
  return { manifest, data: { off, on } }
}

/** Contacts marked bad in either condition make a pair unusable for comparing the two. */
export function badContacts(m: RecordingManifest, side: Side, pair: [number, number]) {
  return pair.filter((c) => m.bad.off.includes(side + c) || m.bad.on.includes(side + c))
}

/** Bipolar derivation a minus b, in µV. */
export function pairSeries(rec: Recording, c: Condition, side: Side, [a, b]: [number, number]) {
  const { channels, scale_uv } = rec.manifest
  const n = channels.length,
    ia = channels.indexOf(side + a),
    ib = channels.indexOf(side + b)
  const d = rec.data[c]
  return Float64Array.from({ length: d.length / n }, (_, i) => (d[i * n + ia] - d[i * n + ib]) * scale_uv)
}

export interface ConditionSummary {
  spectrum: Spectrum
  power: number
  peakHz: number
  clear: boolean
}
/** Beta in each condition, with the same analysis as the simulator's spectrum panel (finer bins over the minute). */
export function compareConditions(rec: Recording, side: Side, pair: [number, number]) {
  const summary = (c: Condition): ConditionSummary => {
    const spectrum = welch(pairSeries(rec, c, side, pair), 512, rec.manifest.fs)
    const p = peak(spectrum, BETA[0], BETA[1])
    return { spectrum, power: bandPower(spectrum, BETA[0], BETA[1]), peakHz: p.hz, clear: prominent(spectrum, p, BETA[0], BETA[1]) }
  }
  const off = summary('off'),
    on = summary('on')
  return { off, on, ratio: on.power / off.power }
}
