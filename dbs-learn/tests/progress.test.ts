import test from 'node:test'
import assert from 'node:assert/strict'
import { APP, VERSION, validate } from '../src/app/progress'
import { caseSeed, gradeCase, truthFor } from '../src/course/assessment'

const file = (progress: unknown, extra = {}) => ({ app: APP, version: VERSION, exported: '2026-01-01T00:00:00Z', progress, ...extra })

test('a progress file round-trips, dropping unknown ids and invalid predictions', () => {
  const r = validate(file({ done: ['lead-anatomy', 'no-such-lesson', 'lead-anatomy'], passed: ['sensing', 'nope'], predictions: { 'stim-beta': 1, 'stim-beta-x': 0, 'close-the-loop': 9 }, seed: 12 }))
  assert.ok('progress' in r)
  assert.deepEqual(r.progress.done, ['lead-anatomy'])
  assert.deepEqual(r.progress.passed, ['sensing'])
  assert.deepEqual(r.progress.predictions, { 'stim-beta': 1 })
  assert.equal(r.progress.seed, 12)
})

test('files from another app, a newer version or with malformed lists are refused', () => {
  assert.ok('error' in validate(null))
  assert.ok('error' in validate({ app: 'other', version: 1, progress: {} }))
  assert.ok('error' in validate(file({}, { version: VERSION + 1 })))
  assert.ok('error' in validate(file({ done: 'lead-anatomy' })))
})

test('imported assessment results are re-graded, so an edited pass does not count', () => {
  const seed = caseSeed(0, 0)
  const wrong = gradeCase(seed, { pair: '', peak: '1', segment: '' })
  const forged = { ...wrong, passed: true }
  const truth = truthFor(caseSeed(0, 1))
  const right = { seed: caseSeed(0, 1), answers: { pair: truth.pairs[0], peak: String(truth.peak), segment: truth.segments[0] } }
  const r = validate(file({ assessment: { attempt: 0, results: [forged, right] } }))
  assert.ok('progress' in r)
  assert.equal(r.progress.assessment.results.length, 2)
  assert.equal(r.progress.assessment.results[0].passed, false)
  assert.equal(r.progress.assessment.results[1].passed, true)
  // A result for a different patient than the attempt's is not accepted.
  const other = validate(file({ assessment: { attempt: 1, results: [right] } }))
  assert.ok('progress' in other && other.progress.assessment.results.length === 0)
})
