/**
 * Builds the clinical review pack (docs/clinical-review.md) from the course itself, so the
 * document a reviewer signs off always matches what learners see. Regenerate with
 * `npm run review-pack`; a test fails when the committed copy is out of date.
 */
import { modules, practicalLesson } from './content'
import { exercises } from './practicals'
import { CASES, PASS_CASES, PEAK_TOLERANCE_HZ } from './assessment'
import type { RecordingManifest } from '../dsp/recording'

/** What the simulator assumes, as implemented, with the simplification a reviewer should weigh. */
const ASSUMPTIONS: [string, string, string][] = [
  ['Leads and contacts', 'Four ring contacts, 1.5 mm long, 2 mm centre to centre; contact 0 deepest. Optional directional lead splits contacts 1 and 2 into three segments, 120° apart (a anterior, b posterolateral, c posteromedial).', 'Generic geometry, not a specific device.'],
  ['Patient variability', 'Per side: beta peak 16–26 Hz; edge of the beta generator 1.3–4.7 mm above the centre of contact 0; beta-source direction anywhere around the lead. Gamma 66–82 Hz; pallidal theta 5–9 Hz (dystonia); tremor 4.5–7 Hz.', 'Uniform random ranges chosen for teaching, not population statistics.'],
  ['Beta generator', 'A contact sees the generator through a sigmoid of its height relative to the edge (0.6 mm length scale); bipolar beta is largest across the edge.', 'One sharp-edged dorsolateral source; real sources are distributed.'],
  ['Beta bursts and levodopa', 'OFF: bursts last 0.45 s on average; ON: 0.2 s, 1.3 times as frequent, with half the background envelope, so beta power falls. The change takes effect with a 4 s time constant.', 'Levodopa normally acts over tens of minutes; compressed so a lesson can show it.'],
  ['Movement', 'Contralateral beta falls to 25% (ipsilateral 85%) with a 0.12 s time constant, then rebounds to 145% for 1.2 s after the movement stops (0.7 s ipsilaterally).', 'Stylised event-related desynchronisation and rebound.'],
  ['Heartbeat', 'The implant case in the chest is the reference, so the ECG reaches every contact almost equally (2.5% of a 1 mV witness, rising 1.8% per contact) and largely cancels in bipolar pairs.', 'Real cardiac artefact depends on implant side and posture.'],
  ['Stimulation artefact', 'About 250 µV per mA at the stimulating contact, falling as 1/(1 + d/0.75 mm); the 130 Hz fundamental aliases to 120 Hz at 250 Hz sampling; the amplifier saturates at ±400 µV, where clipping creates an aliased harmonic at 20 Hz.', 'No device-specific filtering or blanking is modelled.'],
  ['Stimulation and beta', 'Beta is suppressed by up to 80%, building with a 0.25 s and decaying with a 1.2 s time constant, scaled by charge per pulse (chronaxie 40 µs) and by distance from the generator edge. Stimulation ramps up over 0.5 s.', 'Suppression is a smooth function of amplitude; no plasticity or long-term effects.'],
  ['Dyskinesia gamma', 'With dyskinesia ON levodopa, narrowband gamma appears; under stimulation whose half-frequency lies in 55–95 Hz it locks to half the stimulation frequency.', 'Entrainment is all-or-none above half the ramp.'],
  ['Adaptive DBS', 'Single-threshold controller: band-pass of ±3 Hz around a chosen centre on the pair flanking the stimulating contact, rectified and smoothed; amplitude ramps up while the estimate is above threshold and down below it, within set limits.', 'One of many published control schemes; no safety logic beyond limits.'],
  ['Field and side effects', 'Activation radius 1.9·√(I / (1 + c/PW)) mm; chronaxie 40 µs for the beneficial elements and 120 µs for internal-capsule and oculomotor fibres, placed lateral and medial to the STN.', 'Illustrative sphere model, not a validated volume of tissue activated.'],
  ['A day of chronic sensing', 'Beta logged every 10 minutes; each dose acts from about 30 minutes, peaks near an hour and wanes over about 3 hours; sleep (23:00–07:00) lowers beta to 55%; peak-dose gamma when the medication effect exceeds 0.78.', 'Smooth pharmacokinetic curve with no meals, stress or circadian detail.'],
  ['Directional beta', 'A segment sees the beta source scaled by 1 + 0.75·cos(angle to the source); segments are compared with their level’s average.', 'A single point-like source direction.'],
  ['Other targets', 'Dystonia (GPi): low-frequency peak, unaffected by levodopa, reduced by stimulation. Essential tremor (VIM): tremor-frequency activity with posture, mostly opposite the active hand, reduced with tremor by stimulation.', 'Highly simplified; the course states this.'],
  ['Analysis', 'Welch spectra (Hann, 50% overlap); beta band 13–35 Hz; a peak counts when it is a local maximum at least 2.5 times the mean of bins 3–6 Hz either side; bursts above the 75th percentile of the beta envelope for at least 100 ms.', 'Conventional choices; thresholds vary between studies.'],
]

const QUESTIONS = [
  'Is any statement wrong, outdated or misleading for the intended learners (clinicians, engineers and students new to DBS sensing)?',
  'Are the simplifications in the assumptions table acceptable for teaching, and is each one disclosed where it matters?',
  'Does any wording read as programming or clinical advice? The course must not be used for clinical decisions.',
  'Is the real-recording lesson’s selection disclosure adequate?',
  'Are the further-reading links appropriate for each lesson?',
]

const box = '- [ ] Accurate  - [ ] Needs change: …'
const quote = (s: string) => s.replace(/\n/g, ' ')

export function reviewPack(recording: RecordingManifest) {
  const out: string[] = []
  const add = (...lines: string[]) => out.push(...lines)
  add(
    '# Subthalamic Lab · clinical review pack',
    '',
    '_Generated from the course by `npm run review-pack`. Do not edit by hand: change the course, then regenerate._',
    '',
    'This pack lists everything the course teaches, the assumptions of its simulated patient, how the assessment is graded and where the real recording comes from, so that a qualified reviewer (a movement-disorders neurologist, a clinical neurophysiologist or an experienced DBS programmer) can check it in one pass. It has not yet been reviewed.',
    '',
    '**Reviewer:** … **Role:** … **Date:** … **Course version (commit):** …',
    '',
    '## How to review',
    '',
    'For each item, tick _Accurate_ or _Needs change_ and say what to change. The questions below apply throughout.',
    '',
    ...QUESTIONS.map((q, i) => `${i + 1}. ${q}`),
    '',
    '## 1. Assumptions of the simulated patient',
    '',
    '| Area | As implemented | Simplification | Review |',
    '| --- | --- | --- | --- |',
    ...ASSUMPTIONS.map(([a, b, c]) => `| ${a} | ${b} | ${c} | ☐ OK ☐ Change |`),
    '',
    '## 2. Lessons',
    '',
  )
  modules.forEach((m, mi) => {
    add(`### Module ${mi + 1}: ${m.title}`, '', `_${m.summary}_`, '')
    m.lessons.forEach((l, li) => {
      add(`#### ${mi + 1}.${li + 1} ${l.title}${l.disorder && l.disorder !== 'pd' ? ` (patient: ${l.disorder === 'dystonia' ? 'dystonia, GPi' : 'essential tremor, VIM'})` : ''}`, '', `> ${quote(l.intro)}`, '', '**What it teaches**', '')
      l.explain.forEach((p) => add(`- ${quote(p)}`))
      if (l.predict) {
        add('', `**Prediction:** ${l.predict.question}`, '')
        l.predict.options.forEach((o, i) => add(`- ${i === l.predict!.answer ? '**' + o + '** (expected)' : o}`))
        add('', `Shown afterwards: ${quote(l.predict.reveal)}`)
      }
      add('', `**Checkpoint:** ${l.task}`, '')
      l.options.forEach((o, i) => add(`- ${i === l.correct ? '**' + o + '** (correct)' : o}${i === l.correct ? '' : ` — _shown if chosen:_ ${quote(l.why[i])}`}`))
      add('', `Feedback when correct: ${quote(l.feedback)}`, '', `Further reading: ${l.sources.map((s) => `[${s.title}](${s.url})`).join('; ')}`, '')
      if (practicalLesson(m) === l) {
        const ex = exercises[m.id]
        add(`**Module practical** (graded from the learner’s own recording): ${ex.question}`, '')
        ex.steps.forEach((s) => add(`- ${s}`))
        add('', `On passing: ${ex.takeaway}`, '')
      }
      add(box, '')
    })
  })
  add(
    '## 3. Patient assessment',
    '',
    `${CASES} unseen virtual patients; for each, the learner reports the left adjacent pair that straddles the edge of the beta region, the left beta peak frequency and the left segment facing the beta source. Grading uses the simulator’s hidden truth: both pairs are accepted when the edge lies near a contact (expected beta within 80% of the largest), the peak within ±${PEAK_TOLERANCE_HZ} Hz, and both segments when the source points within 15° of the line between them. A patient passes with all three right; the assessment with ${PASS_CASES} of ${CASES}.`,
    '',
    box,
    '',
    '## 4. Real recording',
    '',
    `- Source: ${recording.citation} ${recording.source}, doi:${recording.doi}, ${recording.licence}.`,
    `- Participant ${recording.subject}; ${recording.window_s[1] - recording.window_s[0]} s of rest per condition, OFF and ON levodopa; contacts marked bad: ON ${recording.bad.on.join(', ') || 'none'}, OFF ${recording.bad.off.join(', ') || 'none'}.`,
    `- Selection: ${recording.selection.reason}`,
    `- Screening: ${recording.selection.screened} participants screened (${recording.selection.excluded} more excluded by the criterion); ${recording.selection.clear_off_peak} had a clear OFF beta peak, and beta fell ON in ${recording.selection.fell_on_of_those} of those. Criterion: ${recording.selection.criterion}`,
    '',
    box,
    '',
    '## 5. Overall',
    '',
    '- [ ] Suitable for teaching as is',
    '- [ ] Suitable after the changes noted above',
    '- [ ] Not suitable',
    '',
    'Comments: …',
    '',
  )
  return out.join('\n')
}
