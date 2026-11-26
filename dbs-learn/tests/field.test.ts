import test from 'node:test'
import assert from 'node:assert/strict'
import { makeSubject } from '../src/sim/model'
import { bestContact, radius, reached, response } from '../src/sim/field'

const seeds = [7, 8, 11, 23, 42, 57, 99]

test('the field grows with amplitude and charge per pulse', () => {
  assert.ok(radius(2, 60) > radius(1, 60))
  assert.ok(radius(2, 90) > radius(2, 60))
  assert.equal(radius(0, 60), 0)
})

test('relief rises with amplitude and side effects appear only beyond some amplitude', () => {
  for (const seed of seeds) {
    const s = makeSubject(seed)
    for (let c = 0; c < 4; c++) {
      let previous = -1
      for (let mA = 0.5; mA <= 5; mA += 0.5) {
        const r = response(s, 'L', c, mA)
        assert.ok(r.benefit >= previous - 1e-9)
        previous = r.benefit
      }
      assert.equal(response(s, 'L', c, 0.3).effects.length, 0, `seed ${seed} contact ${c}`)
    }
  }
})

test('upper contacts reach the internal capsule at lower amplitudes than deep ones', () => {
  const capsuleAt = (seed: number, c: number) => {
    const s = makeSubject(seed)
    for (let k = 1; k <= 80; k++) if (reached('L', s.border.L, c, k / 10).some((p) => p.id === 'capsule')) return k / 10
    return Infinity
  }
  for (const seed of seeds) assert.ok(capsuleAt(seed, 3) < capsuleAt(seed, 0), `seed ${seed}`)
})

test('short pulses raise the capsule threshold proportionally more than the benefit threshold', () => {
  // Scan beyond the 5 mA clinical ceiling: this checks the mechanism, not a clinical test.
  const scan = (seed: number, c: number, pw: number) => {
    const s = makeSubject(seed)
    let benefit = Infinity,
      capsule = Infinity
    for (let k = 1; k <= 120; k++) {
      const mA = k / 10
      if (benefit === Infinity && response(s, 'L', c, mA, pw).benefit >= 0.5) benefit = mA
      if (capsule === Infinity && reached('L', s.border.L, c, mA, pw).some((p) => p.id === 'capsule')) capsule = mA
    }
    return { benefit, capsule }
  }
  let checked = 0
  for (const seed of seeds)
    for (let c = 0; c < 4; c++) {
      const a = scan(seed, c, 60),
        b = scan(seed, c, 30)
      if (![a.benefit, a.capsule, b.benefit, b.capsule].every(Number.isFinite)) continue
      checked++
      assert.ok(b.capsule / b.benefit > a.capsule / a.benefit, `seed ${seed} contact ${c}`)
    }
  assert.ok(checked >= 8, String(checked))
})

test('the best contact differs between patients', () => {
  const picks = new Set(seeds.map((seed) => bestContact(makeSubject(seed), 'L')))
  assert.ok(picks.size >= 2, [...picks].join(','))
})
