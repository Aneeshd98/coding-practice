import {
  FS,
  SEGMENTS,
  segLane,
  INITIAL,
  LANE,
  RANGE_UV,
  SIDES,
  STRIDE,
  ch,
  type Config,
  type Mark,
  type Side,
  type StateChange,
} from '../sim/model'

export type Montage = 'Sandwich pairs' | 'Adjacent pairs' | 'Monopolar' | 'Segments'
export const MONTAGES: Montage[] = ['Sandwich pairs', 'Adjacent pairs', 'Monopolar', 'Segments']
/** A derivation: contact a minus contact b, or minus the implant case when b is -1. */
export interface Row {
  name: string
  side: Side
  a: number
  b: number
}
const PAIRS: Record<Exclude<Montage, 'Segments'>, number[][]> = {
  'Sandwich pairs': [
    [0, 2],
    [1, 3],
  ],
  'Adjacent pairs': [
    [0, 1],
    [1, 2],
    [2, 3],
  ],
  Monopolar: [[0], [1], [2], [3]],
}
const rowOf = (side: Side, pair: number[]): Row => ({
  name: side + ' ' + (pair.length === 2 ? pair[0] + '–' + pair[1] : pair[0] + ' vs case'),
  side,
  a: ch(side, pair[0]),
  b: pair.length === 2 ? ch(side, pair[1]) : -1,
})
/** Within-level segment pairs on a directional lead (1a–1b, 1b–1c, 1c–1a, and the same for level 2). */
const segmentRows = (side: Side): Row[] =>
  ([1, 2] as const).flatMap((level) =>
    [0, 1, 2].map((g) => ({
      name: `${side} ${level}${SEGMENTS[g]}–${level}${SEGMENTS[(g + 1) % 3]}`,
      side,
      a: segLane(side, level, g),
      b: segLane(side, level, (g + 1) % 3),
    })),
  )
export function rowsFor(montage: Montage): Row[] {
  if (montage === 'Segments') return SIDES.flatMap(segmentRows)
  return SIDES.flatMap((side) => PAIRS[montage].map((pair) => rowOf(side, pair)))
}
export const ALL_ROWS: Row[] = [...MONTAGES.flatMap(rowsFor), ...SIDES.map((s) => rowOf(s, [0, 3]))]
export function rowNamed(name: string): Row | undefined {
  return ALL_ROWS.find((r) => r.name === name)
}

/** Rolling acquisition buffer with absolute sample indexes. */
export class SignalStore {
  readonly capacity: number
  readonly raw: Float32Array
  start = 0
  end = 0
  stream = 0
  revision = 0
  marks: Mark[] = []
  states: StateChange[] = []
  private listeners = new Set<() => void>()

  constructor(seconds = 300) {
    this.capacity = seconds * FS
    this.raw = new Float32Array(this.capacity * STRIDE)
  }
  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }
  private notify() {
    this.revision++
    this.listeners.forEach((fn) => fn())
  }
  ingest(start: number, data: Float32Array, marks: Mark[] = [], states: StateChange[] = []) {
    if (start !== this.end) {
      this.start = this.end = start
      this.marks = []
      this.states = []
      this.stream++
    }
    const n = data.length / STRIDE
    for (let i = 0; i < n; i++) {
      this.raw.set(data.subarray(i * STRIDE, (i + 1) * STRIDE), ((start + i) % this.capacity) * STRIDE)
    }
    this.end = start + n
    this.start = Math.max(this.start, this.end - this.capacity)
    this.states.push(...states)
    while (this.states.length > 1 && this.states[1].sample <= this.start) this.states.shift()
    this.marks.push(...marks)
    this.marks = this.marks.filter((m) => m.sample >= this.start)
    this.notify()
  }
  has(sample: number) {
    return sample >= this.start && sample < this.end
  }
  at(sample: number, lane: number) {
    if (!this.has(sample)) return 0
    return this.raw[(sample % this.capacity) * STRIDE + lane]
  }
  /** Each derivation behaves like a differential amplifier that saturates at ±RANGE_UV. */
  value(sample: number, row: Row, clean = false) {
    if (!this.has(sample)) return 0
    // Segment lanes have no separate artifact-free copy; they always read the acquired signal.
    const useClean = clean && row.a < LANE.segments
    const p = (sample % this.capacity) * STRIDE + (useClean ? LANE.neural : 0)
    const v = this.raw[p + row.a] - (row.b < 0 ? 0 : this.raw[p + row.b])
    return clean ? v : Math.max(-RANGE_UV, Math.min(RANGE_UV, v))
  }
  series(end: number, count: number, row: Row, clean = false) {
    const first = Math.max(this.start, end - count)
    return Float64Array.from({ length: Math.max(0, end - first) }, (_, i) => this.value(first + i, row, clean))
  }
  range(from: number, to: number, row: Row, clean = false) {
    const a = Math.max(this.start, from),
      b = Math.min(this.end, to)
    return Float64Array.from({ length: Math.max(0, b - a) }, (_, i) => this.value(a + i, row, clean))
  }
  configAt(sample: number): Config {
    for (let i = this.states.length - 1; i >= 0; i--) if (this.states[i].sample <= sample) return this.states[i].config
    return INITIAL
  }
  /** True when every acquisition state in [from, to) satisfies the test. */
  spans(from: number, to: number, test: (c: Config) => boolean) {
    if (from < this.start || to > this.end || to <= from || !test(this.configAt(from))) return false
    return this.states.every((s) => s.sample <= from || s.sample >= to || test(s.config))
  }
  /** Samples since the last state change, before `sample`, that altered the selected property. */
  settledFor(sample: number, key: (c: Config) => unknown) {
    let since = this.start,
      changed = false
    for (let i = 1; i < this.states.length; i++) {
      const s = this.states[i]
      if (s.sample > sample) break
      if (key(s.config) !== key(this.states[i - 1].config)) {
        since = s.sample
        changed = true
      }
    }
    // No recorded change since the stream began: the initial state has always held.
    if (!changed && this.states[0]?.sample === 0) return Infinity
    return sample - since
  }
}
