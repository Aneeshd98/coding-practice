import { FS, Generator, type ConfigPatch, type Movement } from './model'

let gen = new Generator(7)
let running = true,
  last = performance.now(),
  carry = 0

type Protocol = { total: number; done: number; next: number; moving: boolean; hand: Movement; fast: boolean }
let protocol: Protocol | null = null
const REST = 3 * FS,
  MOVE = 2 * FS

function post(message: unknown, transfer: Transferable[] = []) {
  ;(self as unknown as Worker).postMessage(message, transfer)
}
function emit(count: number) {
  if (count <= 0) return
  const start = gen.sample,
    data = gen.block(count)
  post({ type: 'block', start, data, marks: gen.marks, states: gen.states }, [data.buffer])
  gen.marks = []
  gen.states = []
}
function status() {
  post({ type: 'protocol', status: protocol ? { done: protocol.done, total: protocol.total } : null })
}
function advance(count: number) {
  let remaining = count
  while (remaining > 0 && protocol) {
    if (gen.sample >= protocol.next) {
      if (protocol.moving) {
        gen.configure({ movement: 'rest' })
        gen.mark('Stop cue', 'move')
        protocol.moving = false
        protocol.done++
        protocol.next = gen.sample + REST
        status()
        if (protocol.done === protocol.total) {
          protocol = null
          status()
          break
        }
      } else {
        gen.configure({ movement: protocol.hand })
        gen.mark('Move cue · ' + protocol.hand + ' hand', 'cue')
        protocol.moving = true
        protocol.next = gen.sample + MOVE
      }
    }
    if (!protocol) break
    const step = Math.min(remaining, protocol.next - gen.sample)
    emit(step)
    remaining -= step
  }
  emit(remaining)
}

self.onmessage = (event: MessageEvent) => {
  const m = event.data
  if (m.type === 'init') {
    gen = new Generator(m.seed ?? 7, m.config ?? {})
    protocol = null
    post({ type: 'subject', subject: gen.subject })
    emit(4 * FS)
    last = performance.now()
    carry = 0
  } else if (m.type === 'config') {
    gen.configure(m.patch as ConfigPatch, m.label)
  } else if (m.type === 'pause') {
    running = !m.value
    last = performance.now()
    carry = 0
  } else if (m.type === 'protocol') {
    if (m.start) {
      gen.configure({ movement: 'rest' })
      gen.mark('Cued movement task begins', 'action')
      protocol = { total: m.cycles ?? 12, done: 0, next: gen.sample + REST, moving: false, hand: m.hand ?? 'right', fast: !!m.fast }
      running = true
    } else {
      protocol = null
      gen.configure({ movement: 'rest' }, 'Cued movement task stopped')
    }
    status()
  }
}

setInterval(() => {
  const now = performance.now()
  if (running) {
    if (protocol?.fast) {
      advance(8 * FS)
    } else {
      // A suspended tab must not replay minutes of acquisition in one burst.
      carry += (Math.min(2000, now - last) * FS) / 1000
      const n = Math.min(500, Math.floor(carry))
      carry -= n
      advance(n)
    }
  }
  last = now
}, 40)
