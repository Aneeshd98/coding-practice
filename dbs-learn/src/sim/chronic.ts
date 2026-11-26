/**
 * A day of chronic sensing: beta-band power logged every 10 minutes, as sensing
 * implants record it over weeks. Levodopa doses lower beta for a few hours, sleep
 * lowers it overnight, and slow fluctuations add realism. Teaching model only.
 */
import { randomGenerator, type Side, type Subject } from './model'

export const STEP_MIN = 10
export const SLEEP: [number, number] = [23, 7]

/** Effect of one dose `h` hours after intake: onset in ~30 min, peak near 1 h, waning over ~3 h. */
export function doseEffect(h: number) {
  if (h <= 0) return 0
  const k = (Math.exp(-h / 1.6) - Math.exp(-h / 0.45)) / 0.535
  return Math.max(0, k)
}
const asleepAt = (hour: number) => hour >= SLEEP[0] || hour < SLEEP[1]

export interface ChronicPoint {
  hour: number
  /** Logged beta-band power, in units of the patient's untreated daytime level. */
  beta: number
  /** Medication effect, 0 (none) to 1 (full). */
  medication: number
  /** Narrowband gamma at peak dose, 0 when absent. */
  gamma: number
  asleep: boolean
}

export function chronicDay(subject: Subject, side: Side, doses: number[]): ChronicPoint[] {
  const noise = randomGenerator(subject.seed ^ (side === 'L' ? 0xc4d0 : 0xc4d1))
  const points: ChronicPoint[] = []
  let drift = 0
  for (let m = 0; m < 24 * 60; m += STEP_MIN) {
    const hour = m / 60
    // Doses from the previous day still act after midnight.
    const total = doses.reduce((s, d) => s + doseEffect(hour - d) + doseEffect(hour + 24 - d), 0)
    const medication = 1 - Math.exp(-1.6 * total)
    const asleep = asleepAt(hour)
    drift = 0.85 * drift + 0.15 * (noise() - 0.5) * 2
    const beta = (1 - 0.6 * medication) * (asleep ? 0.55 : 1) * (1 + 0.1 * drift)
    const gamma = asleep ? 0 : Math.max(0, (medication - 0.78) / 0.22)
    points.push({ hour, beta: Math.max(0.05, beta), medication, gamma, asleep })
  }
  return points
}

/** Waking hours with beta above the threshold (under-treated), and with gamma present (dyskinesia-prone). */
export function summarise(points: ChronicPoint[], threshold = 0.75) {
  const awake = points.filter((p) => !p.asleep)
  const hours = (n: number) => (n * STEP_MIN) / 60
  return {
    offHours: hours(awake.filter((p) => p.beta > threshold).length),
    dyskinesiaHours: hours(awake.filter((p) => p.gamma > 0.1).length),
  }
}
