/** Writes docs/clinical-review.md from the course. Run with `npm run review-pack`. */
import { readFileSync, writeFileSync } from 'node:fs'
import { reviewPack } from '../src/course/review'

const manifest = JSON.parse(readFileSync(new URL('../public/recordings/ds004998-sub-2IhVOz.json', import.meta.url), 'utf8'))
const out = new URL('../docs/clinical-review.md', import.meta.url)
writeFileSync(out, reviewPack(manifest))
console.log('wrote', out.pathname)
