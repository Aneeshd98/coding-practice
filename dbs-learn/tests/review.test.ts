import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { reviewPack } from '../src/course/review'
import { lessons } from '../src/course/content'

test('the committed clinical review pack matches the course (run npm run review-pack)', () => {
  const manifest = JSON.parse(readFileSync(new URL('../public/recordings/ds004998-sub-2IhVOz.json', import.meta.url), 'utf8'))
  const pack = reviewPack(manifest)
  assert.equal(readFileSync(new URL('../docs/clinical-review.md', import.meta.url), 'utf8'), pack)
  for (const l of lessons) assert.ok(pack.includes(l.task), `${l.id} checkpoint is in the pack`)
})
