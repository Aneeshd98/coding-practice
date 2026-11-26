import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { REAL_PAIRS, badContacts, compareConditions, loadRecording } from '../src/dsp/recording'

// Serve the files in public/ the way the app fetches them.
const fetcher = async (url: string) => {
  const body = await readFile(new URL('../public/' + url, import.meta.url))
  return new Response(body)
}

test('the real recording loads and matches its manifest', async () => {
  const rec = await loadRecording('', fetcher)
  const m = rec.manifest
  const samples = (m.window_s[1] - m.window_s[0]) * m.fs
  for (const c of ['off', 'on'] as const) assert.equal(rec.data[c].length, samples * m.channels.length)
  assert.deepEqual(badContacts(m, 'L', [0, 2]), [0])
  assert.deepEqual(badContacts(m, 'L', [2, 3]), [])
})

test('the lesson’s claims hold for the real data', async () => {
  const rec = await loadRecording('', fetcher)
  // The clearest OFF peaks, and a fall ON to about 0.6x, are on L 2–3 and R 0–1.
  for (const [side, pair] of [
    ['L', [2, 3]],
    ['R', [0, 1]],
  ] as const) {
    const r = compareConditions(rec, side, pair as [number, number])
    assert.ok(r.off.clear, `${side} ${pair} has a clear OFF peak`)
    assert.ok(r.off.peakHz > 24 && r.off.peakHz < 29, `${side} ${pair} peak ${r.off.peakHz}`)
    assert.ok(r.ratio > 0.5 && r.ratio < 0.75, `${side} ${pair} ON/OFF ${r.ratio}`)
  }
  // Usable pairs without a clear OFF peak change little.
  for (const side of ['L', 'R'] as const)
    for (const pair of REAL_PAIRS) {
      if (badContacts(rec.manifest, side, pair).length) continue
      const r = compareConditions(rec, side, pair)
      if (!r.off.clear) assert.ok(r.ratio > 0.8 && r.ratio < 1.25, `${side} ${pair} ON/OFF ${r.ratio.toFixed(2)} without a clear peak`)
    }
})
