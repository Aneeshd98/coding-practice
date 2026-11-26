import test from 'node:test'
import assert from 'node:assert/strict'
import { FS, Generator, type ConfigPatch } from '../src/sim/model'
import { SignalStore, rowNamed } from '../src/dsp/store'
import { lessons, modules } from '../src/course/content'
import { betaPower, captureBursts, exercises, grade, type Captures } from '../src/course/practicals'

function session(seed = 7) {
  const g = new Generator(seed),
    store = new SignalStore(300)
  const run = (seconds: number, patch?: ConfigPatch) => {
    if (patch) g.configure(patch)
    store.ingest(g.sample, g.block(Math.round(seconds * FS)), g.marks, g.states)
    g.marks = []
    g.states = []
  }
  return { g, store, run }
}

test('course content is complete and every answer index is valid', () => {
  assert.equal(modules.length, 4)
  assert.equal(new Set(lessons.map((l) => l.id)).size, lessons.length)
  for (const l of lessons) {
    assert.ok(l.correct >= 0 && l.correct < l.options.length, l.id)
    assert.ok(l.explain.length && l.steps.length && l.sources.length, l.id)
  }
  for (const m of modules) assert.ok(exercises[m.id])
})

test('sensing practical requires the montage, a settled resting window and the measured best pair', () => {
  const { store, run } = session()
  run(25)
  const ctx = { store, viewEnd: store.end, montage: 'Sandwich pairs' as const, captures: {} }
  assert.match(grade('sensing', ctx, '1–2')!, /Adjacent/)
  const adjacent = { ...ctx, montage: 'Adjacent pairs' as const }
  const from = store.end - 8 * FS
  const powers = ['0–1', '1–2', '2–3'].map((p) => betaPower(store, from, store.end, rowNamed('L ' + p)!))
  const best = ['0–1', '1–2', '2–3'][powers.indexOf(Math.max(...powers))]
  assert.equal(grade('sensing', adjacent, best), undefined)
  assert.ok(grade('sensing', adjacent, best === '0–1' ? '2–3' : '0–1'))
})

test('medication practical rejects an unsettled ON window and accepts the measured ratio', () => {
  const { store, run } = session()
  run(25)
  const off = { start: store.end - 20 * FS, end: store.end, row: 'L 0–2' }
  run(8, { medication: 'on' })
  const early: Captures = { off, on: { start: store.end - 20 * FS, end: store.end, row: 'L 0–2' } }
  const ctx = { store, viewEnd: store.end, montage: 'Sandwich pairs' as const, captures: early }
  assert.ok(grade('beta', ctx, '2'))
  run(35)
  const captures: Captures = { off, on: { start: store.end - 20 * FS, end: store.end, row: 'L 0–2' } }
  const row = rowNamed('L 0–2')!
  const ratio =
    betaPower(store, off.start, off.end, row) / betaPower(store, captures.on!.start, captures.on!.end, row)
  assert.equal(grade('beta', { ...ctx, captures }, ratio.toFixed(2)), undefined)
  assert.ok(grade('beta', { ...ctx, captures }, (ratio * 2).toFixed(2)))
  const result = captureBursts(store, captures, true)!
  assert.equal(grade('bursts', { ...ctx, captures }, result.on!.meanDurationMs.toFixed(0)), undefined)
  const own = captureBursts(store, captures, false)!
  if (Math.abs(own.on!.meanDurationMs - result.on!.meanDurationMs) > Math.max(15, 0.12 * result.on!.meanDurationMs))
    assert.ok(grade('bursts', { ...ctx, captures }, own.on!.meanDurationMs.toFixed(0)), 'own threshold is not accepted')
})

test('stimulation practical uses the measured alias and the required settings', () => {
  const { store, run } = session()
  run(10)
  const ctx = () => ({ store, viewEnd: store.end, montage: 'Adjacent pairs' as const, captures: {} })
  assert.ok(grade('stim', ctx(), '120'))
  run(6, { stim: { on: true, contact: { L: 1 }, amplitude: 2 } })
  assert.equal(grade('stim', ctx(), '120'), undefined)
  assert.ok(grade('stim', ctx(), '130'))
  run(6, { stim: { contact: { L: 3 } } })
  assert.match(grade('stim', ctx(), '120')!, /contact 1/)
})
