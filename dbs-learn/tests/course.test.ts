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
  assert.equal(modules.length, 7)
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

test('the adaptive practical requires real suppression, energy savings and stable settings', async () => {
  const { meanDelivered } = await import('../src/course/practicals')
  const { store, run } = session()
  run(25)
  const captures: Captures = { off: { start: store.end - 20 * FS, end: store.end, row: 'L 0–2' } }
  const ctx = () => ({ store, viewEnd: store.end, montage: 'Sandwich pairs' as const, captures })
  // Threshold too low: suppression without savings.
  run(25, { stim: { on: true }, adaptive: { on: true, centre: 19.4, threshold: 0.1, max: 3 } })
  assert.match(grade('adaptive', ctx(), '3')!, /Raise the threshold/)
  // Tuned: passes only with the measured mean amplitude.
  run(25, { adaptive: { threshold: 0.7, ramp: 6, smoothing: 0.25 } })
  const mean = meanDelivered(store, store.end - 20 * FS, store.end)
  assert.equal(grade('adaptive', ctx(), mean.toFixed(2)), undefined)
  assert.ok(grade('adaptive', ctx(), (mean + 0.5).toFixed(2)))
  // Changing a setting inside the window invalidates it.
  run(5, { adaptive: { threshold: 0.72 } })
  assert.match(grade('adaptive', ctx(), mean.toFixed(2))!, /no setting changes/)
})

test('the programming practical needs a complete, accurate review and the widest window', async () => {
  const { thresholds, bestContact } = await import('../src/sim/field')
  const { makeSubject } = await import('../src/sim/model')
  const { store } = session()
  const subject = makeSubject(7)
  const ctx = (review: Record<number, { benefit?: number | null; side?: number | null; pulseWidth: number }>) => ({
    store,
    viewEnd: store.end,
    montage: 'Sandwich pairs' as const,
    captures: {},
    review,
    seed: 7,
  })
  const truthful = Object.fromEntries(
    [0, 1, 2, 3].map((c) => {
      const t = thresholds(subject, 'L', c, 60)
      return [c, { benefit: t.benefit, side: t.sideEffect, pulseWidth: 60 }]
    }),
  )
  const best = String(bestContact(subject, 'L', 60))
  assert.match(grade('programming', ctx({ 0: truthful[0] }), best)!, /contact 1/)
  assert.equal(grade('programming', ctx(truthful), best), undefined)
  assert.ok(grade('programming', ctx(truthful), best === '0' ? '3' : '0'))
  const sloppy = { ...truthful, 1: { ...truthful[1], benefit: (truthful[1].benefit ?? 2) + 1 } }
  assert.match(grade('programming', ctx(sloppy), best)!, /Re-test contact 1/)
})

test('the tremor practical measures the contralateral VIM peak during posture', async () => {
  const { peak, welch } = await import('../src/dsp/spectrum')
  const { store, run } = session()
  run(10, { disorder: 'tremor' })
  const ctx = () => ({ store, viewEnd: store.end, montage: 'Sandwich pairs' as const, captures: {} })
  assert.match(grade('beyond', ctx(), '5.5')!, /holding the right arm/)
  run(10, { movement: 'right' })
  const hz = peak(welch(store.range(store.end - 8 * FS, store.end, rowNamed('L 0–2')!), 512), 3, 12).hz
  assert.equal(grade('beyond', ctx(), hz.toFixed(1)), undefined)
  assert.ok(grade('beyond', ctx(), (hz + 2).toFixed(1)))
})
