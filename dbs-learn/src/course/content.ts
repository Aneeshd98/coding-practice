export type Tool = 'lead' | 'sensing' | 'spectrum' | 'bursts' | 'movement' | 'stim' | 'adaptive' | 'review' | 'chronic'
export type ModuleId = 'sensing' | 'beta' | 'bursts' | 'stim' | 'programming' | 'adaptive'

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
  /** The module practical sits on this lesson (default: the last). */
  practical?: boolean
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
  arlotti: pubmed('Eight-hours adaptive deep brain stimulation in patients with Parkinson disease'),
  volkmann: pubmed('Introduction to the programming of deep brain stimulators'),
  shortPulse: pubmed('Short pulse width widens the therapeutic window of subthalamic neurostimulation'),
  vta: pubmed('Patient-specific analysis of the volume of tissue activated during deep brain stimulation'),
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
        practical: true,
      },
      {
        id: 'gamma-dyskinesia',
        title: 'A second biomarker: gamma',
        intro: 'Too much dopamine has its own signature: a narrow peak in the gamma range.',
        explain: [
          'When levodopa produces involuntary movements (peak-dose dyskinesia), chronic recordings from the STN and motor cortex have shown a narrow oscillation, usually between 60 and 90 Hz. Unlike beta, which tracks being under-treated, this gamma can indicate being over-treated.',
          'During stimulation this gamma often locks to exactly half the stimulation frequency, for example 65 Hz at 130 Hz. A good sensing setup therefore has to tell an entrained brain rhythm from an artifact. A controller using both biomarkers could avoid stimulating too little or too much.',
        ],
        steps: [
          'Switch levodopa ON and turn Dyskinesia on in the patient bar. Wait about 10 seconds.',
          'Select L 0–2 and set the spectrum range to 1–125 Hz. Find the narrow gamma peak.',
          'Turn stimulation on at contact 1, 130 Hz. Where does the gamma peak move?',
        ],
        tools: ['spectrum', 'stim'],
        task: 'With dyskinesia and stimulation at 130 Hz, a narrow peak appears at exactly 65 Hz. What is the best interpretation?',
        options: [
          'Gamma entrained to half the stimulation frequency',
          'The aliased stimulation artifact',
          'A beta burst at a higher frequency',
        ],
        correct: 0,
        feedback: 'Dyskinesia-related gamma tends to lock to half the stimulation frequency. The 130 Hz artifact aliases to 120 Hz at 250 Hz sampling, not to 65 Hz.',
        hint: 'Compute 130 ÷ 2, and separately where 130 Hz aliases at 250 Hz sampling.',
        sources: [pubmed('Gamma oscillations in the hyperkinetic state detected with chronic human brain recordings in Parkinson’s disease'), read.kuhn2006],
      },
      {
        id: 'daily-beta',
        title: 'Beta across the day',
        intro: 'Sensing implants log beta power every few minutes for weeks. Read a day of it.',
        explain: [
          'Chronic sensing records average power in a narrow band around the patient’s beta peak at regular intervals, often every 10 minutes. Plotted over a day, it shows how symptoms and treatment interact outside the clinic.',
          'Beta dips after each levodopa dose and rises again as the dose wears off. It is also lower during sleep. Moving or adding doses changes how long beta stays high (under-treated) and can introduce periods of peak-dose gamma (over-treated). Real logs are noisier and also reflect activity, posture and artifacts.',
        ],
        steps: [
          'Open the chronic timeline. Find the rise in beta before each dose: that is wearing off.',
          'Remove the 15:00 dose and compare the hours of high beta.',
          'Add doses until high-beta time is short, and watch for dyskinesia-related gamma at peak dose.',
        ],
        tools: ['chronic'],
        task: 'On a 10-minute beta log, beta climbs steadily during the hour before each scheduled dose and falls within an hour of taking it. What does this pattern most likely show?',
        options: ['Wearing off between doses', 'Sleep', 'Stimulation artifact'],
        correct: 0,
        feedback: 'Beta rising as the previous dose fades, and falling once the next takes effect, is the signature of wearing off.',
        hint: 'Relate the timing of the rise and fall to the dose times.',
        sources: [read.percept, read.neumann, read.kuhn2006],
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
          'Close to the stimulating contact the artifact can exceed the amplifier’s input range. A saturated (clipped) channel loses the LFP entirely for as long as it stays at the limit. Clipping also creates new harmonics: the 4th harmonic of 130 Hz (520 Hz) folds to 520 − 2 × 250 = 20 Hz, a convincing but entirely artificial “beta peak”.',
        ],
        steps: [
          'Set Montage to Adjacent pairs. In the stimulation panel, turn stimulation on at left contact 1, 2 mA, 130 Hz.',
          'Select L 2–3 and find the artifact peak in the spectrum. Where does it appear?',
          'Select L 0–1, which includes the stimulating contact, and raise the amplitude to 4 mA. Look for CLIPPED on the trace and a sharp peak at 20 Hz in the spectrum. Then return to 2 mA.',
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
  {
    id: 'programming',
    title: 'Program the stimulator',
    summary: 'Test each contact for benefit and side effects, and choose the widest therapeutic window.',
    lessons: [
      {
        id: 'monopolar-review',
        title: 'Run a monopolar review',
        intro: 'Test one contact at a time, raising the amplitude until benefit appears and then until a side effect does.',
        explain: [
          'After implantation, clinicians test each contact in turn with the implant case as the return electrode (monopolar). For each contact they raise the amplitude in small steps, note the lowest amplitude giving clear benefit (for example, reduced rigidity) and the lowest amplitude producing a side effect.',
          'The difference between the two is the therapeutic window. A wide window lets the patient be treated comfortably and leaves room for adjustment. Here, sensing data from earlier modules gives a head start: the contacts nearest the beta region often give benefit at low amplitudes.',
        ],
        steps: [
          'Open the Monopolar review panel. Select contact 0 and step the amplitude up in 0.1 mA increments until rigidity relief reaches at least 50%. Record the benefit threshold.',
          'Keep stepping up until a side effect appears, and record it. Watch the brain model in Target view: the field and any reached pathway light up.',
          'Repeat for the other contacts and compare their windows in the table.',
        ],
        tools: ['review'],
        task: 'Contact 2 gives benefit at 2.0 mA and muscle contraction at 2.4 mA. Contact 1 gives benefit at 1.6 mA and muscle contraction at 4.1 mA. Which is the better choice?',
        options: ['Contact 2, because its side effect needs more than 2 mA', 'Contact 1, because its window is 2.5 mA rather than 0.4 mA', 'Either, because both give benefit'],
        correct: 1,
        feedback: 'Contact 1 leaves 2.5 mA between benefit and side effect; contact 2 only 0.4 mA. The wider window is safer and easier to adjust.',
        hint: 'Subtract each benefit threshold from its side-effect threshold.',
        sources: [read.volkmann, read.vta],
      },
      {
        id: 'field-shaping',
        title: 'Where side effects come from',
        intro: 'Side effects tell you which neighbouring pathway the field has reached.',
        explain: [
          'The internal capsule, carrying motor fibres to the face and limbs, runs alongside the STN laterally and anteriorly. Spread into it causes muscle contraction or slurred speech. Medially and ventrally, spread towards oculomotor fibres can cause eye deviation or double vision. The type of side effect therefore hints at the direction of spread.',
          'Pulse width changes how much charge each pulse delivers. Shorter pulses need more current for the same effect but can affect different elements unequally. Clinical studies have reported wider therapeutic windows with short pulses (around 30 µs). In this model, short pulses spare the capsule more than the motor STN.',
        ],
        steps: [
          'In Target view, stimulate the top contact and raise the amplitude until the internal capsule lights up.',
          'Try the deepest contact and see which pathway it reaches first.',
          'Switch to 30 µs and repeat one contact: compare both thresholds with 60 µs.',
        ],
        tools: ['review'],
        task: 'Muscle contraction in the face appears at a low amplitude on an upper contact. Which structure has the field most likely reached?',
        options: ['The internal capsule', 'The red nucleus', 'The contralateral STN'],
        correct: 0,
        feedback: 'Motor fibres in the internal capsule run lateral to the STN; their activation causes muscle contraction.',
        hint: 'Which nearby pathway carries motor commands to the face and limbs?',
        sources: [read.shortPulse, read.volkmann, read.vta],
      },
    ],
  },
  {
    id: 'adaptive',
    title: 'Adaptive DBS',
    summary: 'Close the loop: let sensed beta decide when to stimulate, and tune the controller.',
    lessons: [
      {
        id: 'close-the-loop',
        title: 'Close the loop',
        intro: 'Instead of stimulating all the time, let the patient’s own beta decide when stimulation is needed.',
        explain: [
          'Adaptive (closed-loop) DBS measures a biomarker and adjusts stimulation in response. Here the biomarker is beta amplitude, sensed through the sandwich pair around the stimulating contact. A single-threshold controller ramps the amplitude up while sensed beta is above a threshold and down while it is below.',
          'The aim is similar benefit with less stimulation: fewer side effects and less battery use. Studies have reported clinical benefit with substantially less stimulation than continuous DBS, and sensing-based adaptive DBS has recently entered clinical use. Which biomarker and controller work best for whom is still being researched.',
        ],
        steps: [
          'Keep medication OFF and the patient at rest. Select L 0–2 and choose Capture OFF in the spectrum panel.',
          'In the Adaptive DBS panel, switch adaptive stimulation on with left contact 1. Watch the delivered amplitude follow the sensed beta estimate.',
          'Compare the mean amplitude and the beta power with continuous stimulation at the maximum amplitude.',
        ],
        tools: ['adaptive', 'spectrum'],
        task: 'The threshold is set below the lowest value the beta estimate ever reaches. How will the adaptive system behave?',
        options: [
          'It will never stimulate',
          'It will stimulate continuously at its maximum amplitude, like conventional DBS',
          'It will stimulate only during movement',
        ],
        correct: 1,
        feedback: 'If sensed beta is always above threshold, the controller ramps up and stays at its maximum, which is continuous DBS with extra steps.',
        hint: 'Compare the estimate with the threshold at every moment. Which way does the amplitude ramp?',
        sources: [read.little, read.burstsAdbs, read.neumann],
      },
      {
        id: 'tune-adaptive',
        title: 'Tune the controller',
        intro: 'A controller is only as good as its sensing band, threshold, smoothing and ramp.',
        explain: [
          'The sensing band should sit on the patient’s own beta peak. A band placed off the peak senses mostly background, so the controller rarely triggers. The threshold sets how much beta is tolerated before stimulation rises.',
          'Smoothing trades noise for speed: a short time constant follows individual bursts, a long one follows slower changes such as medication cycles. The ramp speed limits how quickly amplitude can change, which matters for comfort as well as responsiveness.',
        ],
        steps: [
          'Find the left beta peak in the spectrum with stimulation off, then set the sensing centre to it.',
          'Set the threshold near the middle of the estimate’s usual range, a fast ramp (6–12 mA/s) and short smoothing (0.1–0.25 s), with a maximum of 3 mA.',
          'Let it run for 20 seconds without changing settings, then compare beta and mean amplitude with your OFF capture.',
        ],
        tools: ['adaptive', 'spectrum'],
        task: 'The sensing band is centred at 30 Hz but the patient’s beta peak is at 19 Hz. What is the likely result?',
        options: [
          'The controller rarely stimulates because the band senses mostly background activity',
          'The controller stimulates harder because 30 Hz is a higher frequency',
          'The stimulation frequency changes to 30 Hz',
        ],
        correct: 0,
        feedback: 'An off-peak band carries little of the patient’s beta, so the estimate stays low and rarely crosses the threshold.',
        hint: 'What does the band-pass filter pass through to the estimate when the beta peak lies outside it?',
        sources: [read.little, read.arlotti, read.neumann],
      },
    ],
  },
]

export const lessons = modules.flatMap((m) => m.lessons)
export const moduleOf = (lessonId: string) => modules.find((m) => m.lessons.some((l) => l.id === lessonId))!
export const practicalLesson = (m: CourseModule) => m.lessons.find((l) => l.practical) ?? m.lessons.at(-1)!
