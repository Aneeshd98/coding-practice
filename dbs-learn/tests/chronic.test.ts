import test from 'node:test'
import assert from 'node:assert/strict'
import { makeSubject } from '../src/sim/model'
import { chronicDay, summarise } from '../src/sim/chronic'

const s = makeSubject(7)
const at = (points: ReturnType<typeof chronicDay>, hour: number) => points.find((p) => Math.abs(p.hour - hour) < 1e-6)!

test('beta dips after each dose and rises before the next (wearing off)', () => {
  const day = chronicDay(s, 'L', [7, 11, 15, 19])
  for (const dose of [11, 15, 19]) {
    assert.ok(at(day, dose - 1 / 6).beta > at(day, dose + 1).beta + 0.15, `dose ${dose}`)
    assert.ok(at(day, dose - 1 / 6).beta > at(day, dose - 2).beta, `rising before ${dose}`)
  }
})

test('beta is lower during sleep than in the untreated morning', () => {
  const day = chronicDay(s, 'L', [7, 11, 15, 19])
  assert.ok(at(day, 3).beta < 0.7 * at(day, 7).beta)
})

test('fewer doses mean more under-treated hours; more doses bring peak-dose gamma', () => {
  const three = summarise(chronicDay(s, 'L', [7, 13, 19])),
    four = summarise(chronicDay(s, 'L', [7, 11, 15, 19])),
    five = summarise(chronicDay(s, 'L', [7, 10, 13, 16, 19]))
  assert.ok(three.offHours > four.offHours && four.offHours > five.offHours)
  assert.equal(four.dyskinesiaHours, 0)
  assert.ok(five.dyskinesiaHours > 0)
})
