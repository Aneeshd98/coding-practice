import { useEffect, useState } from 'react'
import { ArrowRight, CheckCircle2, CircleAlert, ClipboardCheck, RotateCcw, Stethoscope } from 'lucide-react'
import { load, store, useLab } from '../app/lab'
import { CASES, PAIRS, PASS_CASES, PEAK_TOLERANCE_HZ, caseSeed, gradeCase, passedAssessment, segmentLabel, type Answers, type AssessmentState, type CaseResult } from '../course/assessment'
import { SEGMENTS } from '../sim/model'
import { ToolView } from './Lesson'

const EMPTY: Answers = { pair: '', peak: '', segment: '' }
export const loadAssessment = () => load<AssessmentState>('assessment', { attempt: 0, results: [] })

function Steps({ results, current }: { results: CaseResult[]; current: number }) {
  return (
    <ol className="case-steps" aria-label="Assessment patients">
      {Array.from({ length: CASES }, (_, i) => {
        const r = results[i]
        const state = r ? (r.passed ? 'passed' : 'failed') : i === current ? 'current' : 'waiting'
        return (
          <li key={i} className={state} aria-current={i === current ? 'step' : undefined}>
            <span>{r ? r.passed ? <CheckCircle2 size={14} /> : <CircleAlert size={14} /> : i + 1}</span>
            Patient {i + 1}
          </li>
        )
      })}
    </ol>
  )
}

function ResultRows({ r }: { r: CaseResult }) {
  const row = (ok: boolean, label: string, yours: string, truth: string) => (
    <div className={'result-row' + (ok ? ' ok' : '')}>
      {ok ? <CheckCircle2 size={16} /> : <CircleAlert size={16} />}
      <div>
        <b>{label}</b>
        <span>
          You: {yours || '—'} · {truth}
        </span>
      </div>
    </div>
  )
  const t = r.truth
  return (
    <div className="results">
      {row(r.pair, 'Beta pair', r.answers.pair && 'L ' + r.answers.pair, `accepted ${t.pairs.map((p) => 'L ' + p).join(' or ')} (edge ${t.border.toFixed(1)} mm above contact 0)`)}
      {row(r.peak, 'Beta peak', r.answers.peak && r.answers.peak + ' Hz', `true ${t.peak.toFixed(1)} Hz, ±${PEAK_TOLERANCE_HZ} Hz accepted`)}
      {row(r.segment, 'Beta direction', r.answers.segment && 'segment ' + r.answers.segment, `accepted ${t.segments.join(' or ')} (source at ${t.angle}°)`)}
    </div>
  )
}

export function Assessment() {
  const l = useLab()
  const [state, setState] = useState(loadAssessment)
  const [answers, setAnswers] = useState<Answers>(EMPTY)
  // The case just graded stays on screen, with its patient loaded, until the learner moves on.
  const [graded, setGraded] = useState<CaseResult | null>(null)
  const index = state.results.length
  const finished = index >= CASES
  const seed = graded?.seed ?? (finished ? null : caseSeed(state.attempt, index))
  const { setExamSeed } = l
  useEffect(() => setExamSeed(seed), [seed, setExamSeed])
  // Leaving the page brings back the learner's lesson patient.
  useEffect(() => () => setExamSeed(null), [setExamSeed])

  const save = (next: AssessmentState) => {
    setState(next)
    store('assessment', next)
  }
  const ready = seed !== null && l.subject?.seed === seed
  const complete = answers.pair && answers.peak.trim() && answers.segment
  const passedCount = state.results.filter((r) => r.passed).length

  return (
    <div className="learning assessment">
      <div className="card assess-tools">
        <div className="pane">
          <div className="eyebrow">Measure</div>
          <p className="note" style={{ marginTop: 0 }}>
            Medication OFF, stimulation off, at rest. Use Adjacent pairs to compare the left pairs, read the left beta peak, then switch to a directional lead and wait 8 seconds.
          </p>
          <ToolView tool="spectrum" />
          <ToolView tool="directional" />
        </div>
      </div>
      <aside className="card case-card" aria-label="Assessment questions">
        <header className="card-head">
          <div className="card-title">
            <span className="icon-tile">
              <Stethoscope size={16} />
            </span>
            <h2>Patient assessment</h2>
          </div>
          <span className="tag">Pass {PASS_CASES} of {CASES}</span>
        </header>
        <Steps results={state.results} current={graded ? index - 1 : index} />
        {graded ? (
          <div className="case-body">
            <div className={'feedback ' + (graded.passed ? '' : 'retry')} role="status">
              {graded.passed ? <CheckCircle2 size={20} /> : <CircleAlert size={20} />}
              <div>
                <b>{graded.passed ? 'Patient passed' : 'Not this time'}</b>
                <p>{graded.passed ? 'All three measurements matched the hidden truth.' : 'A patient passes when all three answers match.'}</p>
              </div>
            </div>
            <ResultRows r={graded} />
            <button
              className="btn primary"
              onClick={() => {
                setGraded(null)
                setAnswers(EMPTY)
              }}
            >
              {finished ? 'See result' : 'Next patient'} <ArrowRight size={15} />
            </button>
          </div>
        ) : finished ? (
          <div className="case-body">
            <div className={'feedback ' + (passedAssessment(state) ? '' : 'retry')} role="status">
              {passedAssessment(state) ? <CheckCircle2 size={20} /> : <CircleAlert size={20} />}
              <div>
                <b>{passedAssessment(state) ? 'Assessment passed' : 'Assessment not passed'}</b>
                <p>
                  {passedCount} of {CASES} patients passed; {PASS_CASES} are needed.
                </p>
              </div>
            </div>
            {state.results.map((r, i) => (
              <details key={i} className="case-detail">
                <summary>
                  Patient {i + 1} · {r.passed ? 'passed' : 'not passed'}
                </summary>
                <ResultRows r={r} />
              </details>
            ))}
            <button className="btn" onClick={() => save({ attempt: state.attempt + 1, results: [] })}>
              <RotateCcw size={15} /> Start again with new patients
            </button>
          </div>
        ) : (
          <form
            className="case-body"
            onSubmit={(e) => {
              e.preventDefault()
              const result = gradeCase(seed!, answers)
              save({ ...state, results: [...state.results, result] })
              setGraded(result)
            }}
          >
            <p className="note" style={{ marginTop: 0 }}>
              A patient you have not met. The β region stays hidden; answer for the <b>left</b> lead.
            </p>
            <fieldset>
              <legend>1 · Which left adjacent pair straddles the edge of the beta region?</legend>
              <div className="seg" role="group" aria-label="Beta pair">
                {PAIRS.map((p) => (
                  <button type="button" key={p} aria-pressed={answers.pair === p} onClick={() => setAnswers({ ...answers, pair: p })}>
                    L {p}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>2 · What is the left beta peak frequency?</legend>
              <label className="peak-input">
                <input type="number" step="0.1" min="5" max="40" inputMode="decimal" aria-label="Left beta peak frequency in hertz" value={answers.peak} onChange={(e) => setAnswers({ ...answers, peak: e.target.value })} />
                Hz
              </label>
            </fieldset>
            <fieldset>
              <legend>3 · With a directional lead, which left segment faces the beta source?</legend>
              <div className="answers compact">
                {SEGMENTS.map((g, i) => (
                  <button type="button" key={g} aria-pressed={answers.segment === g} onClick={() => setAnswers({ ...answers, segment: g })}>
                    <span>{g}</span>
                    {segmentLabel(i).split(' · ')[1]}
                  </button>
                ))}
              </div>
            </fieldset>
            <button className="btn primary" type="submit" disabled={!complete || !ready}>
              <ClipboardCheck size={15} /> Submit patient {index + 1}
            </button>
          </form>
        )}
      </aside>
    </div>
  )
}
