import { useState } from 'react'
import { ArrowRight, BookOpen, Check, CheckCircle2, CircleAlert, ClipboardCheck, FlaskConical, GraduationCap, LayoutGrid, ListTree } from 'lucide-react'
import { useLab } from '../app/lab'
import { lessons, moduleOf, modules, practicalLesson, type Lesson as LessonType, type Tool } from '../course/content'
import { exercises, grade } from '../course/practicals'
import { AdaptivePanel, BurstPanel, ChronicPanel, ReviewPanel, TremorPanel, MovementPanel, SensingPanel, SpectrumPanel, StimPanel } from './panels'

type Pane = 'Guide' | 'Experiment' | 'Checkpoint'

export function ToolView({ tool, highRange = false }: { tool: Tool; highRange?: boolean }) {
  switch (tool) {
    case 'lead':
      return null
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
    case 'adaptive':
      return <AdaptivePanel />
    case 'review':
      return <ReviewPanel />
    case 'chronic':
      return <ChronicPanel />
    case 'tremor':
      return <TremorPanel />
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
        <div className="eyebrow plain">
          <CheckCircle2 size={14} /> Module practical passed
        </div>
        <p style={{ margin: 0 }}>{ex.takeaway}</p>
      </div>
    )
  return (
    <div className="practical">
      <div className="eyebrow plain">
        <FlaskConical size={14} /> Module practical · graded from your recording
      </div>
      <ol className="steps">
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
          <input type="number" step="any" value={answer} placeholder={ex.unit} onChange={(e) => (setAnswer(e.target.value), setStatus(''))} />
        )}
      </label>
      <button
        className="btn primary"
        onClick={() => {
          const result = grade(module.id, { store: l.signals, viewEnd: l.viewEnd(), montage: l.montage, captures: l.captures, review: l.review, seed: l.subject?.seed }, answer)
          setStatus(result ?? '')
          if (!result) onPass()
        }}
      >
        <ClipboardCheck size={15} /> Verify practical
      </button>
      {status && (
        <p role="status" className="status">
          {status}
        </p>
      )}
    </div>
  )
}

export function LessonView({ lesson, done, passed, onComplete, onPass }: { lesson: LessonType; done: boolean; passed: boolean; onComplete: () => void; onPass: () => void }) {
  const [pane, setPane] = useState<Pane>('Guide')
  const [choice, setChoice] = useState<number | null>(null)
  const [checked, setChecked] = useState(false)
  const module = moduleOf(lesson.id)
  const last = practicalLesson(module) === lesson
  const correct = checked && choice === lesson.correct
  const next = lessons[lessons.indexOf(lesson) + 1]
  const icons = { Guide: BookOpen, Experiment: FlaskConical, Checkpoint: GraduationCap }
  return (
    <section className="card lesson" aria-label="Lesson workspace">
      <div className="tabs" role="tablist">
        {(['Guide', 'Experiment', 'Checkpoint'] as Pane[]).map((p) => {
          const Icon = icons[p]
          return (
            <button key={p} role="tab" aria-selected={pane === p} onClick={() => setPane(p)}>
              <Icon size={16} />
              {p}
            </button>
          )
        })}
      </div>
      {pane === 'Guide' && (
        <div className="pane">
          <div className="eyebrow">Guided activity</div>
          <h3>{lesson.title}</h3>
          <ol className="steps">
            {lesson.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <div className="concept">
            <h4>Why it happens</h4>
            {lesson.explain.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
          <div className="row">
            <button className="btn primary" onClick={() => setPane('Experiment')}>
              <FlaskConical size={15} /> Open experiment
            </button>
            <button className="btn" onClick={() => setPane('Checkpoint')}>
              Try checkpoint
            </button>
          </div>
          <details className="reading">
            <summary>Further reading</summary>
            <ul>
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
        {lesson.tools
          .filter((t) => t !== 'lead')
          .map((t) => (
            <ToolView key={t} tool={t} highRange={lesson.tools.includes('stim')} />
          ))}
        {lesson.tools.includes('lead') && (
          <p className="note">Use the brain model above: switch to Target view to see the contacts inside the STN, and reveal the beta region when you are ready to check.</p>
        )}
        <div className="row">
          <button className="btn" onClick={() => setPane('Checkpoint')}>
            <GraduationCap size={15} /> Go to checkpoint
          </button>
        </div>
      </div>
      {pane === 'Checkpoint' && (
        <div className="pane">
          <div className="eyebrow">Knowledge check</div>
          <h3 className="question">{lesson.task}</h3>
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
            <div className={'feedback ' + (correct ? '' : 'retry')} role="status">
              {correct ? <CheckCircle2 size={20} /> : <CircleAlert size={20} />}
              <div>
                <b>{correct ? 'Correct' : 'Take another look'}</b>
                <p>{correct ? lesson.feedback : lesson.hint}</p>
              </div>
            </div>
          )}
          {last && <Practical lesson={lesson} passed={passed} onPass={onPass} />}
          <div className="row">
            {done ? (
              <>
                <span className="done-chip">
                  <CheckCircle2 size={17} /> Lesson complete
                </span>
                <a className="btn primary" href={next ? '#/lesson/' + next.id : '#/map'}>
                  {next ? 'Next lesson' : 'View progress'} <ArrowRight size={15} />
                </a>
              </>
            ) : (
              <button className="btn primary" disabled={!correct || (last && !passed)} onClick={onComplete}>
                <Check size={15} /> Complete lesson
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

export function ModuleOutline({ lesson, done }: { lesson: LessonType; done: string[] }) {
  const module = moduleOf(lesson.id)
  const index = modules.indexOf(module)
  return (
    <aside className="card outline" aria-label="Module outline">
      <header className="card-head">
        <div className="card-title">
          <span className="icon-tile">
            <ListTree size={16} />
          </span>
          <h2>Module outline</h2>
        </div>
        <span className="tag">
          {String(index + 1).padStart(2, '0')} / {String(modules.length).padStart(2, '0')}
        </span>
      </header>
      <h3 className="module-name">{module.title}</h3>
      <p className="module-sum">{module.summary}</p>
      <ol>
        {module.lessons.map((s, i) => (
          <li key={s.id}>
            <a href={'#/lesson/' + s.id} aria-current={s === lesson ? 'step' : undefined}>
              <span className={'node' + (done.includes(s.id) ? ' done' : '')}>{done.includes(s.id) ? <Check size={13} /> : i + 1}</span>
              {s.title}
            </a>
          </li>
        ))}
      </ol>
      <a className="outline-link" href="#/map">
        <LayoutGrid size={15} /> View full course
      </a>
    </aside>
  )
}
