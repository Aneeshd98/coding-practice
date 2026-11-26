import { useState } from 'react'
import { useLab } from '../app/lab'
import { lessons, moduleOf, type Lesson as LessonType, type Tool } from '../course/content'
import { exercises, grade } from '../course/practicals'
import { LeadView } from './LeadView'
import { BurstPanel, MovementPanel, SensingPanel, SpectrumPanel, StimPanel } from './panels'

type Pane = 'Guide' | 'Experiment' | 'Checkpoint'

export function ToolView({ tool, wide = false, highRange = false }: { tool: Tool; wide?: boolean; highRange?: boolean }) {
  switch (tool) {
    case 'lead':
      return wide ? <LeadView /> : null
    case 'sensing':
      return <SensingPanel />
    case 'spectrum':
      return <SpectrumPanel upTo={highRange ? 125 : 60} />
    case 'bursts':
      return <BurstPanel />
    case 'movement':
      return <MovementPanel />
    case 'stim':
      return <StimPanel />
  }
}

function Practical({ lesson, passed, onPass }: { lesson: LessonType; passed: boolean; onPass: () => void }) {
  const l = useLab()
  const module = moduleOf(lesson.id)
  const ex = exercises[module.id]
  const [answer, setAnswer] = useState('')
  const [status, setStatus] = useState('')
  if (passed)
    return (
      <div className="practical passed">
        <b>Module practical passed.</b> {ex.takeaway}
      </div>
    )
  return (
    <div className="practical">
      <div className="eyebrow">Module practical · graded from your recording</div>
      <ol>
        {ex.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <label>
        {ex.question}
        {ex.choices ? (
          <select value={answer} onChange={(e) => (setAnswer(e.target.value), setStatus(''))}>
            <option value="">Choose…</option>
            {ex.choices.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        ) : (
          <input
            type="number"
            step="any"
            value={answer}
            placeholder={ex.unit}
            onChange={(e) => (setAnswer(e.target.value), setStatus(''))}
          />
        )}
      </label>
      <button
        className="btn"
        onClick={() => {
          const result = grade(module.id, { store: l.signals, viewEnd: l.viewEnd(), montage: l.montage, captures: l.captures }, answer)
          setStatus(result ?? '')
          if (!result) onPass()
        }}
      >
        Verify practical
      </button>
      {status && (
        <p role="status" className="status">
          {status}
        </p>
      )}
    </div>
  )
}

export function LessonView({
  lesson,
  done,
  passed,
  onComplete,
  onPass,
}: {
  lesson: LessonType
  done: boolean
  passed: boolean
  onComplete: () => void
  onPass: () => void
}) {
  const [pane, setPane] = useState<Pane>('Guide')
  const [choice, setChoice] = useState<number | null>(null)
  const [checked, setChecked] = useState(false)
  const module = moduleOf(lesson.id)
  const last = module.lessons.at(-1) === lesson
  const correct = checked && choice === lesson.correct
  const next = lessons[lessons.indexOf(lesson) + 1]
  return (
    <section className="panel lesson" aria-label="Lesson">
      <div className="tabs" role="tablist">
        {(['Guide', 'Experiment', 'Checkpoint'] as Pane[]).map((p) => (
          <button key={p} role="tab" aria-selected={pane === p} onClick={() => setPane(p)}>
            {p}
          </button>
        ))}
      </div>
      {pane === 'Guide' && (
        <div className="pane">
          <div className="eyebrow">Why it happens</div>
          {lesson.explain.map((p) => (
            <p key={p}>{p}</p>
          ))}
          <div className="eyebrow">Try it</div>
          <ol>
            {lesson.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <button className="btn primary" onClick={() => setPane('Experiment')}>
            Open experiment
          </button>
          <details>
            <summary>Further reading</summary>
            <ul className="reading">
              {lesson.sources.map((s) => (
                <li key={s.title}>
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}
      <div className="pane" hidden={pane !== 'Experiment'}>
        {lesson.tools.map((t) => (
          <ToolView key={t} tool={t} highRange={lesson.tools.includes('stim')} />
        ))}
        <button className="btn" onClick={() => setPane('Checkpoint')}>
          Go to checkpoint
        </button>
      </div>
      {pane === 'Checkpoint' && (
        <div className="pane">
          <h3>{lesson.task}</h3>
          <div className="answers">
            {lesson.options.map((o, i) => (
              <button
                key={o}
                aria-pressed={choice === i}
                onClick={() => {
                  setChoice(i)
                  setChecked(false)
                }}
              >
                <span>{String.fromCharCode(65 + i)}</span>
                {o}
              </button>
            ))}
          </div>
          <button className="btn" disabled={choice === null} onClick={() => setChecked(true)}>
            Check answer
          </button>
          {checked && (
            <div className={'feedback ' + (correct ? 'ok' : 'retry')} role="status">
              <b>{correct ? 'Correct' : 'Take another look'}</b>
              <p>{correct ? lesson.feedback : lesson.hint}</p>
            </div>
          )}
          {last && <Practical lesson={lesson} passed={passed} onPass={onPass} />}
          <div className="row">
            {done ? (
              <>
                <span className="chip">Lesson complete</span>
                <a className="btn primary" href={next ? '#/lesson/' + next.id : '#/map'}>
                  {next ? 'Next lesson' : 'View progress'}
                </a>
              </>
            ) : (
              <button className="btn primary" disabled={!correct || (last && !passed)} onClick={onComplete}>
                Complete lesson
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
