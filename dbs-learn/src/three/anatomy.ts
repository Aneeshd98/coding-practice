/**
 * Schematic deep-brain anatomy and DBS lead geometry, in millimetres in an
 * MNI-like frame: x right, y anterior, z superior, origin near the anterior
 * commissure. Positions and sizes are rounded textbook values for teaching.
 * They are not an atlas and must not be used for targeting.
 */
import { CONTACTS, PITCH_MM, type Side } from '../sim/model'

export type Vec3 = [number, number, number]

export interface Nucleus {
  id: string
  name: string
  short: string
  color: string
  /** Right-hemisphere centre; the left is mirrored in x. */
  centre: Vec3
  radii: Vec3
  /** Unit vectors for the ellipsoid's three axes (right hemisphere). */
  axes?: [Vec3, Vec3, Vec3]
  /** Optional tube centreline (caudate) with per-point radius. */
  path?: { at: Vec3; r: number }[]
}

const norm = (v: Vec3): Vec3 => {
  const n = Math.hypot(...v) || 1
  return [v[0] / n, v[1] / n, v[2] / n]
}
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k]
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/** Orthonormal frame whose first axis is `long`, keeping the third axis near `up`. */
function frame(long: Vec3, up: Vec3 = [0, 0, 1]): [Vec3, Vec3, Vec3] {
  const a = norm(long)
  const b = norm(cross(up, a))
  return [a, b, cross(a, b)]
}

// The STN is a biconvex lens whose long axis runs from anteromedial-ventral to posterolateral-dorsal.
const STN_AXES = frame([0.5, -0.82, 0.28])

export const NUCLEI: Nucleus[] = [
  { id: 'thalamus', name: 'Thalamus', short: 'Thal', color: '#c9b8e8', centre: [11, -18, 7], radii: [15, 8, 9], axes: frame([-0.22, 1, 0.05]) },
  { id: 'putamen', name: 'Putamen', short: 'Put', color: '#7fb8e6', centre: [25, 1, 1], radii: [15, 6, 10], axes: frame([0.1, 1, 0]) },
  { id: 'gpe', name: 'Globus pallidus externus', short: 'GPe', color: '#86d3c3', centre: [20, -3, -1], radii: [10, 3.5, 7], axes: frame([0.15, 1, 0]) },
  { id: 'gpi', name: 'Globus pallidus internus', short: 'GPi', color: '#4fb7a3', centre: [16, -6, -3], radii: [7.5, 2.8, 5], axes: frame([0.2, 1, 0]) },
  { id: 'stn', name: 'Subthalamic nucleus', short: 'STN', color: '#f2a65a', centre: [12, -13, -4], radii: [6.5, 3.4, 2.8], axes: STN_AXES },
  { id: 'rn', name: 'Red nucleus', short: 'RN', color: '#e86f6f', centre: [5, -20, -8], radii: [3.2, 3.2, 3.6] },
  { id: 'sn', name: 'Substantia nigra', short: 'SN', color: '#6b6f86', centre: [10, -17, -11], radii: [9, 4.5, 1.6], axes: frame([0.45, -0.85, 0.12]) },
  { id: 'vim', name: 'Ventral intermediate nucleus (thalamus)', short: 'VIM', color: '#b48ef0', centre: [14, -18, 2], radii: [3.5, 3, 4] },
  {
    id: 'caudate',
    name: 'Caudate nucleus',
    short: 'Cd',
    color: '#9fc2f2',
    centre: [14, 0, 14],
    radii: [1, 1, 1],
    path: [
      { at: [12, 17, 7], r: 6.5 },
      { at: [14, 6, 14], r: 5.2 },
      { at: [16, -8, 18], r: 3.6 },
      { at: [19, -22, 18], r: 2.6 },
      { at: [25, -32, 10], r: 1.8 },
      { at: [29, -30, -2], r: 1.3 },
    ],
  },
]

export const mirror = (v: Vec3, side: Side): Vec3 => (side === 'L' ? [-v[0], v[1], v[2]] : v)
export const nucleus = (id: string) => NUCLEI.find((n) => n.id === id)!

/** Unit direction from the target up the lead: about 60° above the AC–PC line and 15° lateral. */
export function leadDirection(side: Side): Vec3 {
  const sagittal = (60 * Math.PI) / 180,
    lateral = (15 * Math.PI) / 180
  const d = norm([Math.tan(lateral) * Math.sin(sagittal), Math.cos(sagittal), Math.sin(sagittal)])
  return mirror(d, side)
}

/** Point where a line through `p` along `d` leaves the ellipsoid on the `+d` side. */
export function exitPoint(n: Nucleus, side: Side, p: Vec3, d: Vec3): Vec3 {
  const c = mirror(n.centre, side)
  const axes = (n.axes ?? [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ]).map((a) => mirror(a as Vec3, side)) as [Vec3, Vec3, Vec3]
  const rel = [p[0] - c[0], p[1] - c[1], p[2] - c[2]] as Vec3
  // Solve |(rel + t d) in the ellipsoid frame / radii|² = 1 for the larger root.
  let A = 0,
    B = 0,
    C = -1
  axes.forEach((axis, i) => {
    const pr = dot(rel, axis) / n.radii[i],
      dr = dot(d, axis) / n.radii[i]
    A += dr * dr
    B += 2 * pr * dr
    C += pr * pr
  })
  const t = (-B + Math.sqrt(Math.max(0, B * B - 4 * A * C))) / (2 * A)
  return add(p, scale(d, t))
}

export interface LeadGeometry {
  side: Side
  direction: Vec3
  /** Where the lead leaves the dorsal surface of the STN: the edge of the beta generator. */
  edge: Vec3
  contacts: Vec3[]
  tip: Vec3
  top: Vec3
}

export type Target = 'stn' | 'gpi' | 'vim'
/** Aim points within each target: dorsolateral STN, posteroventral GPi, and the VIM itself. */
const AIM: Record<Target, Vec3> = { stn: [1, -1, 0.6], gpi: [0.5, -2, -1.5], vim: [0, 0, 0] }

/** Places a lead so that the generator edge sits `border` mm above contact 0, as in the signal model. */
export function leadGeometry(side: Side, border: number, target: Target = 'stn'): LeadGeometry {
  const n = nucleus(target)
  const direction = leadDirection(side)
  const aim = add(mirror(n.centre, side), mirror(AIM[target], side))
  const edge = exitPoint(n, side, aim, direction)
  const first = add(edge, scale(direction, -border))
  const contacts = Array.from({ length: CONTACTS }, (_, c) => add(first, scale(direction, c * PITCH_MM)))
  return {
    side,
    direction,
    edge,
    contacts,
    tip: add(first, scale(direction, -2.25)),
    top: add(first, scale(direction, 78)),
  }
}

