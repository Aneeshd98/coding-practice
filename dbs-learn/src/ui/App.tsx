import { useEffect, useState } from 'react'
import { LabProvider, load, store, useLab } from '../app/lab'
import { lessons, modules, moduleOf, type ModuleId, type Tool } from '../course/content'
import { LessonView, ToolView } from './Lesson'
import { LeadView } from './LeadView'
import { SubjectBar } from './panels'
import { Traces } from './Traces'

const route = () => window.location.hash.replace(/^#\/?/, '').split('/')

function Instrument() {
  return (
    <>
      <SubjectBar />
      <div className="instrument">
        <Traces />
        <LeadView />
      </div>
    </>
  )
}

function CourseMap({ done, passed }: { done: string[]; passed: string[] }) {
  return (
    <section className="map">
      <h1>Course map</h1>
      <p className="lede">
        {done.length} of {lessons.length} lessons complete · {passed.length} of {modules.length} practicals passed
      </p>
      <div className="modules">
        {modules.map((m, i) => (
          <article key={m.id} className="panel module">
            <div className="eyebrow">
              Module {i + 1} {passed.includes(m.id) && '· practical passed'}
            </div>
            <h2>{m.title}</h2>
            <p>{m.summary}</p>
            <ol>
              {m.lessons.map((l) => (
                <li key={l.id}>
                  <a href={'#/lesson/' + l.id}>
                    {done.includes(l.id) ? '✓ ' : ''}
                    {l.title}
                  </a>
                </li>
              ))}
            </ol>
          </article>
        ))}
      </div>
    </section>
  )
}

const allTools: Tool[] = ['spectrum', 'bursts', 'movement', 'stim', 'sensing']

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
  const lesson = lessons.find((x) => x.id === path[1]) ?? lessons.find((x) => !done.includes(x.id)) ?? lessons[0]
  const module = moduleOf(lesson.id)
  useEffect(() => {
    // Pin the resolved lesson in the URL so completing it does not jump to the next one.
    if (page === 'lesson' && path[1] !== lesson.id) {
      window.history.replaceState(null, '', '#/lesson/' + lesson.id)
      setPath(route())
    }
  }, [page, path, lesson.id])
  useEffect(() => {
    document.title = (page === 'map' ? 'Course map' : page === 'lab' ? 'Free lab' : lesson.title) + ' · Subthalamic Lab'
  }, [page, lesson])
  const add = (list: string[], set: (v: string[]) => void, key: string, id: string) => {
    if (list.includes(id)) return
    const next = [...list, id]
    set(next)
    store(key, next)
  }
  return (
    <>
      <header className="top">
        <a className="brand" href="#/lesson">
          Subthalamic <b>Lab</b>
        </a>
        <nav>
          <a href={'#/lesson/' + lesson.id} aria-current={page === 'lesson' ? 'page' : undefined}>
            Lessons
          </a>
          <a href="#/map" aria-current={page === 'map' ? 'page' : undefined}>
            Course map
          </a>
          <a href="#/lab" aria-current={page === 'lab' ? 'page' : undefined}>
            Free lab
          </a>
        </nav>
      </header>
      <main>
        {page === 'map' ? (
          <CourseMap done={done} passed={passed} />
        ) : page === 'lab' ? (
          <>
            <div className="hero">
              <h1>Free lab</h1>
              <p>Every instrument at once. Explore the virtual patient at your own pace.</p>
            </div>
            <Instrument />
            <div className="tools-grid">
              {allTools.map((t) => (
                <section key={t} className="panel">
                  <ToolView tool={t} wide />
                </section>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="hero">
              <div className="eyebrow">
                Module {modules.indexOf(module) + 1} · {module.title} · Lesson {module.lessons.indexOf(lesson) + 1} of{' '}
                {module.lessons.length}
              </div>
              <h1>{lesson.title}</h1>
              <p>{lesson.intro}</p>
            </div>
            <Instrument />
            <LessonView
              key={lesson.id}
              lesson={lesson}
              done={done.includes(lesson.id)}
              passed={passed.includes(module.id)}
              onComplete={() => {
                add(done, setDone, 'done', lesson.id)
                l.tell('Lesson complete')
              }}
              onPass={() => add(passed, setPassed, 'passed', module.id as ModuleId)}
            />
          </>
        )}
      </main>
      <footer>
        A teaching simulation of subthalamic local field potentials. It is not a model of any specific device and must not be used
        for clinical decisions or to choose stimulation settings.
      </footer>
      {l.notice && (
        <div className="toast" role="status">
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
