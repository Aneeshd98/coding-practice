/**
 * Teaching model of a monopolar review: how far stimulation spreads from one contact,
 * how much of the motor STN it covers (benefit), and when it reaches neighbouring
 * pathways (side effects). Distances and constants are illustrative. This is not a
 * validated volume-of-tissue-activated model and must not guide real programming.
 */
import { CONTACTS, type Side, type Subject } from './model'
import { leadGeometry, mirror, nucleus, type Vec3 } from '../three/anatomy'

export interface Pathway {
  id: 'capsule' | 'oculomotor'
  name: string
  effect: string
  centre: Vec3
  radii: Vec3
  /** Chronaxie (µs) of the elements activated: larger values are spared more by short pulses. */
  chronaxie: number
}

/** Corticospinal and corticobulbar fibres of the internal capsule run lateral and anterior to the STN. */
export const PATHWAYS: Pathway[] = [
  { id: 'capsule', name: 'Internal capsule', effect: 'Muscle contraction (face or hand)', centre: [17.6, -11, -1], radii: [2.2, 9, 8], chronaxie: 120 },
  { id: 'oculomotor', name: 'Oculomotor fibres', effect: 'Eye deviation or double vision', centre: [10.3, -15.2, -7.2], radii: [1.5, 3.5, 2.5], chronaxie: 120 },
]
const BENEFIT_CHRONAXIE = 40
const K = 1.9

/** Radius (mm) within which elements of the given chronaxie are activated. */
export function radius(mA: number, pulseWidth: number, chronaxie = BENEFIT_CHRONAXIE) {
  return mA > 0 ? K * Math.sqrt(mA / (1 + chronaxie / pulseWidth)) : 0
}

const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

/** Shortest distance from a point to an axis-aligned ellipsoid surface, sampled. */
function ellipsoidDistance(p: Vec3, centre: Vec3, radii: Vec3) {
  let best = Infinity
  for (let i = 0; i < 24; i++)
    for (let j = 0; j < 48; j++) {
      const th = (Math.PI * (i + 0.5)) / 24,
        ph = (2 * Math.PI * j) / 48
      const q: Vec3 = [
        centre[0] + radii[0] * Math.sin(th) * Math.cos(ph),
        centre[1] + radii[1] * Math.sin(th) * Math.sin(ph),
        centre[2] + radii[2] * Math.cos(th),
      ]
      best = Math.min(best, dist(p, q))
    }
  return best
}

/** Sample points in the dorsolateral motor STN: within 3.5 mm below the generator edge. */
function motorPoints(side: Side, border: number) {
  const stn = nucleus('stn'),
    g = leadGeometry(side, border)
  const c = mirror(stn.centre, side)
  const axes = stn.axes!.map((a) => mirror(a, side))
  const points: Vec3[] = []
  for (let a = -1; a <= 1; a += 0.1)
    for (let b = -1; b <= 1; b += 0.2)
      for (let d = -1; d <= 1; d += 0.2) {
        if (a * a + b * b + d * d > 1) continue
        const p: Vec3 = [0, 1, 2].map((k) => c[k] + a * stn.radii[0] * axes[0][k] + b * stn.radii[1] * axes[1][k] + d * stn.radii[2] * axes[2][k]) as Vec3
        const s = (p[0] - g.edge[0]) * g.direction[0] + (p[1] - g.edge[1]) * g.direction[1] + (p[2] - g.edge[2]) * g.direction[2]
        if (s <= 0 && s > -3.5) points.push(p)
      }
  return points
}

export interface Response {
  /** Fraction (0–1) of rigidity relieved. */
  benefit: number
  effects: Pathway[]
  radius: number
}

const cache = new Map<string, { points: Vec3[]; distances: number[][] }>()
function geometry(side: Side, border: number) {
  const key = side + border.toFixed(4)
  let g = cache.get(key)
  if (!g) {
    const lead = leadGeometry(side, border)
    g = {
      points: motorPoints(side, border),
      distances: lead.contacts.map((c) => PATHWAYS.map((p) => ellipsoidDistance(c, mirror(p.centre, side), p.radii))),
    }
    cache.set(key, g)
  }
  return g
}

/** Pathways reached from a contact at this amplitude and pulse width. */
export function reached(side: Side, border: number, contact: number, mA: number, pulseWidth = 60) {
  const g = geometry(side, border)
  return PATHWAYS.filter((p, i) => radius(mA, pulseWidth, p.chronaxie) >= g.distances[contact][i])
}

export function response(subject: Subject, side: Side, contact: number, mA: number, pulseWidth = 60): Response {
  const border = subject.border[side],
    g = geometry(side, border)
  const centre = leadGeometry(side, border).contacts[contact]
  const r = radius(mA, pulseWidth)
  const covered = g.points.filter((p) => dist(p, centre) <= r).length / Math.max(1, g.points.length)
  return { benefit: 1 - Math.exp(-covered / 0.18), effects: reached(side, border, contact, mA, pulseWidth), radius: r }
}

export const TEST_MAX = 5

export interface Thresholds {
  benefit: number | null
  sideEffect: number | null
  effect: string | null
  window: number | null
}

/** Lowest amplitudes (0.1 mA steps, up to TEST_MAX) giving at least half relief and the first side effect. */
export function thresholds(subject: Subject, side: Side, contact: number, pulseWidth = 60): Thresholds {
  let benefit: number | null = null,
    sideEffect: number | null = null,
    effect: string | null = null
  for (let k = 1; k <= TEST_MAX * 10; k++) {
    const mA = k / 10,
      r = response(subject, side, contact, mA, pulseWidth)
    if (benefit === null && r.benefit >= 0.5) benefit = mA
    if (sideEffect === null && r.effects.length) {
      sideEffect = mA
      effect = r.effects[0].effect
    }
  }
  return { benefit, sideEffect, effect, window: benefit !== null ? (sideEffect ?? TEST_MAX) - benefit : null }
}

/** The contact with the widest therapeutic window; ties go to the lower benefit threshold. */
export function bestContact(subject: Subject, side: Side, pulseWidth = 60) {
  const all = Array.from({ length: CONTACTS }, (_, c) => ({ c, t: thresholds(subject, side, c, pulseWidth) }))
  const usable = all.filter((x) => x.t.window !== null && x.t.window > 0)
  if (!usable.length) return null
  return usable.sort((a, b) => b.t.window! - a.t.window! || a.t.benefit! - b.t.benefit!)[0].c
}
