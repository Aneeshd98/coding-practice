/**
 * Progress lives in this browser's local storage. Export and import move it between
 * browsers or devices as a small JSON file; there is no server.
 */
import { lessons, modules } from '../course/content'
import { CASES, caseSeed, gradeCase, type AssessmentState } from '../course/assessment'

export const APP = 'subthalamic-lab'
export const VERSION = 1
const PREFIX = 'dbs-learn.'

export interface Progress {
  done: string[]
  passed: string[]
  predictions: Record<string, number>
  assessment: AssessmentState
  seed: number
}
export interface ProgressFile {
  app: typeof APP
  version: number
  exported: string
  progress: Progress
}

const read = (key: string): unknown => {
  try {
    return JSON.parse(localStorage.getItem(PREFIX + key) ?? 'null')
  } catch {
    return null
  }
}

export function exportProgress(now = new Date()): ProgressFile {
  const v = validate({ app: APP, version: VERSION, progress: { done: read('done'), passed: read('passed'), predictions: read('predictions'), assessment: read('assessment'), seed: read('seed') } }, true)
  return { app: APP, version: VERSION, exported: now.toISOString(), progress: (v as { progress: Progress }).progress }
}

/**
 * Checks an imported file and returns clean progress, or a message saying what is wrong.
 * Unknown lesson and module ids are dropped, so a file from an older course still imports.
 * With `lenient`, missing or malformed fields fall back to empty values instead of failing.
 */
export function validate(file: unknown, lenient = false): { progress: Progress } | { error: string } {
  if (!file || typeof file !== 'object') return { error: 'This is not a progress file.' }
  const f = file as Record<string, unknown>
  if (f.app !== APP) return { error: 'This file was not exported from Subthalamic Lab.' }
  if (typeof f.version !== 'number' || f.version > VERSION) return { error: 'This progress file is from a newer version of the course.' }
  const p = (f.progress ?? {}) as Record<string, unknown>
  const ids = (v: unknown, known: string[], name: string) => {
    if (!Array.isArray(v) || !v.every((x) => typeof x === 'string')) {
      if (lenient || v === undefined) return []
      throw new Error(`The ${name} list is malformed.`)
    }
    return [...new Set(v.filter((x) => known.includes(x)))]
  }
  try {
    const lessonIds = lessons.map((l) => l.id)
    const predictions: Record<string, number> = {}
    if (p.predictions && typeof p.predictions === 'object')
      for (const [k, v] of Object.entries(p.predictions)) {
        const lesson = lessons.find((l) => l.id === k)
        if (lesson?.predict && Number.isInteger(v) && (v as number) >= 0 && (v as number) < lesson.predict.options.length) predictions[k] = v as number
      }
    // Assessment results are re-graded from each patient's seed and the answers given, never trusted as stored.
    const a = p.assessment as { attempt?: unknown; results?: unknown } | null | undefined
    const assessment: AssessmentState = { attempt: 0, results: [] }
    if (a && typeof a === 'object' && Number.isInteger(a.attempt) && (a.attempt as number) >= 0 && Array.isArray(a.results)) {
      assessment.attempt = a.attempt as number
      for (const [i, r] of a.results.slice(0, CASES).entries()) {
        const answers = (r as { answers?: Record<string, unknown> })?.answers
        const fields = ['pair', 'peak', 'segment'] as const
        if ((r as { seed?: unknown })?.seed !== caseSeed(assessment.attempt, i) || !answers || !fields.every((k) => typeof answers[k] === 'string')) break
        assessment.results.push(gradeCase(caseSeed(assessment.attempt, i), { pair: answers.pair as string, peak: answers.peak as string, segment: answers.segment as string }))
      }
    }
    return {
      progress: {
        done: ids(p.done, lessonIds, 'completed lessons'),
        passed: ids(p.passed, modules.map((m) => m.id), 'passed practicals'),
        predictions,
        assessment,
        seed: Number.isInteger(p.seed) && (p.seed as number) > 0 && (p.seed as number) < 9000 ? (p.seed as number) : 7,
      },
    }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/** Replace this browser's progress with an imported one. */
export function applyProgress(progress: Progress) {
  for (const [key, value] of Object.entries(progress)) localStorage.setItem(PREFIX + key, JSON.stringify(value))
}
