/**
 * Patient assessment: three virtual patients the learner has not met, graded against the
 * simulator's hidden ground truth. Every answer here can be measured with the course's tools;
 * where the truth sits on a boundary, both neighbouring answers are accepted.
 */
import { SEGMENTS, SEGMENT_ANGLE, betaWeight, contactZ, makeSubject, type Side } from '../sim/model'
import { SEGMENT_FACING } from '../dsp/directional'

export const CASES = 3
export const PASS_CASES = 2
export const PEAK_TOLERANCE_HZ = 1.5
export const PAIRS = ['0–1', '1–2', '2–3'] as const
/** The side every question asks about. */
export const SIDE: Side = 'L'

/** Assessment patients use their own seed range, far from the lesson patients (which start at 7). */
export const caseSeed = (attempt: number, index: number) => 9001 + attempt * CASES + index

export interface Answers {
  pair: string
  peak: string
  segment: string
}
export interface Truth {
  /** Adjacent pairs whose expected beta is within 80% of the largest: both when the edge sits near a contact. */
  pairs: string[]
  peak: number
  /** The nearest segment, and its neighbour too when the source points close to between them. */
  segments: string[]
  angle: number
  border: number
}
export interface CaseResult {
  seed: number
  answers: Answers
  truth: Truth
  pair: boolean
  peak: boolean
  segment: boolean
  passed: boolean
}

export const segmentLabel = (g: number) => `${SEGMENTS[g]} · ${SEGMENT_FACING[g]}`

export function truthFor(seed: number, side: Side = SIDE): Truth {
  const s = makeSubject(seed)
  const border = s.border[side],
    angle = s.betaAngle[side]
  const diff = PAIRS.map((_, c) => Math.abs(betaWeight(contactZ(c), border) - betaWeight(contactZ(c + 1), border)))
  const best = Math.max(...diff)
  const dist = SEGMENT_ANGLE.map((a) => Math.abs(((a - angle + 540) % 360) - 180))
  const nearest = Math.min(...dist)
  return {
    pairs: PAIRS.filter((_, c) => diff[c] >= 0.8 * best),
    peak: s.betaHz[side],
    segments: SEGMENTS.filter((_, g) => dist[g] === nearest || dist[g] <= 75),
    angle,
    border,
  }
}

export function gradeCase(seed: number, answers: Answers): CaseResult {
  const truth = truthFor(seed)
  const peak = Number(answers.peak)
  const pair = truth.pairs.includes(answers.pair),
    peakOk = answers.peak.trim() !== '' && Number.isFinite(peak) && Math.abs(peak - truth.peak) <= PEAK_TOLERANCE_HZ,
    segment = truth.segments.includes(answers.segment)
  return { seed, answers, truth, pair, peak: peakOk, segment, passed: pair && peakOk && segment }
}

export interface AssessmentState {
  attempt: number
  results: CaseResult[]
}
export const passedAssessment = (s: AssessmentState) => s.results.filter((r) => r.passed).length >= PASS_CASES
