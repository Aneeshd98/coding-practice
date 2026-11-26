export type Tool = 'lead' | 'sensing' | 'spectrum' | 'bursts' | 'movement' | 'stim'
export type ModuleId = 'sensing' | 'beta' | 'bursts' | 'stim'

export interface Reading {
  title: string
  url: string
}
export interface Lesson {
  id: string
  title: string
  intro: string
  explain: string[]
  steps: string[]
  tools: Tool[]
  task: string
  options: string[]
  correct: number
  feedback: string
  hint: string
  sources: Reading[]
}
export interface CourseModule {
  id: ModuleId
  title: string
  summary: string
  lessons: Lesson[]
}

const pubmed = (title: string): Reading => ({
  title,
  url: 'https://pubmed.ncbi.nlm.nih.gov/?term=' + encodeURIComponent(title),
})
const read = {
  brown: pubmed(
    "Oscillatory nature of human basal ganglia activity: relationship to the pathophysiology of Parkinson's disease",
  ),
  kuhn2006: pubmed(
    "Reduction in subthalamic 8-35 Hz oscillatory activity correlates with clinical improvement in Parkinson's disease",
  ),
  kuhn2004: pubmed('Event-related beta desynchronization in human subthalamic nucleus correlates with motor performance'),
  burstsMed: pubmed("Beta burst dynamics in Parkinson's disease OFF and ON dopaminergic medication"),
  burstsAdbs: pubmed("The modulatory effect of adaptive deep brain stimulation on beta bursts in Parkinson's disease"),
  little: pubmed('Adaptive deep brain stimulation in advanced Parkinson disease'),
  fooof: pubmed('Parameterizing neural power spectra into periodic and aperiodic components'),
  neumann: pubmed('Toward Electrophysiology-Based Intelligent Adaptive Deep Brain Stimulation for Movement Disorders'),
  percept: pubmed('Device profile of the percept PC deep brain stimulation system'),
}

export const modules: CourseModule[] = [
  {
    id: 'sensing',
    title: 'Leads and sensing',
    summary: 'Follow a voltage from the subthalamic nucleus to a pair of lead contacts.',
    lessons: [
      {
        id: 'lead-anatomy',
        title: 'Where the lead sits',
        intro: 'Meet the virtual patient: one lead in each subthalamic nucleus, four contacts per lead.',
        explain: [
          'In Parkinson’s disease, DBS leads are often placed in the subthalamic nucleus (STN). Its dorsolateral part is the motor region, where pathological beta activity tends to be strongest. Each lead in this lab has four ring contacts, 1.5 mm long with 0.5 mm gaps, numbered 0 (deepest) to 3.',
          'A local field potential (LFP) is the summed electrical activity of many nearby neurons, mostly synaptic currents. STN LFPs are small, typically a few microvolts (µV), much smaller than the stimulation pulses delivered through the same lead.',
        ],
        steps: [
          'Look at the lead diagram. Find contact 0 at the tip and contact 3 nearest the top.',
          'The trace panel shows sandwich pairs such as L 0–2: contact 0 minus contact 2 on the left lead.',
          'Switch Montage to Monopolar. Each contact is now compared with the implant case in the chest. Compare the size of these signals with the pairs.',
        ],
        tools: ['lead', 'sensing'],
        task: 'Which contact sits deepest in the brain?',
        options: ['Contact 3', 'Contact 0', 'They are all at the same depth'],
        correct: 1,
        feedback: 'Contacts are numbered from the tip upward, so contact 0 is the deepest (most ventral) contact.',
        hint: 'The numbering starts at the tip of the lead.',
        sources: [read.brown, read.percept],
      },
      {
        id: 'bipolar-sensing',
        title: 'Why record between contacts',
        intro: 'A contact referenced to the case picks up everything in between. Two neighbouring contacts mostly share it.',
        explain: [
          'In a monopolar recording, each contact is compared with the implant case. Activity that reaches both contacts of a pair almost equally, such as distant brain activity, slow drift and the heartbeat, appears large there.',
          'A bipolar recording subtracts two neighbouring contacts. Whatever they share cancels, leaving the local difference. This is why sensing-enabled systems record between contacts, and why the heartbeat (ECG) seen from a chest-mounted case largely disappears in a bipolar pair.',
        ],
        steps: [
          'Set Montage to Monopolar. In the sensing panel, compare the ECG witness with the regular spikes on the traces.',
          'Switch back to Sandwich pairs. Does the cardiac spike survive the subtraction?',
          'Turn ECG pickup off and on to confirm which deflections came from the heart.',
        ],
        tools: ['sensing', 'lead'],
        task: 'The heartbeat is large in every monopolar contact but almost absent in L 0–2. Why?',
        options: [
          'The heart signal reaches both contacts nearly equally and cancels in the subtraction',
          'The heart stops beating during bipolar recording',
          'Bipolar recordings filter out all frequencies below 100 Hz',
        ],
        correct: 0,
        feedback:
          'A common input cancels in a difference. Only the small difference between the two contacts’ cardiac pickup remains.',
        hint: 'Think about what a subtraction does to a signal that is the same on both inputs.',
        sources: [read.percept, read.neumann],
      },
      {
        id: 'find-beta-contacts',
        title: 'Find the beta contacts',
        intro: 'The pair with the most beta tells you where the motor STN meets the lead.',
        explain: [
          'Beta activity (roughly 13–35 Hz) is generated within the motor STN. Two contacts both inside the generator, or both outside it, see similar signals, so their difference is small. A pair that straddles the edge of the beta region shows the largest bipolar beta.',
          'Clinicians use this kind of contact survey to help choose which contact to stimulate. Here, the true edge of the beta region is hidden until you reveal it, and each new virtual patient has a different one.',
        ],
        steps: [
          'Keep medication OFF, stimulation off and the patient at rest.',
          'Set Montage to Adjacent pairs and click each left pair (L 0–1, L 1–2, L 2–3) to read its beta power in the spectrum panel.',
          'Decide which pair straddles the beta region, then reveal it on the lead diagram to check.',
        ],
        tools: ['spectrum', 'lead'],
        task: 'Adjacent pair 1–2 shows a clear beta peak while 0–1 and 2–3 show almost none. Where is the edge of the beta generator most likely to be?',
        options: ['Below contact 0', 'Between contacts 1 and 2', 'Above contact 3'],
        correct: 1,
        feedback:
          'Contacts 0 and 1 share the generator and 2 and 3 share its absence. The difference is largest across the edge between 1 and 2.',
        hint: 'A bipolar pair is large where its two contacts see different things.',
        sources: [read.brown, read.kuhn2006],
      },
    ],
  },
  {
    id: 'beta',
    title: 'Beta and medication',
    summary: 'Read an LFP spectrum and measure how levodopa changes beta power.',
    lessons: [
      {
        id: 'read-spectrum',
        title: 'Read an LFP spectrum',
        intro: 'Power spectral density shows how signal power spreads across frequencies.',
        explain: [
          'The spectrum panel plots power spectral density in µV²/Hz on a logarithmic axis. LFP spectra fall with frequency, a smooth aperiodic (1/f-like) background. Oscillations appear as peaks above it. In Parkinson’s disease OFF medication, STN LFPs often show a peak in the beta band, here 13–35 Hz.',
          'Band power is the area under the spectrum over a band, in µV². It includes the background beneath the peak, so a rise in band power is not proof of a new oscillation unless a peak stands out.',
        ],
        steps: [
          'Select L 0–2 by clicking its trace. Read the beta peak frequency in the spectrum panel.',
          'Compare the right side (R 0–2). Each side of a virtual patient has its own peak frequency.',
          'Change the analysis window from 4 s to 16 s and watch the spectrum become smoother.',
        ],
        tools: ['spectrum'],
        task: 'A spectrum rises smoothly toward low frequencies and has a narrow bump at 21 Hz. Which part is the beta oscillation?',
        options: ['The smooth rise toward low frequencies', 'The narrow bump at 21 Hz', 'The highest point on the plot'],
        correct: 1,
        feedback: 'The bump above the aperiodic background is the oscillation. The low-frequency rise is the background itself.',
        hint: 'Separate the smooth background from what stands above it.',
        sources: [read.fooof, read.brown],
      },
      {
        id: 'levodopa-beta',
        title: 'Levodopa and beta',
        intro: 'Give the virtual patient levodopa and measure what happens to the beta peak.',
        explain: [
          'Dopaminergic medication reduces STN beta activity, and the size of that reduction has been linked to improvement in slowness and rigidity. In people the change develops over tens of minutes. This lab compresses it into about 10 seconds.',
          'A fair comparison uses the same contact pair, the same window length and settled states: wait until the medication effect has stabilized before capturing.',
        ],
        steps: [
          'With medication OFF and at rest, select L 0–2 and choose Capture OFF. This stores the last 20 seconds.',
          'Switch medication ON. Wait at least 15 seconds, then choose Capture ON with the same pair selected.',
          'Compare the two beta powers shown under the captures.',
        ],
        tools: ['spectrum'],
        task: 'Why wait before capturing the ON window?',
        options: [
          'So the medication effect has settled and the window reflects one state',
          'The amplifier needs time to warm up',
          'Beta only exists 15 seconds after any change',
        ],
        correct: 0,
        feedback: 'A window that straddles the transition mixes OFF and ON activity and underestimates the change.',
        hint: 'What would a window that includes the transition contain?',
        sources: [read.kuhn2006, read.brown],
      },
    ],
  },
  {
    id: 'bursts',
    title: 'Bursts and movement',
    summary: 'See beta as a series of bursts and watch it fall during movement.',
    lessons: [
      {
        id: 'beta-bursts',
        title: 'Beta comes in bursts',
        intro: 'Beta is not a steady tone. It waxes and wanes in bursts of different lengths.',
        explain: [
          'Band-pass the signal around the beta peak and compute its amplitude envelope. A common definition marks a burst when the envelope exceeds its 75th percentile for at least 100 ms. OFF medication, long bursts are more frequent, and longer bursts have been linked to worse motor symptoms.',
          'The threshold matters. If you recompute the 75th percentile separately for the ON recording, about a quarter of every recording is labelled as bursting no matter what the medication did. To compare states, fix the threshold from a baseline, such as the OFF recording, and apply it to both.',
        ],
        steps: [
          'Capture OFF and ON windows as in the previous module (or reuse them).',
          'In the burst panel, choose Threshold: from this window. Compare mean burst durations OFF and ON.',
          'Switch to Threshold: fixed from OFF capture and compare again. Which comparison reflects the medication effect?',
        ],
        tools: ['bursts', 'spectrum'],
        task: 'You set the threshold separately in each recording at its own 75th percentile. What is the problem?',
        options: [
          'Each recording is forced to spend a similar fraction of time above threshold, hiding real amplitude changes',
          'The 75th percentile cannot be computed for ON data',
          'Burst durations become negative',
        ],
        correct: 0,
        feedback:
          'A percentile threshold adapts to each recording. A fixed threshold from a baseline lets a weaker state show fewer and shorter bursts.',
        hint: 'What fraction of samples lies above a 75th percentile, by definition?',
        sources: [read.burstsMed, read.burstsAdbs],
      },
      {
        id: 'movement-erd',
        title: 'Movement and the beta rebound',
        intro: 'Ask the virtual patient to move a hand, and watch beta fall and then overshoot.',
        explain: [
          'Beta power in the STN falls during voluntary movement (event-related desynchronization), most strongly in the hemisphere opposite the moving hand. After movement stops it briefly rises above baseline, the post-movement beta rebound.',
          'Averaging power across many cued trials, aligned to the cue, reveals this time course even though each single trial is noisy. Average power, not raw voltage: the beta phase differs across trials and would cancel in a voltage average.',
        ],
        steps: [
          'In the movement panel, run 12 cued right-hand trials (you can accelerate collection).',
          'Compare the time courses for the left and right STN. Which side shows the deeper drop?',
          'Find the rebound after the stop cue at 2 s.',
        ],
        tools: ['movement'],
        task: 'The right hand moves. Where should beta suppression be strongest?',
        options: ['Right STN', 'Left STN', 'Equal on both sides'],
        correct: 1,
        feedback: 'Motor control is largely crossed, so the left STN, contralateral to the right hand, shows the larger drop.',
        hint: 'Each hemisphere mainly controls the opposite side of the body.',
        sources: [read.kuhn2004, read.burstsMed],
      },
    ],
  },
  {
    id: 'stim',
    title: 'Stimulation and artifacts',
    summary: 'Turn on stimulation, understand its artifact, and see why sandwich sensing works.',
    lessons: [
      {
        id: 'stim-artifact',
        title: 'The stimulation artifact',
        intro: 'Stimulation pulses are thousands of times larger than the LFP and arrive through the same lead.',
        explain: [
          'Stimulation commonly runs at around 130 Hz. At 250 samples per second the Nyquist frequency is 125 Hz, so a 130 Hz artifact cannot be represented and folds back to 250 − 130 = 120 Hz. Its harmonic at 260 Hz folds to 10 Hz.',
          'Close to the stimulating contact the artifact can exceed the amplifier’s input range. A saturated (clipped) channel loses the LFP entirely for as long as it stays at the limit.',
        ],
        steps: [
          'Set Montage to Adjacent pairs. In the stimulation panel, turn stimulation on at left contact 1, 2 mA, 130 Hz.',
          'Select L 2–3 and find the artifact peak in the spectrum. Where does it appear?',
          'Select L 1–2, which includes the stimulating contact, and look for flat-topped clipping in the trace.',
        ],
        tools: ['stim', 'spectrum'],
        task: 'Stimulation runs at 130 Hz and the LFP is sampled at 250 Hz. Where does the artifact appear in the spectrum?',
        options: ['130 Hz', '120 Hz', '65 Hz'],
        correct: 1,
        feedback: '130 Hz lies above the 125 Hz Nyquist limit and folds back to 250 − 130 = 120 Hz.',
        hint: 'Reflect the frequency around the Nyquist limit, half the sampling rate.',
        sources: [read.percept, read.neumann],
      },
      {
        id: 'sandwich',
        title: 'Sandwich sensing',
        intro: 'Record from the two contacts on either side of the stimulating contact.',
        explain: [
          'When contact 1 stimulates, contacts 0 and 2 are the same distance from it, so they see nearly the same artifact. In the pair 0–2 the artifact largely cancels, just as the heartbeat did. This symmetric arrangement is often called sandwich sensing.',
          'Tissue is never perfectly symmetric, so a small residual remains. It sits near 120 Hz, well away from the beta band, so beta can still be measured during stimulation.',
        ],
        steps: [
          'With stimulation at left contact 1, compare the artifact peak in L 2–3 with L 0–2.',
          'Move stimulation to contact 2 and find the pair that now flanks it.',
          'Return stimulation to contact 1.',
        ],
        tools: ['stim', 'spectrum', 'lead'],
        task: 'Stimulation is on contact 2. Which pair gives sandwich sensing?',
        options: ['0–1', '1–3', '2–3'],
        correct: 1,
        feedback: 'Contacts 1 and 3 sit 2 mm either side of contact 2, so the artifact is nearly equal on both and cancels.',
        hint: 'Pick the two contacts equally spaced on either side of the stimulating contact.',
        sources: [read.percept, read.neumann],
      },
      {
        id: 'stim-beta',
        title: 'Stimulation suppresses beta',
        intro: 'Effective stimulation near the beta generator reduces beta, the signal adaptive DBS uses.',
        explain: [
          'Stimulation near the motor STN suppresses beta power and shortens beta bursts. The effect depends on amplitude and on how close the stimulating contact is to the generator.',
          'Adaptive (closed-loop) DBS uses this relationship: it measures beta through a sandwich pair and raises or lowers stimulation according to beta power. This course stops before closed-loop control. The sensing principles here are what it relies on.',
        ],
        steps: [
          'Select L 0–2 with stimulation off and note its beta power.',
          'Turn stimulation on at contact 1 and increase the amplitude in steps. Wait a few seconds at each step.',
          'Try stimulating contact 3 at the same amplitude and compare the suppression.',
        ],
        tools: ['stim', 'spectrum', 'lead'],
        task: 'Adaptive DBS adjusts stimulation according to beta power measured during stimulation. Which recording makes that possible?',
        options: [
          'A monopolar contact next to the stimulating contact',
          'A sandwich pair flanking the stimulating contact',
          'The pair containing the stimulating contact',
        ],
        correct: 1,
        feedback: 'The flanking pair cancels most of the artifact, so beta remains measurable while stimulation runs.',
        hint: 'Which recording kept the artifact smallest in the previous lesson?',
        sources: [read.little, read.burstsAdbs, read.neumann],
      },
    ],
  },
]

export const lessons = modules.flatMap((m) => m.lessons)
export const moduleOf = (lessonId: string) => modules.find((m) => m.lessons.some((l) => l.id === lessonId))!
