import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { SEGMENT_ANGLE, SIDES, type Side } from '../sim/model'
import { NUCLEI, add as add3, leadGeometry, mirror, nucleus, type LeadGeometry, type Nucleus, type Target, type Vec3 } from './anatomy'
import { PATHWAYS, radius, reached } from '../sim/field'

export type CortexMode = 'glass' | 'solid' | 'hidden'
export type ViewPreset = 'overview' | 'coronal' | 'sagittal' | 'target'

export interface SceneState {
  border: Record<Side, number> | null
  revealed: boolean
  /** Sensed contacts, and segments when a directional lane is selected. */
  sensing: { side: Side; parts: { contact: number; segment?: number }[] } | null
  lead: 'ring' | 'directional'
  /** Direction each side's beta source lies in, degrees from anterior toward lateral. */
  betaAngle: Record<Side, number> | null
  stimContact: Record<Side, number> | null
  pulseWidth: number
  target: Target
  cortex: CortexMode
  head: boolean
  view: ViewPreset
  targetSide: Side
  labels: boolean
}
export interface LiveSignals {
  beta: Record<Side, number>
  stim: Record<Side, number>
}
export interface Label {
  id: string
  text: string
  kind: 'nucleus' | 'contact' | 'edge' | 'stim'
  side?: Side
  world: THREE.Vector3
  el?: HTMLElement
}

const BETA = new THREE.Color('#ff4d8d')
const SENSE = new THREE.Color('#2ee6d6')
const STIM = new THREE.Color('#ffb020')

const glassVertex = /* glsl */ `
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vView = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}`
const glassFragment = /* glsl */ `
uniform vec3 base;
uniform vec3 rim;
uniform float opacity;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vec3 v = normalize(vView);
  vec3 n = dot(vNormal, vNormal) > 1e-10 ? normalize(vNormal) : v;
  float facing = abs(dot(n, v));
  float fresnel = pow(1.0 - facing, 2.4);
  float light = 0.35 + 0.65 * max(dot(n, normalize(vec3(-0.35, 0.75, 0.55))), 0.0);
  vec3 c = mix(base * light, rim, fresnel);
  gl_FragColor = vec4(c, opacity * (0.12 + 0.88 * fresnel));
}`

const nucleusVertex = /* glsl */ `
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vLocal;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vLocal = world.xyz;
  vec4 mv = viewMatrix * world;
  vNormal = normalize(normalMatrix * normal);
  vView = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}`
// Shaded nucleus with an optional beta-generator region below a plane and a live glow.
const nucleusFragment = /* glsl */ `
uniform vec3 color;
uniform vec3 glowColor;
uniform float glow;
uniform float split;
uniform vec3 planePoint;
uniform vec3 planeNormal;
uniform float opacity;
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vLocal;
void main() {
  vec3 v = normalize(vView);
  vec3 n = dot(vNormal, vNormal) > 1e-10 ? normalize(vNormal) : v;
  float key = max(dot(n, normalize(vec3(-0.4, 0.8, 0.45))), 0.0);
  float fill = max(dot(n, normalize(vec3(0.7, -0.2, 0.5))), 0.0);
  float fresnel = pow(1.0 - max(dot(n, v), 0.0), 2.0);
  vec3 c = color * (0.32 + 0.62 * key + 0.18 * fill) + fresnel * 0.22;
  float inside = 1.0;
  if (split > 0.5) {
    float s = dot(vLocal - planePoint, planeNormal);
    inside = 1.0 - smoothstep(-0.15, 0.15, s);
    c = mix(c, mix(c, vec3(0.62, 0.26, 0.42), 0.55), inside);
    c += vec3(1.0, 0.75, 0.9) * (1.0 - smoothstep(0.0, 0.22, abs(s))) * 0.6;
  }
  c += glowColor * glow * inside * (0.55 + 0.45 * fresnel);
  gl_FragColor = vec4(c, opacity);
}`

const vtaFragment = /* glsl */ `
uniform float time;
uniform float strength;
uniform vec3 color;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vec3 n = dot(vNormal, vNormal) > 1e-10 ? normalize(vNormal) : normalize(vView);
  float fresnel = pow(1.0 - abs(dot(n, normalize(vView))), 1.6);
  float pulse = 0.72 + 0.28 * sin(time * 9.0);
  gl_FragColor = vec4(color * (0.6 + fresnel), strength * (0.1 + 0.55 * fresnel) * pulse);
}`

function taperedTube(points: { at: Vec3; r: number }[], side: Side) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...mirror(p.at, side))))
  const segments = 96,
    radial = 28
  const frames = curve.computeFrenetFrames(segments, false)
  const radius = (u: number) => {
    const x = u * (points.length - 1),
      i = Math.min(points.length - 2, Math.floor(x))
    return points[i].r + (points[i + 1].r - points[i].r) * (x - i)
  }
  const pos: number[] = [],
    idx: number[] = []
  for (let i = 0; i <= segments; i++) {
    const u = i / segments,
      c = curve.getPointAt(u),
      r = radius(u)
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2
      const p = c
        .clone()
        .addScaledVector(frames.normals[i], Math.cos(a) * r)
        .addScaledVector(frames.binormals[i], Math.sin(a) * r)
      pos.push(p.x, p.y, p.z)
    }
  }
  for (let i = 0; i < segments; i++)
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j,
        b = a + radial + 1
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return { geometry: g, ends: [curve.getPointAt(0), curve.getPointAt(1)], radii: [points[0].r, points.at(-1)!.r] }
}

function ellipsoid(n: Nucleus, side: Side) {
  const g = new THREE.SphereGeometry(1, 48, 32)
  const axes = (n.axes ?? [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ]).map((a) => new THREE.Vector3(...mirror(a as Vec3, side)))
  // Mirroring reverses handedness; flip one axis so triangles keep their winding.
  if (side === 'L') axes[1].negate()
  const m = new THREE.Matrix4().makeBasis(axes[0], axes[1], axes[2])
  m.multiply(new THREE.Matrix4().makeScale(...n.radii))
  m.setPosition(...mirror(n.centre, side))
  g.applyMatrix4(m)
  return g
}

interface LeadParts {
  group: THREE.Group
  shaft: THREE.Mesh
  /** One mesh per ring contact, three per segmented level. */
  contacts: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>[][]
  arrow: THREE.Group
  vta: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>
  ring: THREE.Mesh
  geometry: LeadGeometry
}

export class BrainScene {
  readonly canvas: HTMLCanvasElement
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(32, 1, 1, 3000)
  private controls: OrbitControls
  private root = new THREE.Group()
  private brain = new THREE.Group()
  private glass: THREE.ShaderMaterial[] = []
  private solid: THREE.MeshStandardMaterial[] = []
  private parts: THREE.Mesh[] = []
  private scalp: THREE.Mesh | null = null
  private nuclei = new Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>>()
  private pathways = new Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>>()
  private leads: Partial<Record<Side, LeadParts>> = {}
  private state: SceneState | null = null
  private tween: { from: [THREE.Vector3, THREE.Vector3]; to: [THREE.Vector3, THREE.Vector3]; start: number } | null = null
  private clock = new THREE.Clock()
  private frame = 0
  private dirty = true
  private lastRender = 0
  private lastTick = 0
  /** Smoothed interval between animation frames: the page's real responsiveness. */
  private gap = 16
  private slowSince = 0
  private reduced = false
  private visible = true
  private observer: IntersectionObserver
  private resizer: ResizeObserver
  labels: Label[] = []
  labelRoot: HTMLElement | null = null
  private labelKey = ''
  live: () => LiveSignals = () => ({ beta: { L: 0, R: 0 }, stim: { L: 0, R: 0 } })
  onLabels: (labels: Label[]) => void = () => {}
  onReady: () => void = () => {}

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(1.75, window.devicePixelRatio || 1))
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.canvas = this.renderer.domElement
    this.canvas.className = 'brain-canvas'
    host.appendChild(this.canvas)
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    pmrem.dispose()
    this.scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x2a3346, 1.1))
    const key = new THREE.DirectionalLight(0xffffff, 1.6)
    key.position.set(-1, 2, 1.5)
    this.scene.add(key)
    // MNI millimetres (z superior, y anterior) into three.js world (y up).
    this.root.rotation.x = -Math.PI / 2
    this.scene.add(this.root)
    this.root.add(this.brain)
    this.controls = new OrbitControls(this.camera, this.canvas)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.minDistance = 14
    this.controls.maxDistance = 650
    this.controls.rotateSpeed = 0.7
    this.controls.zoomSpeed = 0.8
    this.controls.addEventListener('start', () => (this.tween = null))
    this.controls.addEventListener('change', () => (this.dirty = true))
    this.buildNuclei()
    this.resizer = new ResizeObserver(() => this.resize())
    this.resizer.observe(host)
    this.observer = new IntersectionObserver(([e]) => (this.visible = e.isIntersecting))
    this.observer.observe(host)
    this.resize()
    this.loop()
  }

  async load(url: string) {
    const [meta, bin] = await Promise.all([
      fetch(url + 'brain.json').then((r) => {
        if (!r.ok) throw new Error('Anatomy manifest unavailable')
        return r.json() as Promise<{ parts: { name: string; vertices: number; triangles: number; offset: number }[] }>
      }),
      fetch(url + 'brain.bin').then((r) => {
        if (!r.ok) throw new Error('Anatomy surfaces unavailable')
        return r.arrayBuffer()
      }),
    ])
    for (const part of meta.parts) {
      const q = new Int16Array(bin, part.offset, part.vertices * 3)
      const tris = new Uint32Array(bin.slice(part.offset + part.vertices * 6, part.offset + part.vertices * 6 + part.triangles * 12))
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(q, (v) => v / 64), 3))
      g.setIndex(new THREE.BufferAttribute(tris, 1))
      g.computeVertexNormals()
      const isScalp = part.name === 'scalp'
      const tint = part.name === 'cerebellum' ? '#a9b8f0' : part.name === 'brainstem' ? '#b8c4e6' : '#9fb6e0'
      const glass = new THREE.ShaderMaterial({
        vertexShader: glassVertex,
        fragmentShader: glassFragment,
        uniforms: {
          base: { value: new THREE.Color(isScalp ? '#7d8fb3' : tint) },
          rim: { value: new THREE.Color(isScalp ? '#b9c8ee' : '#e6efff') },
          opacity: { value: isScalp ? 0.22 : 0.55 },
        },
        transparent: true,
        depthWrite: false,
      })
      const mesh = new THREE.Mesh(g, glass)
      mesh.renderOrder = isScalp ? 3 : 2
      if (isScalp) {
        this.scalp = mesh
      } else {
        const solid = new THREE.MeshStandardMaterial({
          color: part.name === 'cerebellum' ? '#d7b6b6' : part.name === 'brainstem' ? '#d9c0b8' : '#e3c1bd',
          roughness: 0.78,
          metalness: 0,
          envMapIntensity: 0.35,
        })
        mesh.userData = { glass, solid }
        this.glass.push(glass)
        this.solid.push(solid)
        this.parts.push(mesh)
      }
      this.brain.add(mesh)
    }
    if (this.state) this.update(this.state, true)
    this.dirty = true
    this.onReady()
  }

  private buildNuclei() {
    for (const side of SIDES)
      for (const n of NUCLEI) {
        let geometry: THREE.BufferGeometry
        if (n.path) {
          const tube = taperedTube(n.path, side)
          const caps = tube.ends.map((p, i) => new THREE.SphereGeometry(tube.radii[i], 24, 16).translate(p.x, p.y, p.z))
          geometry = mergeGeometries([tube.geometry, ...caps])
        } else geometry = ellipsoid(n, side)
        const material = new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          vertexShader: nucleusVertex,
          fragmentShader: nucleusFragment,
          uniforms: {
            color: { value: new THREE.Color(n.color) },
            glowColor: { value: BETA.clone() },
            glow: { value: 0 },
            split: { value: 0 },
            planePoint: { value: new THREE.Vector3() },
            planeNormal: { value: new THREE.Vector3(0, 1, 0) },
            opacity: { value: 1 },
          },
        })
        const mesh = new THREE.Mesh(geometry, material)
        mesh.renderOrder = 5
        this.nuclei.set(side + n.id, mesh)
        this.root.add(mesh)
      }
    // Neighbouring pathways whose activation causes side effects; they turn red when the field reaches them.
    for (const side of SIDES)
      for (const p of PATHWAYS) {
        const g = new THREE.SphereGeometry(1, 40, 24).scale(...p.radii).translate(...mirror(p.centre, side))
        const material = new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          vertexShader: nucleusVertex,
          fragmentShader: nucleusFragment,
          uniforms: {
            color: { value: new THREE.Color(p.id === 'capsule' ? '#cfd9ee' : '#e6d38c') },
            glowColor: { value: new THREE.Color('#ff3b3b') },
            glow: { value: 0 },
            split: { value: 0 },
            planePoint: { value: new THREE.Vector3() },
            planeNormal: { value: new THREE.Vector3(0, 1, 0) },
            opacity: { value: 0.16 },
          },
        })
        const mesh = new THREE.Mesh(g, material)
        mesh.renderOrder = 6
        mesh.visible = false
        this.pathways.set(side + p.id, mesh)
        this.root.add(mesh)
      }
  }

  private buildLead(geometry: LeadGeometry, segmented: boolean, betaAngle?: number): LeadParts {
    const group = new THREE.Group()
    const dir = new THREE.Vector3(...geometry.direction)
    const up = new THREE.Vector3(0, 1, 0)
    const orient = (mesh: THREE.Object3D, at: Vec3) => {
      mesh.quaternion.setFromUnitVectors(up, dir)
      mesh.position.set(...at)
    }
    const tip = new THREE.Vector3(...geometry.tip),
      top = new THREE.Vector3(...geometry.top)
    const length = tip.distanceTo(top)
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.635, 0.635, length, 28, 1, true),
      new THREE.MeshPhysicalMaterial({ color: '#dfe8f5', roughness: 0.28, metalness: 0, clearcoat: 0.6, transparent: true, opacity: 0.92 }),
    )
    orient(shaft, tip.clone().lerp(top, 0.5).toArray() as Vec3)
    group.add(shaft)
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.635, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), shaft.material)
    orient(cap, geometry.tip)
    group.add(cap)
    // Directions around the lead: 0° anterior, increasing toward lateral (mirrored between sides).
    const anterior = new THREE.Vector3(0, 1, 0).projectOnPlane(dir).normalize()
    const lateral = new THREE.Vector3(geometry.side === 'R' ? 1 : -1, 0, 0).projectOnPlane(dir).projectOnPlane(anterior).normalize()
    const around = (deg: number) => {
      const r = (deg * Math.PI) / 180
      return anterior.clone().multiplyScalar(Math.cos(r)).addScaledVector(lateral, Math.sin(r))
    }
    const metal = () => new THREE.MeshStandardMaterial({ color: '#c9ced8', metalness: 1, roughness: 0.22, emissive: '#000000', side: THREE.DoubleSide })
    const contacts = geometry.contacts.map((c, i) => {
      if (!(segmented && (i === 1 || i === 2))) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.66, 1.5, 36, 1, true), metal())
        m.userData = { contact: i }
        orient(m, c)
        group.add(m)
        return [m]
      }
      // Three segments of about 100° each; CylinderGeometry's theta 0 lies along local +z.
      return SEGMENT_ANGLE.map((deg, g) => {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.665, 0.665, 1.5, 16, 1, true, -Math.PI * (50 / 180), Math.PI * (100 / 180)), metal())
        m.userData = { contact: i, segment: g }
        const z = around(deg),
          x = new THREE.Vector3().crossVectors(dir, z)
        m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, dir, z))
        m.position.set(...c)
        group.add(m)
        return m
      })
    })
    // Where the directional beta comes from, drawn between the two segmented levels.
    const arrow = new THREE.Group()
    const arrowMaterial = new THREE.MeshBasicMaterial({ color: BETA, transparent: true, opacity: 0.95, depthTest: false })
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.6, 10), arrowMaterial)
    stem.position.set(0, 1.3, 0)
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1, 16), arrowMaterial)
    head.position.set(0, 3.1, 0)
    arrow.add(stem, head)
    arrow.renderOrder = 8
    stem.renderOrder = head.renderOrder = 8
    if (betaAngle !== undefined) {
      const out = around(betaAngle)
      arrow.quaternion.setFromUnitVectors(up, out)
      arrow.position.copy(new THREE.Vector3(...geometry.contacts[1]).lerp(new THREE.Vector3(...geometry.contacts[2]), 0.5).addScaledVector(out, 0.9))
      arrow.userData.tip = arrow.position.clone().addScaledVector(out, 3.8).toArray()
    }
    arrow.visible = false
    group.add(arrow)
    const vta = new THREE.Mesh(
      new THREE.SphereGeometry(1, 40, 28),
      new THREE.ShaderMaterial({
        vertexShader: glassVertex,
        fragmentShader: vtaFragment,
        uniforms: { time: { value: 0 }, strength: { value: 0 }, color: { value: STIM.clone() } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )
    vta.renderOrder = 7
    vta.visible = false
    group.add(vta)
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.6, 0.09, 8, 64),
      new THREE.MeshBasicMaterial({ color: '#ff9cc4', transparent: true, opacity: 0.95, depthTest: false }),
    )
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir)
    ring.position.set(...geometry.edge)
    ring.renderOrder = 6
    group.add(ring)
    this.root.add(group)
    return { group, shaft, contacts, arrow, vta, ring, geometry }
  }

  private world(v: Vec3) {
    return new THREE.Vector3(...v).applyMatrix4(this.root.matrixWorld)
  }

  update(state: SceneState, force = false) {
    this.dirty = true
    const previous = this.state
    this.state = state
    this.root.updateMatrixWorld()
    const leadChanged =
      !previous?.border ||
      previous.border.L !== state.border?.L ||
      previous.border.R !== state.border?.R ||
      previous.target !== state.target ||
      previous.lead !== state.lead ||
      previous.betaAngle?.L !== state.betaAngle?.L ||
      previous.betaAngle?.R !== state.betaAngle?.R
    if (state.border && (force || leadChanged)) {
      for (const side of SIDES) {
        const old = this.leads[side]
        if (old) {
          this.root.remove(old.group)
          old.group.traverse((o) => {
            if (o instanceof THREE.Mesh) o.geometry.dispose()
          })
        }
        this.leads[side] = this.buildLead(leadGeometry(side, state.border[side], state.target), state.lead === 'directional', state.betaAngle?.[side])
      }
    }
    const mode = state.view === 'target' ? 'hidden' : state.cortex
    for (const part of this.parts) {
      part.visible = mode !== 'hidden'
      part.material = mode === 'solid' ? part.userData.solid : part.userData.glass
      part.renderOrder = mode === 'solid' ? 0 : 2
    }
    if (this.scalp) this.scalp.visible = state.head && state.view === 'overview'
    const target = state.view === 'target'
    for (const side of SIDES) {
      const lead = this.leads[side]
      if (!lead) continue
      lead.group.visible = !target || side === state.targetSide
      lead.ring.visible = state.revealed
      lead.arrow.visible = state.revealed && state.lead === 'directional'
      lead.contacts.flat().forEach((m) => {
        const { contact, segment } = m.userData as { contact: number; segment?: number }
        // A ring selection lights every segment of its level; a segment selection lights only that segment.
        const sensing =
          state.sensing?.side === side &&
          state.sensing.parts.some((p) => p.contact === contact && (p.segment === undefined || segment === undefined || p.segment === segment))
        const stim = state.stimContact?.[side] === contact
        m.material.emissive.copy(stim ? STIM : sensing ? SENSE : new THREE.Color(0))
        m.material.emissiveIntensity = stim ? 0.9 : sensing ? 0.75 : 0
      })
      // The generator region lives in the current target; reset the others.
      for (const id of ['stn', 'gpi', 'vim']) {
        const u = this.nuclei.get(side + id)!.material.uniforms
        u.split.value = id === state.target && state.revealed ? 1 : 0
        if (id !== state.target) u.glow.value = 0
      }
      const focus = this.nuclei.get(side + state.target)!
      focus.material.uniforms.planePoint.value.copy(this.world(lead.geometry.edge))
      focus.material.uniforms.planeNormal.value.copy(
        new THREE.Vector3(...lead.geometry.direction).transformDirection(this.root.matrixWorld),
      )
      // Each view hides whatever would occlude what it is for.
      for (const n of NUCLEI) {
        const mesh = this.nuclei.get(side + n.id)!
        let visible = true,
          opacity = 0.9
        const near: Record<Target, string[]> = { stn: ['stn', 'sn', 'rn'], gpi: ['gpi', 'gpe'], vim: ['vim', 'stn'] }
        if (target) {
          visible = side === state.targetSide && near[state.target].includes(n.id)
          opacity = n.id === state.target ? 0.5 : 0.4
        } else if (state.view === 'sagittal') {
          visible = side === 'L' && !['putamen', 'gpe'].includes(n.id)
          opacity = n.id === state.target ? 0.9 : 0.7
        } else if (n.id === state.target) opacity = 0.85
        // The VIM is a region inside the thalamus: show it only when it is the target.
        if (n.id === 'vim' && state.target !== 'vim') visible = false
        mesh.visible = visible
        mesh.material.uniforms.opacity.value = opacity
      }
      for (const p of PATHWAYS) this.pathways.get(side + p.id)!.visible = state.target === 'stn' && ((target && side === state.targetSide) || state.view === 'coronal')
    }
    if (force || !previous || previous.view !== state.view || previous.targetSide !== state.targetSide) this.goTo(state.view, state.targetSide, !previous)
    this.buildLabels()
  }

  private buildLabels() {
    const s = this.state!
    const labels: Label[] = []
    const add = (id: string, text: string, kind: Label['kind'], at: Vec3, side?: Side) =>
      labels.push({ id, text, kind, side, world: this.world(at) })
    if (s.labels) {
      if (s.view === 'target') {
        const side = s.targetSide,
          lead = this.leads[side]
        const name = (side === 'L' ? 'Left ' : 'Right ') + nucleus(s.target).short
        add(s.target, name, 'nucleus', add3(mirror(nucleus(s.target).centre, side), mirror([4, -4, -1], side)), side)
        if (s.target === 'stn') {
          add('sn', 'Substantia nigra', 'nucleus', mirror(nucleus('sn').centre, side), side)
          add('rn', 'Red nucleus', 'nucleus', mirror(nucleus('rn').centre, side), side)
          add('ic', 'Internal capsule', 'nucleus', mirror([17.6, -11, -1], side), side)
          add('oc', 'Oculomotor fibres', 'nucleus', mirror([10.3, -15.2, -9.5], side), side)
        } else if (s.target === 'gpi') add('gpe', 'GPe', 'nucleus', mirror(nucleus('gpe').centre, side), side)
        else add('stnv', 'STN', 'nucleus', mirror(nucleus('stn').centre, side), side)
        if (lead) {
          lead.geometry.contacts.forEach((c, i) => add('c' + i, String(i), 'contact', c, side))
          if (s.revealed) add('edge', 'β edge', 'edge', lead.geometry.edge, side)
          if (s.revealed && s.lead === 'directional' && lead.arrow.userData.tip) add('dir', 'β direction', 'edge', lead.arrow.userData.tip as Vec3, side)
        }
      } else {
        if (s.view !== 'sagittal') {
          for (const side of SIDES) add('stn' + side, (side === 'L' ? 'Left ' : 'Right ') + nucleus(s.target).short, 'nucleus', mirror(nucleus(s.target).centre, side), side)
          if (s.target !== 'gpi') add('gpi', 'GPi', 'nucleus', mirror(nucleus('gpi').centre, 'R'), 'R')
          add('put', 'Putamen', 'nucleus', mirror(nucleus('putamen').centre, 'R'), 'R')
          add('thal', 'Thalamus', 'nucleus', mirror(nucleus('thalamus').centre, 'L'), 'L')
        } else {
          add('stnL', nucleus(s.target).short, 'nucleus', mirror(nucleus(s.target).centre, 'L'), 'L')
          add('thal', 'Thalamus', 'nucleus', mirror(nucleus('thalamus').centre, 'L'), 'L')
          add('cd', 'Caudate', 'nucleus', mirror([12, 15, 9], 'L'), 'L')
          add('rn', 'Red nucleus', 'nucleus', mirror(nucleus('rn').centre, 'L'), 'L')
        }
      }
    }
    this.labels = labels
    const key = labels.map((l) => l.id + ':' + l.text).join('|')
    if (key !== this.labelKey) {
      this.labelKey = key
      this.onLabels(labels)
    }
  }

  private goTo(view: ViewPreset, side: Side, instant: boolean) {
    this.root.updateMatrixWorld()
    let target: THREE.Vector3, eye: THREE.Vector3
    if (view === 'target' && this.leads[side]) {
      const g = this.leads[side]!.geometry
      const centre = new THREE.Vector3(...g.contacts[1]).lerp(new THREE.Vector3(...g.contacts[2]), 0.5)
      const d = new THREE.Vector3(...g.direction)
      // Look from the front, slightly lateral and perpendicular to the lead, so lateral pathways sit beside it.
      const lateral = new THREE.Vector3(side === 'L' ? -0.45 : 0.45, 1, -0.35)
      const view = lateral.sub(d.clone().multiplyScalar(lateral.dot(d))).normalize()
      target = this.world(centre.toArray() as Vec3)
      eye = this.world(centre.clone().addScaledVector(view, 30).toArray() as Vec3)
    } else {
      const presets: Record<Exclude<ViewPreset, 'target'>, [Vec3, Vec3]> = {
        overview: [
          [0, -10, 4],
          [-0.62, 0.62, 0.48],
        ],
        coronal: [
          [0, -12, -2],
          [0, 1, 0.06],
        ],
        sagittal: [
          [-10, -10, -2],
          [-1, 0.04, 0.05],
        ],
      }
      const [at, from] = presets[view as Exclude<ViewPreset, 'target'>]
      const distance = view === 'overview' ? 285 : view === 'coronal' ? 280 : 250
      const dir = new THREE.Vector3(...from).normalize()
      target = this.world(at)
      eye = this.world(new THREE.Vector3(...at).addScaledVector(dir, distance).toArray() as Vec3)
    }
    if (instant) {
      this.camera.position.copy(eye)
      this.controls.target.copy(target)
      this.controls.update()
      this.tween = null
    } else {
      this.tween = { from: [this.camera.position.clone(), this.controls.target.clone()], to: [eye, target], start: performance.now() }
    }
  }

  resetView() {
    if (this.state) this.goTo(this.state.view, this.state.targetSide, false)
  }

  private resize() {
    const w = Math.max(1, this.host.clientWidth),
      h = Math.max(1, this.host.clientHeight)
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.dirty = true
  }

  /**
   * Render on demand. Camera motion renders at up to 30 fps; the live STN glow and the
   * stimulation pulse refresh at about 12 fps; an unchanged scene is not redrawn.
   * This keeps the main thread free for the recording on slow machines.
   */
  private loop = () => {
    this.frame = requestAnimationFrame(this.loop)
    if (!this.visible || document.hidden) return
    const now = performance.now()
    if (this.lastTick) this.gap += (Math.min(1000, now - this.lastTick) - this.gap) * 0.1
    this.lastTick = now
    // On a struggling machine, lower the render resolution once and space out decorative frames.
    const struggling = this.gap > 45
    if (struggling && !this.slowSince) this.slowSince = now
    if (!struggling) this.slowSince = 0
    if (!this.reduced && this.slowSince && now - this.slowSince > 1500) {
      this.reduced = true
      this.renderer.setPixelRatio(1)
      this.resize()
    }
    const since = now - this.lastRender
    if (since < 1000 / 30) return
    const t = this.clock.getElapsedTime()
    let moving = false
    if (this.tween) {
      const u = Math.min(1, (now - this.tween.start) / 750),
        e = u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2
      this.camera.position.lerpVectors(this.tween.from[0], this.tween.to[0], e)
      this.controls.target.lerpVectors(this.tween.from[1], this.tween.to[1], e)
      if (u >= 1) this.tween = null
      moving = true
    }
    if (this.controls.update()) moving = true
    // Decorative refresh (beta glow, stimulation pulse): ~12 fps normally, ~3 fps when the page is struggling.
    const slow = since >= (struggling ? Math.max(330, 4 * this.gap) : 1000 / 12)
    let animated = false
    if (slow || moving || this.dirty) {
      const live = this.live()
      for (const side of SIDES) {
        const stn = this.nuclei.get(side + (this.state?.target ?? 'stn'))!
        const level = Math.min(1.2, live.beta[side] / 1.1)
        const glow = stn.material.uniforms.glow
        const next = glow.value + (level - glow.value) * 0.45
        if (Math.abs(next - glow.value) > 0.003) animated = true
        glow.value = next
        const lead = this.leads[side],
          mA = live.stim[side],
          k = this.state?.stimContact?.[side]
        if (!lead) continue
        const show = mA > 0.02 && k !== undefined && k !== null
        if (show !== lead.vta.visible) animated = true
        lead.vta.visible = show
        const pw = this.state?.pulseWidth ?? 60
        const hit = show && this.state?.border ? reached(side, this.state.border[side], k!, mA, pw).map((p) => p.id) : []
        for (const p of PATHWAYS) {
          const u = this.pathways.get(side + p.id)!.material.uniforms
          const goal = hit.includes(p.id) ? 1 : 0
          if (u.glow.value !== goal) animated = true
          u.glow.value = goal
          u.opacity.value = goal ? 0.55 : 0.16
        }
        if (show) {
          lead.vta.scale.setScalar(radius(mA, pw))
          lead.vta.position.set(...lead.geometry.contacts[k!])
          lead.vta.material.uniforms.time.value = t
          lead.vta.material.uniforms.strength.value = Math.min(1, mA / 1.5)
          animated = true
        }
      }
    }
    if (!(moving || this.dirty || (slow && animated))) return
    this.dirty = false
    this.lastRender = now
    this.renderer.render(this.scene, this.camera)
    this.positionLabels()
  }

  private positionLabels() {
    const w = this.host.clientWidth,
      h = this.host.clientHeight
    const camDir = new THREE.Vector3()
    this.camera.getWorldDirection(camDir)
    const placed: { x: number; y: number; w: number }[] = []
    for (const l of this.labels) {
      l.el ??= this.labelRoot?.querySelector<HTMLElement>(`[data-label="${l.id}"]`) ?? undefined
      if (!l.el) continue
      const p = l.world.clone().project(this.camera)
      const behind = l.world.clone().sub(this.camera.position).dot(camDir) < 0
      const x = (p.x * 0.5 + 0.5) * w
      let y = (0.5 - p.y * 0.5) * h
      const width = l.el.offsetWidth || 60
      // Contact numbers sit beside their contact; other labels step down past earlier ones.
      if (l.kind !== 'contact')
        for (let tries = 0; tries < 4; tries++) {
          const hit = placed.find((q) => Math.abs(q.y - y) < 20 && x < q.x + q.w + 6 && q.x < x + width + 6)
          if (!hit) break
          y = hit.y + 22
        }
      const hidden = behind || x < 4 || y < 40 || x > w - 40 || y > h - 48
      if (!hidden && l.kind !== 'contact') placed.push({ x, y, w: width })
      l.el.style.opacity = hidden ? '0' : '1'
      l.el.style.transform = `translate(${x.toFixed(1)}px, ${(y - 9).toFixed(1)}px)`
    }
  }

  dispose() {
    cancelAnimationFrame(this.frame)
    this.observer.disconnect()
    this.resizer.disconnect()
    this.controls.dispose()
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose()
        const m = o.material as THREE.Material | THREE.Material[]
        ;(Array.isArray(m) ? m : [m]).forEach((x) => x.dispose())
      }
    })
    this.solid.forEach((m) => m.dispose())
    this.glass.forEach((m) => m.dispose())
    this.scene.environment?.dispose()
    this.renderer.dispose()
    this.canvas.remove()
  }
}

function mergeGeometries(list: THREE.BufferGeometry[]) {
  const pos: number[] = [],
    nor: number[] = [],
    idx: number[] = []
  let base = 0
  for (const g of list) {
    const p = g.getAttribute('position'),
      n = g.getAttribute('normal')
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i))
      nor.push(n.getX(i), n.getY(i), n.getZ(i))
    }
    const index = g.getIndex()
    if (index) for (let i = 0; i < index.count; i++) idx.push(index.getX(i) + base)
    base += p.count
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  out.setIndex(idx)
  return out
}
