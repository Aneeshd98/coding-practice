import test from 'node:test'
import assert from 'node:assert/strict'
import { FS, Generator, LANE, RANGE_UV, STRIDE, betaWeight, contactZ, makeSubject, type ConfigPatch } from '../src/sim/model'
import { SignalStore, rowNamed, rowsFor } from '../src/dsp/store'
import { BETA, bandPower, peak, welch } from '../src/dsp/spectrum'
import { analyzeBursts, percentile } from '../src/dsp/bursts'

function record(patch: ConfigPatch, seconds = 20, seed = 7, warm = 20) {
  const g = new Generator(seed)
  const store = new SignalStore(120)
  g.configure(patch)
  store.ingest(0, g.block(warm * FS), [], g.states)
  g.states = []
  store.ingest(g.sample, g.block(seconds * FS))
  return { g, store }
}
const series = (s: SignalStore, name: string, seconds = 20) => s.series(s.end, seconds * FS, rowNamed(name)!)
const beta = (s: SignalStore, name: string) => bandPower(welch(series(s, name)), BETA[0], BETA[1])

test('the stream is identical regardless of how it is split into blocks', () => {
  const a = new Generator(3),
    b = new Generator(3)
  const whole = a.block(900)
  const parts = [17, 250, 133, 500].map((n) => b.block(n))
  const joined = new Float32Array(whole.length)
  let at = 0
  for (const p of parts) {
    joined.set(p, at)
    at += p.length
  }
  assert.deepEqual(joined, whole)
  assert.ok(whole.every(Number.isFinite))
})

test('each patient has their own hidden beta frequency and generator edge', () => {
  const a = makeSubject(1),
    b = makeSubject(2)
  assert.notDeepEqual(a.betaHz, b.betaHz)
  for (const s of [a, b])
    for (const side of ['L', 'R'] as const) {
      assert.ok(s.betaHz[side] >= 16 && s.betaHz[side] <= 26)
      assert.ok(s.border[side] > 1 && s.border[side] < 5)
    }
})

test('the spectral peak matches the hidden beta frequency on each side', () => {
  const { g, store } = record({})
  for (const side of ['L', 'R'] as const) {
    const p = peak(welch(series(store, side + ' 0–2')), 13, 35).hz
    assert.ok(Math.abs(p - g.subject.betaHz[side]) < 1.5, `${side}: ${p} vs ${g.subject.betaHz[side]}`)
  }
})

test('the adjacent pair straddling the generator edge carries the most beta', () => {
  for (const seed of [7, 11, 23, 42]) {
    const { g, store } = record({}, 20, seed)
    const border = g.subject.border.L
    const pairs = [0, 1, 2].map((c) => ({ c, w: Math.abs(betaWeight(contactZ(c), border) - betaWeight(contactZ(c + 1), border)) }))
    const expected = pairs.reduce((a, b) => (b.w > a.w ? b : a)).c
    const powers = [0, 1, 2].map((c) => beta(store, `L ${c}–${c + 1}`))
    assert.equal(powers.indexOf(Math.max(...powers)), expected, `seed ${seed}`)
  }
})

test('levodopa reduces beta power and shortens bursts measured with a fixed threshold', () => {
  const off = record({}).store,
    on = record({ medication: 'on' }).store
  assert.ok(beta(off, 'L 0–2') > 1.4 * beta(on, 'L 0–2'))
  const x = series(off, 'L 0–2'),
    centre = peak(welch(x), 13, 35).hz
  const offBursts = analyzeBursts(x, centre)
  const onFixed = analyzeBursts(series(on, 'L 0–2'), centre, offBursts.threshold)
  const onOwn = analyzeBursts(series(on, 'L 0–2'), centre)
  assert.ok(onFixed.meanDurationMs < 0.75 * offBursts.meanDurationMs)
  assert.ok(onFixed.fractionOfTime < offBursts.fractionOfTime)
  // The teaching pitfall: a per-recording 75th percentile always flags about a quarter of the samples.
  assert.ok(Math.abs(onOwn.fractionOfTime - 0.25) < 0.02)
})

test('movement suppresses beta most strongly contralateral to the moving hand', () => {
  const rest = record({}).store,
    right = record({ movement: 'right' }).store
  const drop = (side: 'L' | 'R') => beta(right, side + ' 0–2') / beta(rest, side + ' 0–2')
  assert.ok(drop('L') < 0.55)
  assert.ok(drop('L') < drop('R'))
})

test('a stimulation artifact at 130 Hz aliases to 120 Hz and cancels in the flanking pair', () => {
  const { store } = record({ stim: { on: true, contact: { L: 1 }, amplitude: 2 } })
  const flank = welch(series(store, 'L 0–2')),
    outside = welch(series(store, 'L 2–3'))
  assert.ok(Math.abs(peak(outside, 90, 125).hz - 120) < 1)
  assert.ok(bandPower(outside, 115, 125) > 100 * bandPower(flank, 115, 125))
  // Its harmonic folds from 260 Hz to 10 Hz.
  assert.ok(Math.abs(peak(outside, 5, 15).hz - 10) < 1)
  const mono = series(store, 'L 1 vs case')
  assert.ok(mono.filter((v) => Math.abs(v) === RANGE_UV).length > 100, 'the stimulating contact saturates')
})

test('stimulation near the generator suppresses beta in the flanking pair', () => {
  const off = record({}).store,
    on = record({ stim: { on: true, contact: { L: 1 }, amplitude: 3 } }).store
  assert.ok(beta(on, 'L 0–2') < 0.6 * beta(off, 'L 0–2'))
})

test('the heartbeat is large referenced to the case and small in a bipolar pair', () => {
  const { store } = record({})
  const rms = (x: Float64Array) => Math.sqrt(x.reduce((s, v) => s + v * v, 0) / x.length)
  const mono = series(store, 'L 0 vs case'),
    clean = store.series(store.end, 20 * FS, rowNamed('L 0 vs case')!, true)
  const bip = series(store, 'L 0–2'),
    bipClean = store.series(store.end, 20 * FS, rowNamed('L 0–2')!, true)
  const cardiacMono = rms(mono.map((v, i) => v - clean[i])),
    cardiacBip = rms(bip.map((v, i) => v - bipClean[i]))
  assert.ok(cardiacMono > 15 * cardiacBip)
})

test('frames carry witness lanes and the montage rows are consistent', () => {
  const g = new Generator(5, { stim: { on: true } })
  const b = g.block(FS)
  const stimLane = Array.from({ length: FS }, (_, i) => b[i * STRIDE + LANE.stimL])
  assert.ok(stimLane[0] < stimLane[FS - 1], 'soft start ramps amplitude')
  assert.equal(stimLane[FS - 1], 2)
  assert.equal(rowsFor('Adjacent pairs').length, 6)
  assert.equal(rowsFor('Sandwich pairs').length, 4)
  assert.equal(rowsFor('Monopolar').length, 8)
})

test('the store keeps absolute indexes across ring rollover and records state history', () => {
  const g = new Generator(1),
    s = new SignalStore(2)
  for (let i = 0; i < 5; i++) {
    if (i === 3) g.configure({ medication: 'on' })
    s.ingest(g.sample, g.block(FS), g.marks, g.states)
    g.marks = []
    g.states = []
  }
  assert.equal(s.end, 5 * FS)
  assert.equal(s.start, 3 * FS)
  assert.equal(s.configAt(s.end - 1).medication, 'on')
  assert.equal(s.at(0, 0), 0)
  assert.equal(s.settledFor(4 * FS, (c) => c.medication), FS)
})

test('percentile and burst detection recover a known synthetic burst', () => {
  assert.equal(percentile([1, 2, 3, 4, 5], 75), 4)
  const x = Float64Array.from({ length: 6 * FS }, (_, i) => {
    const t = i / FS
    const on = t > 2 && t < 2.4 ? 1 : 0.05
    return on * 5 * Math.sin(2 * Math.PI * 20 * t)
  })
  // Narrow band-pass filtering smears burst edges symmetrically, so a half-amplitude
  // threshold recovers the true duration while a low threshold overestimates it.
  const half = analyzeBursts(x, 20, 2.5),
    low = analyzeBursts(x, 20, 1.0)
  assert.equal(half.bursts.length, 1)
  assert.ok(Math.abs(half.meanDurationMs - 400) < 30, String(half.meanDurationMs))
  assert.ok(low.meanDurationMs > half.meanDurationMs + 50)
})

test('cue-locked averaging shows contralateral desynchronization and a post-movement rebound', async () => {
  const { movementCourse, PRE_S, STEP_S } = await import('../src/dsp/movement')
  const g = new Generator(7),
    s = new SignalStore(300)
  const run = (sec: number) => {
    s.ingest(g.sample, g.block(sec * FS), g.marks, g.states)
    g.marks = []
    g.states = []
  }
  run(5)
  for (let i = 0; i < 12; i++) {
    run(3)
    g.configure({ movement: 'right' })
    g.mark('Move cue', 'cue')
    run(2)
    g.configure({ movement: 'rest' })
    g.mark('Stop cue', 'move')
  }
  run(3)
  const mean = (y: Float64Array, a: number, b: number) => {
    const i = Math.round((a + PRE_S) / STEP_S),
      j = Math.round((b + PRE_S) / STEP_S)
    return y.slice(i, j).reduce((t, v) => t + v, 0) / (j - i)
  }
  const left = movementCourse(s, rowNamed('L 0–2')!)!,
    right = movementCourse(s, rowNamed('R 0–2')!)!
  assert.equal(left.trials, 12)
  assert.ok(mean(left.y, 0.5, 1.5) < -35, 'contralateral drop')
  assert.ok(mean(left.y, 0.5, 1.5) < mean(right.y, 0.5, 1.5) - 25, 'laterality')
  assert.ok(mean(left.y, 2.3, 3.2) > 25, 'rebound after the stop cue')
})

test('a monotonic band reports no peak instead of extrapolating outside it', () => {
  const freqs = Array.from({ length: 129 }, (_, k) => (k * 250) / 256)
  const falling = { freqs, psd: freqs.map((f) => 1 / (1 + f)), segments: 1 }
  const p = peak(falling, 13, 35)
  assert.equal(p.local, false)
  assert.ok(p.hz >= 13 && p.hz <= 35)
})

test('a noise wiggle is not a beta peak, a real one is, and a clipped artifact can fake one', async () => {
  const { prominent } = await import('../src/dsp/spectrum')
  const noisy = welch(series(record({ stim: { on: true, contact: { L: 1 }, amplitude: 2 } }).store, 'L 0–1'))
  const real = welch(series(record({}).store, 'L 0–2'))
  assert.equal(prominent(noisy, peak(noisy, 13, 35), 13, 35), false)
  assert.equal(prominent(real, peak(real, 13, 35), 13, 35), true)
  // At 4 mA the pair containing the stimulating contact saturates. Clipping creates harmonics,
  // and the 4th (520 Hz) folds to 520 − 2 × 250 = 20 Hz, inside the beta band.
  const clipped = welch(series(record({ stim: { on: true, contact: { L: 1 }, amplitude: 4 } }).store, 'L 0–1'))
  const fake = peak(clipped, 13, 35)
  assert.ok(prominent(clipped, fake, 13, 35) && Math.abs(fake.hz - 20) < 0.6, String(fake.hz))
})
