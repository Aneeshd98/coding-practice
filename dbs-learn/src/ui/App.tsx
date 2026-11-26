import { useEffect, useRef, useState } from 'react'
import { ArrowRight, AudioWaveform, Cable, ClipboardCheck, Download, Upload, Gauge, Globe2, SlidersVertical, ChevronRight, CircleCheck, FlaskConical, GraduationCap, Layers3, PanelsTopLeft, Waves, Zap } from 'lucide-react'
import { LabProvider, load, store, useLab } from '../app/lab'
import { lessons, modules, moduleOf, type ModuleId, type Tool } from '../course/content'
import { LessonView, ModuleOutline, ToolView } from './Lesson'
import { BrainPanel } from './BrainPanel'
import { PatientBar } from './panels'
import { Assessment, loadAssessment } from './Assessment'
import { CASES, passedAssessment } from '../course/assessment'
import { applyProgress, exportProgress, validate } from '../app/progress'
import { Traces } from './Traces'

const route = () => window.location.hash.replace(/^#\/?/, '').split('/')
const moduleIcon: Record<ModuleId, typeof Zap> = { sensing: Cable, beta: AudioWaveform, bursts: Waves, stim: Zap, programming: SlidersVertical, adaptive: Gauge, beyond: Globe2 }
const pad = (n: number) => String(n).padStart(2, '0')

export function Mark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 20 20">
        <rect x="8.6" y="1" width="2.8" height="18" rx="1.4" fill="#dbe4ff" />
        {[11.5, 14, 16.5].map((y) => (
          <rect key={y} x="7.8" y={y - 0.9} width="4.4" height="1.8" rx="0.6" fill="#9fb2ff" />
        ))}
        <rect x="7.8" y="8.1" width="4.4" height="1.8" rx="0.6" fill="#ffb020" />
        <circle cx="10" cy="9" r="5" fill="none" stroke="#ffb020" strokeOpacity="0.45" />
      </svg>
    </span>
  )
}

function Instrument() {
  return (
    <>
      <PatientBar />
      <div className="instrument">
        <BrainPanel />
        <Traces />
      </div>
    </>
  )
}

function Ring({ value, total }: { value: number; total: number }) {
  const r = 46,
    c = 2 * Math.PI * r
  return (
    <svg className="ring" width="120" height="120" viewBox="0 0 120 120" role="img" aria-label={`${value} of ${total} lessons complete`}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--line-2)" strokeWidth="10" />
      {value > 0 && (
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--primary)" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(c * value) / total} ${c}`} transform="rotate(-90 60 60)" />
      )}
      <text x="60" y="58" textAnchor="middle" fontFamily="var(--display)" fontSize="26" fontWeight="600" fill="var(--ink)">
        {value}
      </text>
      <text x="60" y="78" textAnchor="middle" fontFamily="var(--mono)" fontSize="11" fill="var(--muted)">
        of {total} lessons
      </text>
    </svg>
  )
}

function CourseMap({ done, passed, resume }: { done: string[]; passed: string[]; resume: string }) {
  return (
    <>
      <div className="hero">
        <div>
          <div className="eyebrow">Learning path</div>
          <h1>Course map</h1>
          <p>Seven modules take you from a single contact pair to programming, closed-loop stimulation and other disorders. Each ends with a practical graded from your own recording.</p>
        </div>
      </div>
      <div className="map-grid">
        <div className="modules">
          {modules.map((m, i) => {
            const Icon = moduleIcon[m.id]
            const n = m.lessons.filter((l) => done.includes(l.id)).length
            return (
              <article key={m.id} className="card module-card">
                <div className="module-top">
                  <span className="icon-tile">
                    <Icon size={20} />
                  </span>
                  <div>
                    <small>
                      Module {pad(i + 1)} · {n}/{m.lessons.length} {passed.includes(m.id) && '· practical passed'}
                    </small>
                    <h2>{m.title}</h2>
                  </div>
                </div>
                <p>{m.summary}</p>
                <div className="bar">
                  <i style={{ width: (100 * n) / m.lessons.length + '%' }} />
                </div>
                <ol>
                  {m.lessons.map((l, j) => (
                    <li key={l.id}>
                      <a href={'#/lesson/' + l.id}>
                        <span className={'node' + (done.includes(l.id) ? ' done' : '')}>{done.includes(l.id) ? <CircleCheck size={13} /> : j + 1}</span>
                        {l.title}
                        <ChevronRight size={15} color="var(--muted)" />
                      </a>
                    </li>
                  ))}
                </ol>
              </article>
            )
          })}
        </div>
        <aside className="card record">
          <h2>Your learning record</h2>
          <Ring value={done.length} total={lessons.length} />
          <div className="metrics">
            <div className="metric">
              <small>Practicals</small>
              <b>
                {passed.length}
                <em>/ {modules.length}</em>
              </b>
            </div>
            <div className="metric">
              <small>Modules</small>
              <b>
                {modules.filter((m) => m.lessons.every((l) => done.includes(l.id))).length}
                <em>/ {modules.length}</em>
              </b>
            </div>
          </div>
          <AssessmentStatus />
          <a className="btn primary" href={'#/lesson/' + resume} style={{ width: '100%', justifyContent: 'center' }}>
            {done.length === lessons.length ? 'Revisit lessons' : 'Resume learning'} <ArrowRight size={15} />
          </a>
          <ProgressTransfer />
        </aside>
      </div>
    </>
  )
}

/** Move progress between browsers as a file: GitHub Pages has no server to keep it. */
function ProgressTransfer() {
  const input = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')
  const save = () => {
    const file = exportProgress()
    const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `subthalamic-lab-progress-${file.exported.slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const open = async (f: File) => {
    let parsed: unknown
    try {
      parsed = JSON.parse(await f.text())
    } catch {
      return setMessage('That file is not valid JSON.')
    }
    const r = validate(parsed)
    if ('error' in r) return setMessage(r.error)
    if (!window.confirm(`Replace this browser’s progress with the file’s (${r.progress.done.length} lessons complete)?`)) return
    applyProgress(r.progress)
    window.location.reload()
  }
  return (
    <div className="transfer">
      <div className="row">
        <button className="btn" onClick={save}>
          <Download size={15} /> Export progress
        </button>
        <button className="btn" onClick={() => input.current?.click()}>
          <Upload size={15} /> Import
        </button>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          hidden
          aria-label="Progress file to import"
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) void open(f)
          }}
        />
      </div>
      <small>Progress is saved in this browser only. Export it to continue on another device.</small>
      {message && (
        <p role="alert" className="status">
          {message}
        </p>
      )}
    </div>
  )
}

function AssessmentStatus() {
  const a = loadAssessment()
  const done = a.results.length >= CASES
  return (
    <a className="assess-status" href="#/assess">
      <ClipboardCheck size={16} />
      <span>
        <b>Patient assessment</b>
        <small>
          {done
            ? (passedAssessment(a) ? 'Passed' : 'Not passed') + ` · ${a.results.filter((r) => r.passed).length} of ${CASES} patients`
            : a.results.length
              ? `In progress · patient ${a.results.length + 1} of ${CASES}`
              : 'Three unseen patients'}
        </small>
      </span>
      <ChevronRight size={15} />
    </a>
  )
}

const allTools: Tool[] = ['spectrum', 'adaptive', 'review', 'directional', 'chronic', 'tremor', 'bursts', 'stim', 'movement', 'sensing']

function Workspace() {
  const l = useLab()
  const [path, setPath] = useState(route)
  const [done, setDone] = useState<string[]>(() => load('done', [] as string[]))
  const [passed, setPassed] = useState<string[]>(() => load('passed', [] as string[]))
  useEffect(() => {
    const on = () => {
      setPath(route())
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const page = path[0] || 'lesson'
  const resume = (lessons.find((x) => !done.includes(x.id)) ?? lessons[0]).id
  const lesson = lessons.find((x) => x.id === path[1]) ?? lessons.find((x) => x.id === resume)!
  const module = moduleOf(lesson.id)
  useEffect(() => {
    // Pin the resolved lesson in the URL so completing it does not jump to the next one.
    if (page === 'lesson' && path[1] !== lesson.id) {
      window.history.replaceState(null, '', '#/lesson/' + lesson.id)
      setPath(route())
    }
  }, [page, path, lesson.id])
  useEffect(() => {
    // Each lesson declares its patient's condition; the course default is Parkinson's disease.
    // Wait for the patient: on first load the simulation starts after this effect and would reset it.
    if ((page !== 'lesson' && page !== 'assess') || !l.subject) return
    const wanted = page === 'assess' ? 'pd' : (lesson.disorder ?? 'pd')
    if (l.config.disorder !== wanted) l.change({ disorder: wanted }, 'Condition for this lesson: ' + wanted)
    // Only on entering a lesson or when a new patient starts: the learner may change the condition afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, lesson.id, lesson.disorder, l.subject])
  useEffect(() => {
    document.title = (page === 'map' ? 'Course map' : page === 'lab' ? 'Free lab' : page === 'assess' ? 'Patient assessment' : lesson.title) + ' · Subthalamic Lab'
  }, [page, lesson])
  const add = (list: string[], set: (v: string[]) => void, key: string, id: string) => {
    if (list.includes(id)) return
    const next = [...list, id]
    set(next)
    store(key, next)
  }
  const nav = [
    { id: 'lesson', label: 'Learning studio', icon: PanelsTopLeft, href: '#/lesson/' + lesson.id },
    { id: 'map', label: 'Course map', icon: Layers3, href: '#/map' },
    { id: 'lab', label: 'Free lab', icon: FlaskConical, href: '#/lab' },
    { id: 'assess', label: 'Assessment', icon: ClipboardCheck, href: '#/assess' },
  ]
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href={'#/lesson/' + resume}>
            <Mark />
            <span className="word">
              Subthalamic <b>Lab</b>
            </span>
          </a>
          <nav className="nav" aria-label="Main">
            {nav.map((n) => (
              <a key={n.id} href={n.href} aria-current={page === n.id ? 'page' : undefined}>
                <n.icon size={16} />
                <span>{n.label}</span>
              </a>
            ))}
          </nav>
          <div className="topbar-right">
            <div className="progress-mini">
              <GraduationCap size={16} />
              <b>
                {done.length}/{lessons.length}
              </b>
              lessons
            </div>
          </div>
        </div>
      </header>
      <main>
        {page === 'map' ? (
          <CourseMap done={done} passed={passed} resume={resume} />
        ) : page === 'assess' ? (
          <>
            <div className="hero">
              <div>
                <div className="eyebrow">Check your skills</div>
                <h1>Patient assessment</h1>
                <p>Three virtual patients you have not met. Find each one’s beta contacts, peak frequency and beta direction from the recording alone. Answers are graded against the simulator’s hidden truth.</p>
              </div>
            </div>
            <Instrument />
            <Assessment />
          </>
        ) : page === 'lab' ? (
          <>
            <div className="hero">
              <div>
                <div className="eyebrow">Independent practice</div>
                <h1>Free lab</h1>
                <p>Every instrument at once. Change medication, movement and stimulation, and watch the STN and its recording respond.</p>
              </div>
            </div>
            <Instrument />
            <div className="tools-grid">
              {allTools.map((t) => (
                <ToolView key={t} tool={t} highRange={t === 'spectrum'} />
              ))}
            </div>
          </>
        ) : (
          <>
            <nav className="crumbs" aria-label="Breadcrumb">
              <span>DBS sensing</span>
              <ChevronRight size={13} />
              <span>{module.title}</span>
              <ChevronRight size={13} />
              <strong>Lesson {pad(module.lessons.indexOf(lesson) + 1)}</strong>
            </nav>
            <div className="hero">
              <div>
                <div className="eyebrow">
                  Module {pad(modules.indexOf(module) + 1)} · {module.title} · Lesson {pad(module.lessons.indexOf(lesson) + 1)}
                </div>
                <h1>{lesson.title}</h1>
                <p>{lesson.intro}</p>
              </div>
              <div className="hero-side">
                <div className="bar-label">
                  Course progress
                  <b>
                    {done.length} / {lessons.length}
                  </b>
                </div>
                <div className="bar">
                  <i style={{ width: (100 * done.length) / lessons.length + '%' }} />
                </div>
              </div>
            </div>
            <Instrument />
            <div className="learning">
              <LessonView
                key={lesson.id}
                lesson={lesson}
                done={done.includes(lesson.id)}
                passed={passed.includes(module.id)}
                onComplete={() => {
                  add(done, setDone, 'done', lesson.id)
                  l.tell('Lesson complete')
                }}
                onPass={() => add(passed, setPassed, 'passed', module.id)}
              />
              <ModuleOutline lesson={lesson} done={done} />
            </div>
          </>
        )}
      </main>
      <footer className="site-foot">
        <span>A teaching simulation of subthalamic local field potentials. Not a model of any device; not for clinical decisions or programming.</span>
        <span style={{ display: 'flex', gap: 16 }}>
          <a href={import.meta.env.BASE_URL + 'anatomy/ATTRIBUTION.txt'} target="_blank" rel="noreferrer">
            Anatomy credits
          </a>
          <a href={import.meta.env.BASE_URL + 'THIRD-PARTY.txt'} target="_blank" rel="noreferrer">
            Software licences
          </a>
        </span>
      </footer>
      {l.notice && (
        <div className="toast" role="status">
          <CircleCheck size={16} />
          {l.notice}
        </div>
      )}
    </>
  )
}

export default function App() {
  return (
    <LabProvider>
      <Workspace />
    </LabProvider>
  )
}
