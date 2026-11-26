# Subthalamic Lab · clinical review pack

_Generated from the course by `npm run review-pack`. Do not edit by hand: change the course, then regenerate._

This pack lists everything the course teaches, the assumptions of its simulated patient, how the assessment is graded and where the real recording comes from, so that a qualified reviewer (a movement-disorders neurologist, a clinical neurophysiologist or an experienced DBS programmer) can check it in one pass. It has not yet been reviewed.

**Reviewer:** … **Role:** … **Date:** … **Course version (commit):** …

## How to review

For each item, tick _Accurate_ or _Needs change_ and say what to change. The questions below apply throughout.

1. Is any statement wrong, outdated or misleading for the intended learners (clinicians, engineers and students new to DBS sensing)?
2. Are the simplifications in the assumptions table acceptable for teaching, and is each one disclosed where it matters?
3. Does any wording read as programming or clinical advice? The course must not be used for clinical decisions.
4. Is the real-recording lesson’s selection disclosure adequate?
5. Are the further-reading links appropriate for each lesson?

## 1. Assumptions of the simulated patient

| Area | As implemented | Simplification | Review |
| --- | --- | --- | --- |
| Leads and contacts | Four ring contacts, 1.5 mm long, 2 mm centre to centre; contact 0 deepest. Optional directional lead splits contacts 1 and 2 into three segments, 120° apart (a anterior, b posterolateral, c posteromedial). | Generic geometry, not a specific device. | ☐ OK ☐ Change |
| Patient variability | Per side: beta peak 16–26 Hz; edge of the beta generator 1.3–4.7 mm above the centre of contact 0; beta-source direction anywhere around the lead. Gamma 66–82 Hz; pallidal theta 5–9 Hz (dystonia); tremor 4.5–7 Hz. | Uniform random ranges chosen for teaching, not population statistics. | ☐ OK ☐ Change |
| Beta generator | A contact sees the generator through a sigmoid of its height relative to the edge (0.6 mm length scale); bipolar beta is largest across the edge. | One sharp-edged dorsolateral source; real sources are distributed. | ☐ OK ☐ Change |
| Beta bursts and levodopa | OFF: bursts last 0.45 s on average; ON: 0.2 s, 1.3 times as frequent, with half the background envelope, so beta power falls. The change takes effect with a 4 s time constant. | Levodopa normally acts over tens of minutes; compressed so a lesson can show it. | ☐ OK ☐ Change |
| Movement | Contralateral beta falls to 25% (ipsilateral 85%) with a 0.12 s time constant, then rebounds to 145% for 1.2 s after the movement stops (0.7 s ipsilaterally). | Stylised event-related desynchronisation and rebound. | ☐ OK ☐ Change |
| Heartbeat | The implant case in the chest is the reference, so the ECG reaches every contact almost equally (2.5% of a 1 mV witness, rising 1.8% per contact) and largely cancels in bipolar pairs. | Real cardiac artefact depends on implant side and posture. | ☐ OK ☐ Change |
| Stimulation artefact | About 250 µV per mA at the stimulating contact, falling as 1/(1 + d/0.75 mm); the 130 Hz fundamental aliases to 120 Hz at 250 Hz sampling; the amplifier saturates at ±400 µV, where clipping creates an aliased harmonic at 20 Hz. | No device-specific filtering or blanking is modelled. | ☐ OK ☐ Change |
| Stimulation and beta | Beta is suppressed by up to 80%, building with a 0.25 s and decaying with a 1.2 s time constant, scaled by charge per pulse (chronaxie 40 µs) and by distance from the generator edge. Stimulation ramps up over 0.5 s. | Suppression is a smooth function of amplitude; no plasticity or long-term effects. | ☐ OK ☐ Change |
| Dyskinesia gamma | With dyskinesia ON levodopa, narrowband gamma appears; under stimulation whose half-frequency lies in 55–95 Hz it locks to half the stimulation frequency. | Entrainment is all-or-none above half the ramp. | ☐ OK ☐ Change |
| Adaptive DBS | Single-threshold controller: band-pass of ±3 Hz around a chosen centre on the pair flanking the stimulating contact, rectified and smoothed; amplitude ramps up while the estimate is above threshold and down below it, within set limits. | One of many published control schemes; no safety logic beyond limits. | ☐ OK ☐ Change |
| Field and side effects | Activation radius 1.9·√(I / (1 + c/PW)) mm; chronaxie 40 µs for the beneficial elements and 120 µs for internal-capsule and oculomotor fibres, placed lateral and medial to the STN. | Illustrative sphere model, not a validated volume of tissue activated. | ☐ OK ☐ Change |
| A day of chronic sensing | Beta logged every 10 minutes; each dose acts from about 30 minutes, peaks near an hour and wanes over about 3 hours; sleep (23:00–07:00) lowers beta to 55%; peak-dose gamma when the medication effect exceeds 0.78. | Smooth pharmacokinetic curve with no meals, stress or circadian detail. | ☐ OK ☐ Change |
| Directional beta | A segment sees the beta source scaled by 1 + 0.75·cos(angle to the source); segments are compared with their level’s average. | A single point-like source direction. | ☐ OK ☐ Change |
| Other targets | Dystonia (GPi): low-frequency peak, unaffected by levodopa, reduced by stimulation. Essential tremor (VIM): tremor-frequency activity with posture, mostly opposite the active hand, reduced with tremor by stimulation. | Highly simplified; the course states this. | ☐ OK ☐ Change |
| Analysis | Welch spectra (Hann, 50% overlap); beta band 13–35 Hz; a peak counts when it is a local maximum at least 2.5 times the mean of bins 3–6 Hz either side; bursts above the 75th percentile of the beta envelope for at least 100 ms. | Conventional choices; thresholds vary between studies. | ☐ OK ☐ Change |

## 2. Lessons

### Module 1: Leads and sensing

_Follow a voltage from the subthalamic nucleus to a pair of lead contacts._

#### 1.1 Where the lead sits

> Meet the virtual patient: one lead in each subthalamic nucleus, four contacts per lead.

**What it teaches**

- In Parkinson’s disease, DBS leads are often placed in the subthalamic nucleus (STN). Its dorsolateral part is the motor region, where pathological beta activity tends to be strongest. Each lead in this lab has four ring contacts, 1.5 mm long with 0.5 mm gaps, numbered 0 (deepest) to 3.
- A local field potential (LFP) is the summed electrical activity of many nearby neurons, mostly synaptic currents. STN LFPs are small, typically a few microvolts (µV), much smaller than the stimulation pulses delivered through the same lead.

**Checkpoint:** Which contact sits deepest in the brain?

- Contact 3 — _shown if chosen:_ Contact 3 is the highest contact, nearest the top of the lead. Numbering starts at the tip.
- **Contact 0** (correct)
- They are all at the same depth — _shown if chosen:_ The contacts are spaced along the lead, 2 mm apart centre to centre, so each sits at a different depth.

Feedback when correct: Contacts are numbered from the tip upward, so contact 0 is the deepest (most ventral) contact.

Further reading: [Oscillatory nature of human basal ganglia activity: relationship to the pathophysiology of Parkinson's disease](https://pubmed.ncbi.nlm.nih.gov/?term=Oscillatory%20nature%20of%20human%20basal%20ganglia%20activity%3A%20relationship%20to%20the%20pathophysiology%20of%20Parkinson's%20disease); [Device profile of the percept PC deep brain stimulation system](https://pubmed.ncbi.nlm.nih.gov/?term=Device%20profile%20of%20the%20percept%20PC%20deep%20brain%20stimulation%20system)

- [ ] Accurate  - [ ] Needs change: …

#### 1.2 Why record between contacts

> A contact referenced to the case picks up everything in between. Two neighbouring contacts mostly share it.

**What it teaches**

- In a monopolar recording, each contact is compared with the implant case. Activity that reaches both contacts of a pair almost equally, such as distant brain activity, slow drift and the heartbeat, appears large there.
- A bipolar recording subtracts two neighbouring contacts. Whatever they share cancels, leaving the local difference. This is why sensing-enabled systems record between contacts, and why the heartbeat (ECG) seen from a chest-mounted case largely disappears in a bipolar pair.

**Prediction:** When you switch from Monopolar to Sandwich pairs, what will happen to the regular cardiac spikes?

- **They will mostly disappear** (expected)
- They will grow larger
- They will stay the same size

Shown afterwards: The spikes mostly vanish. The heart reaches both contacts of a pair almost equally, and a shared signal cancels in a subtraction.

**Checkpoint:** The heartbeat is large in every monopolar contact but almost absent in L 0–2. Why?

- **The heart signal reaches both contacts nearly equally and cancels in the subtraction** (correct)
- The heart stops beating during bipolar recording — _shown if chosen:_ The heart keeps beating: the ECG witness shows it throughout. What changes is the subtraction, not the heart.
- Bipolar recordings filter out all frequencies below 100 Hz — _shown if chosen:_ A bipolar pair keeps low frequencies, including beta at 13–35 Hz. Cardiac pickup disappears because both contacts share it, not because of a filter.

Feedback when correct: A common input cancels in a difference. Only the small difference between the two contacts’ cardiac pickup remains.

Further reading: [Device profile of the percept PC deep brain stimulation system](https://pubmed.ncbi.nlm.nih.gov/?term=Device%20profile%20of%20the%20percept%20PC%20deep%20brain%20stimulation%20system); [Toward Electrophysiology-Based Intelligent Adaptive Deep Brain Stimulation for Movement Disorders](https://pubmed.ncbi.nlm.nih.gov/?term=Toward%20Electrophysiology-Based%20Intelligent%20Adaptive%20Deep%20Brain%20Stimulation%20for%20Movement%20Disorders)

- [ ] Accurate  - [ ] Needs change: …

#### 1.3 Find the beta contacts

> The pair with the most beta tells you where the motor STN meets the lead.

**What it teaches**

- Beta activity (roughly 13–35 Hz) is generated within the motor STN. Two contacts both inside the generator, or both outside it, see similar signals, so their difference is small. A pair that straddles the edge of the beta region shows the largest bipolar beta.
- Clinicians use this kind of contact survey to help choose which contact to stimulate. Here, the true edge of the beta region is hidden until you reveal it, and each new virtual patient has a different one.

**Checkpoint:** Adjacent pair 1–2 shows a clear beta peak while 0–1 and 2–3 show almost none. Where is the edge of the beta generator most likely to be?

- Below contact 0 — _shown if chosen:_ If the edge were below contact 0, all four contacts would sit outside the generator together, and every pair would show little beta.
- **Between contacts 1 and 2** (correct)
- Above contact 3 — _shown if chosen:_ If the edge were above contact 3, all four contacts would sit inside the generator. They would see similar beta, so every pair’s difference would be small.

Feedback when correct: Contacts 0 and 1 share the generator and 2 and 3 share its absence. The difference is largest across the edge between 1 and 2.

Further reading: [Oscillatory nature of human basal ganglia activity: relationship to the pathophysiology of Parkinson's disease](https://pubmed.ncbi.nlm.nih.gov/?term=Oscillatory%20nature%20of%20human%20basal%20ganglia%20activity%3A%20relationship%20to%20the%20pathophysiology%20of%20Parkinson's%20disease); [Reduction in subthalamic 8-35 Hz oscillatory activity correlates with clinical improvement in Parkinson's disease](https://pubmed.ncbi.nlm.nih.gov/?term=Reduction%20in%20subthalamic%208-35%20Hz%20oscillatory%20activity%20correlates%20with%20clinical%20improvement%20in%20Parkinson's%20disease)

**Module practical** (graded from the learner’s own recording): Which left adjacent pair has the most beta power?

- Medication OFF, stimulation off, at rest. Set Montage to Adjacent pairs and wait 8 seconds.
- Compare the beta power of L 0–1, L 1–2 and L 2–3 in the spectrum panel over the last 8 seconds.

On passing: You located the edge of the beta generator from the recorded contact pairs.

- [ ] Accurate  - [ ] Needs change: …

#### 1.4 Directional leads

> Segmented contacts split a ring into three directions, so you can ask where around the lead the beta comes from.

**What it teaches**

- A ring contact wraps all the way round the lead, so it averages every direction. Directional leads split the middle two levels into three segments, here a, b and c, 120° apart. A segment that faces the beta generator sees more of it than one facing away.
- Comparing segments takes care. Against the implant case, every segment also picks up the heartbeat and distant activity, which can swamp a directional difference. Comparing each segment with the average of its own level removes what the three share, so the directional part stands out. In studies of directional recordings, the segment with the most beta often matched the direction that worked best for stimulation.
- In this lab, segment a faces anterior, b posterolateral and c posteromedial. In a real patient, the lead’s rotation must first be confirmed on imaging before a segment’s direction can be trusted.

**Checkpoint:** Against the case, the three segments of a level show almost the same beta power. Against their level’s average, one clearly stands out. Why?

- **The heartbeat and far-field activity reach all three segments equally. They swamp the difference against the case but cancel against the level average** (correct)
- Segments facing away from the generator record nothing at all — _shown if chosen:_ Segments facing away still record beta, only less of it. If they recorded nothing, the against-the-case bars would differ a lot.
- Referencing to the case filters out the beta band — _shown if chosen:_ The case reference filters nothing: each segment against the case still contains its beta. The problem is what is added on top of it.

Feedback when correct: Shared signals add the same power to every segment, so the ratios between segments shrink. Subtracting the level’s average removes what is shared and leaves what differs by direction.

Further reading: [Directional local field potentials: A tool to optimize deep brain stimulation](https://pubmed.ncbi.nlm.nih.gov/?term=Directional%20local%20field%20potentials%3A%20A%20tool%20to%20optimize%20deep%20brain%20stimulation); [Device profile of the percept PC deep brain stimulation system](https://pubmed.ncbi.nlm.nih.gov/?term=Device%20profile%20of%20the%20percept%20PC%20deep%20brain%20stimulation%20system)

- [ ] Accurate  - [ ] Needs change: …

### Module 2: Beta and medication

_Read an LFP spectrum and measure how levodopa changes beta power._

#### 2.1 Read an LFP spectrum

> Power spectral density shows how signal power spreads across frequencies.

**What it teaches**

- The spectrum panel plots power spectral density in µV²/Hz on a logarithmic axis. LFP spectra fall with frequency, a smooth aperiodic (1/f-like) background. Oscillations appear as peaks above it. In Parkinson’s disease OFF medication, STN LFPs often show a peak in the beta band, here 13–35 Hz.
- Band power is the area under the spectrum over a band, in µV². It includes the background beneath the peak, so a rise in band power is not proof of a new oscillation unless a peak stands out.

**Checkpoint:** A spectrum rises smoothly toward low frequencies and has a narrow bump at 21 Hz. Which part is the beta oscillation?

- The smooth rise toward low frequencies — _shown if chosen:_ The smooth rise is the aperiodic background found in every recording. An oscillation shows as a peak above that background.
- **The narrow bump at 21 Hz** (correct)
- The highest point on the plot — _shown if chosen:_ The highest point is usually at the lowest frequencies, where the background is largest. A peak above its surroundings marks an oscillation, not height alone.

Feedback when correct: The bump above the aperiodic background is the oscillation. The low-frequency rise is the background itself.

Further reading: [Parameterizing neural power spectra into periodic and aperiodic components](https://pubmed.ncbi.nlm.nih.gov/?term=Parameterizing%20neural%20power%20spectra%20into%20periodic%20and%20aperiodic%20components); [Oscillatory nature of human basal ganglia activity: relationship to the pathophysiology of Parkinson's disease](https://pubmed.ncbi.nlm.nih.gov/?term=Oscillatory%20nature%20of%20human%20basal%20ganglia%20activity%3A%20relationship%20to%20the%20pathophysiology%20of%20Parkinson's%20disease)

- [ ] Accurate  - [ ] Needs change: …

#### 2.2 Levodopa and beta

> Give the virtual patient levodopa and measure what happens to the beta peak.

**What it teaches**

- Dopaminergic medication reduces STN beta activity, and the size of that reduction has been linked to improvement in slowness and rigidity. In people the change develops over tens of minutes. This lab compresses it into about 10 seconds.
- A fair comparison uses the same contact pair, the same window length and settled states: wait until the medication effect has stabilized before capturing.

**Prediction:** What will levodopa do to resting STN beta power?

- Raise it
- Leave it unchanged
- **Lower it** (expected)

Shown afterwards: Beta power falls ON levodopa, and long, large beta bursts become shorter.

**Checkpoint:** Why wait before capturing the ON window?

- **So the medication effect has settled and the window reflects one state** (correct)
- The amplifier needs time to warm up — _shown if chosen:_ The recording runs continuously and needs no warm-up. The wait is about the patient’s state, not the equipment.
- Beta only exists 15 seconds after any change — _shown if chosen:_ Beta is present OFF and ON. The wait lets the medication effect settle, so the window does not mix two states.

Feedback when correct: A window that straddles the transition mixes OFF and ON activity and underestimates the change.

Further reading: [Reduction in subthalamic 8-35 Hz oscillatory activity correlates with clinical improvement in Parkinson's disease](https://pubmed.ncbi.nlm.nih.gov/?term=Reduction%20in%20subthalamic%208-35%20Hz%20oscillatory%20activity%20correlates%20with%20clinical%20improvement%20in%20Parkinson's%20disease); [Oscillatory nature of human basal ganglia activity: relationship to the pathophysiology of Parkinson's disease](https://pubmed.ncbi.nlm.nih.gov/?term=Oscillatory%20nature%20of%20human%20basal%20ganglia%20activity%3A%20relationship%20to%20the%20pathophysiology%20of%20Parkinson's%20disease)

**Module practical** (graded from the learner’s own recording): By what factor did beta power fall? (OFF power ÷ ON power)

- Select L 0–2. With medication OFF and at rest, choose Capture OFF (20 seconds).
- Switch medication ON, wait at least 15 seconds, then choose Capture ON with L 0–2 still selected.

On passing: You measured a medication effect from two settled, matched windows on the same contact pair.

- [ ] Accurate  - [ ] Needs change: …

#### 2.3 A real patient, OFF and ON

> The same comparison in real data: one minute of rest from each STN, before and after levodopa.

**What it teaches**

- This recording comes from an openly shared dataset of people with Parkinson’s disease whose DBS leads were externalised after surgery and recorded at rest OFF and then ON levodopa (Rassoulou et al., 2024; OpenNeuro ds004998, CC0). The contacts were recorded against the amplifier’s reference; the panel forms bipolar pairs, as in the simulator.
- Real data are less tidy than the simulator. In this patient a clear beta peak, and its fall ON levodopa, appear on some contact pairs and not others. One contact was marked bad during the ON recording, so pairs that use it cannot be compared.
- Many patients show no clear beta peak in a minute of rest. In the participants screened for this lesson, fewer than half did; this patient was chosen because both sides do. The panel’s note gives the numbers and the selection criterion.

**Prediction:** On the pair with this patient’s clearest OFF beta peak, what will beta power be ON levodopa?

- Higher
- **Lower** (expected)
- About the same

Shown afterwards: Lower: on L 2–3 beta power falls to about 0.6 times its OFF value, and similarly on R 0–1. Pairs without a clear OFF peak change little.

**Checkpoint:** Fewer than half of the patients screened for this lesson showed a clear beta peak in a minute of rest. What is the best conclusion?

- Those patients cannot have Parkinson’s disease — _shown if chosen:_ Every participant in this dataset has Parkinson’s disease. Beta is a frequent finding, not a universal one, and one short recording can miss it.
- **A missing peak in one short recording does not rule out pathological beta: it varies between patients, contacts and recording conditions** (correct)
- Beta oscillations are only found in simulations — _shown if chosen:_ This patient’s real recording shows a clear beta peak that falls ON levodopa on two pairs, as many studies report.

Feedback when correct: Beta is a frequent but not universal marker. Studies look across many patients and contacts; one minute from a few contacts can miss it.

Further reading: [Exploring the electrophysiology of Parkinson's disease with magnetoencephalography and deep brain recordings](https://pubmed.ncbi.nlm.nih.gov/?term=Exploring%20the%20electrophysiology%20of%20Parkinson's%20disease%20with%20magnetoencephalography%20and%20deep%20brain%20recordings); [Reduction in subthalamic 8-35 Hz oscillatory activity correlates with clinical improvement in Parkinson's disease](https://pubmed.ncbi.nlm.nih.gov/?term=Reduction%20in%20subthalamic%208-35%20Hz%20oscillatory%20activity%20correlates%20with%20clinical%20improvement%20in%20Parkinson's%20disease)

- [ ] Accurate  - [ ] Needs change: …

#### 2.4 A second biomarker: gamma

> Too much dopamine has its own signature: a narrow peak in the gamma range.

**What it teaches**

- When levodopa produces involuntary movements (peak-dose dyskinesia), chronic recordings from the STN and motor cortex have shown a narrow oscillation, usually between 60 and 90 Hz. Unlike beta, which tracks being under-treated, this gamma can indicate being over-treated.
- During stimulation this gamma often locks to exactly half the stimulation frequency, for example 65 Hz at 130 Hz. A good sensing setup therefore has to tell an entrained brain rhythm from an artifact. A controller using both biomarkers could avoid stimulating too little or too much.

**Prediction:** When stimulation starts at 130 Hz, where will the narrow gamma peak go?

- It will move to 130 Hz
- **It will lock to 65 Hz, half the stimulation frequency** (expected)
- It will stay at its own frequency

Shown afterwards: The gamma peak locks to 65 Hz. Under stimulation, this narrowband gamma can entrain to half the stimulation frequency.

**Checkpoint:** With dyskinesia and stimulation at 130 Hz, a narrow peak appears at exactly 65 Hz. What is the best interpretation?

- **Gamma entrained to half the stimulation frequency** (correct)
- The aliased stimulation artifact — _shown if chosen:_ At 250 Hz sampling the 130 Hz artifact folds to 250 − 130 = 120 Hz, not to 65 Hz.
- A beta burst at a higher frequency — _shown if chosen:_ Beta lies at 13–35 Hz. A narrow peak at exactly half the stimulation frequency points to entrainment.

Feedback when correct: Dyskinesia-related gamma tends to lock to half the stimulation frequency. The 130 Hz artifact aliases to 120 Hz at 250 Hz sampling, not to 65 Hz.

Further reading: [Gamma oscillations in the hyperkinetic state detected with chronic human brain recordings in Parkinson’s disease](https://pubmed.ncbi.nlm.nih.gov/?term=Gamma%20oscillations%20in%20the%20hyperkinetic%20state%20detected%20with%20chronic%20human%20brain%20recordings%20in%20Parkinson%E2%80%99s%20disease); [Reduction in subthalamic 8-35 Hz oscillatory activity correlates with clinical improvement in Parkinson's disease](https://pubmed.ncbi.nlm.nih.gov/?term=Reduction%20in%20subthalamic%208-35%20Hz%20oscillatory%20activity%20correlates%20with%20clinical%20improvement%20in%20Parkinson's%20disease)

- [ ] Accurate  - [ ] Needs change: …

#### 2.5 Beta across the day

> Sensing implants log beta power every few minutes for weeks. Read a day of it.

**What it teaches**

- Chronic sensing records average power in a narrow band around the patient’s beta peak at regular intervals, often every 10 minutes. Plotted over a day, it shows how symptoms and treatment interact outside the clinic.
- Beta dips after each levodopa dose and rises again as the dose wears off. It is also lower during sleep. Moving or adding doses changes how long beta stays high (under-treated) and can introduce periods of peak-dose gamma (over-treated). Real logs are noisier and also reflect activity, posture and artifacts.

**Prediction:** If you remove the 15:00 dose, what will happen to the hours of high beta?

- **They will increase in the afternoon** (expected)
- They will fall
- Nothing will change

Shown afterwards: Without the 15:00 dose, the earlier dose wears off and beta stays high through the afternoon, so under-treated hours increase.

**Checkpoint:** On a 10-minute beta log, beta climbs steadily during the hour before each scheduled dose and falls within an hour of taking it. What does this pattern most likely show?

- **Wearing off between doses** (correct)
- Sleep — _shown if chosen:_ Sleep lowers beta for hours overnight. It does not rise and fall with each daytime dose.
- Stimulation artifact — _shown if chosen:_ A stimulation artifact would not climb before each dose and fall after it. Timing tied to doses points to medication.

Feedback when correct: Beta rising as the previous dose fades, and falling once the next takes effect, is the signature of wearing off.

Further reading: [Device profile of the percept PC deep brain stimulation system](https://pubmed.ncbi.nlm.nih.gov/?term=Device%20profile%20of%20the%20percept%20PC%20deep%20brain%20stimulation%20system); [Toward Electrophysiology-Based Intelligent Adaptive Deep Brain Stimulation for Movement Disorders](https://pubmed.ncbi.nlm.nih.gov/?term=Toward%20Electrophysiology-Based%20Intelligent%20Adaptive%20Deep%20Brain%20Stimulation%20for%20Movement%20Disorders); [Reduction in subthalamic 8-35 Hz oscillatory activity correlates with clinical improvement in Parkinson's disease](https://pubmed.ncbi.nlm.nih.gov/?term=Reduction%20in%20subthalamic%208-35%20Hz%20oscillatory%20activity%20correlates%20with%20clinical%20improvement%20in%20Parkinson's%20disease)

- [ ] Accurate  - [ ] Needs change: …

### Module 3: Bursts and movement

_See beta as a series of bursts and watch it fall during movement._

#### 3.1 Beta comes in bursts

> Beta is not a steady tone. It waxes and wanes in bursts of different lengths.

**What it teaches**

- Band-pass the signal around the beta peak and compute its amplitude envelope. A common definition marks a burst when the envelope exceeds its 75th percentile for at least 100 ms. OFF medication, long bursts are more frequent, and longer bursts have been linked to worse motor symptoms.
- The threshold matters. If you recompute the 75th percentile separately for the ON recording, about a quarter of every recording is labelled as bursting no matter what the medication did. To compare states, fix the threshold from a baseline, such as the OFF recording, and apply it to both.

**Prediction:** With one fixed threshold, how will beta bursts ON levodopa compare with OFF?

- Longer
- The same
- **Shorter** (expected)

Shown afterwards: ON levodopa, bursts measured against the OFF threshold are shorter. A fixed threshold is what lets the difference show.

**Checkpoint:** You set the threshold separately in each recording at its own 75th percentile. What is the problem?

- **Each recording is forced to spend a similar fraction of time above threshold, hiding real amplitude changes** (correct)
- The 75th percentile cannot be computed for ON data — _shown if chosen:_ A percentile can be computed for any recording, ON or OFF. The issue is what it does to the comparison.
- Burst durations become negative — _shown if chosen:_ Durations run from one threshold crossing to the next and are always positive. The issue is that each recording gets its own yardstick.

Feedback when correct: A percentile threshold adapts to each recording. A fixed threshold from a baseline lets a weaker state show fewer and shorter bursts.

Further reading: [Beta burst dynamics in Parkinson's disease OFF and ON dopaminergic medication](https://pubmed.ncbi.nlm.nih.gov/?term=Beta%20burst%20dynamics%20in%20Parkinson's%20disease%20OFF%20and%20ON%20dopaminergic%20medication); [The modulatory effect of adaptive deep brain stimulation on beta bursts in Parkinson's disease](https://pubmed.ncbi.nlm.nih.gov/?term=The%20modulatory%20effect%20of%20adaptive%20deep%20brain%20stimulation%20on%20beta%20bursts%20in%20Parkinson's%20disease)

- [ ] Accurate  - [ ] Needs change: …

#### 3.2 Movement and the beta rebound

> Ask the virtual patient to move a hand, and watch beta fall and then overshoot.

**What it teaches**

- Beta power in the STN falls during voluntary movement (event-related desynchronization), most strongly in the hemisphere opposite the moving hand. After movement stops it briefly rises above baseline, the post-movement beta rebound.
- Averaging power across many cued trials, aligned to the cue, reveals this time course even though each single trial is noisy. Average power, not raw voltage: the beta phase differs across trials and would cancel in a voltage average.

**Prediction:** During right-hand movement, what will left STN beta do?

- Stay unchanged
- **Fall during the movement, then briefly overshoot after it stops** (expected)
- Rise during the movement

Shown afterwards: Left STN beta falls during right-hand movement and rebounds above its resting level for about a second after the stop cue.

**Checkpoint:** The right hand moves. Where should beta suppression be strongest?

- Right STN — _shown if chosen:_ The right STN mainly serves the left side of the body. Beta drops there too, but less.
- **Left STN** (correct)
- Equal on both sides — _shown if chosen:_ Beta falls on both sides with movement, but more on the side opposite the moving hand.

Feedback when correct: Motor control is largely crossed, so the left STN, contralateral to the right hand, shows the larger drop.

Further reading: [Event-related beta desynchronization in human subthalamic nucleus correlates with motor performance](https://pubmed.ncbi.nlm.nih.gov/?term=Event-related%20beta%20desynchronization%20in%20human%20subthalamic%20nucleus%20correlates%20with%20motor%20performance); [Beta burst dynamics in Parkinson's disease OFF and ON dopaminergic medication](https://pubmed.ncbi.nlm.nih.gov/?term=Beta%20burst%20dynamics%20in%20Parkinson's%20disease%20OFF%20and%20ON%20dopaminergic%20medication)

**Module practical** (graded from the learner’s own recording): What is the mean ON burst duration using the OFF threshold?

- Use your OFF and ON captures from L 0–2 (capture again if needed).
- In the burst panel, choose Threshold: fixed from OFF capture and read the ON mean burst duration.

On passing: With a fixed baseline threshold, levodopa’s effect shows up as shorter bursts.

- [ ] Accurate  - [ ] Needs change: …

### Module 4: Stimulation and artifacts

_Turn on stimulation, understand its artifact, and see why sandwich sensing works._

#### 4.1 The stimulation artifact

> Stimulation pulses are thousands of times larger than the LFP and arrive through the same lead.

**What it teaches**

- Stimulation commonly runs at around 130 Hz. At 250 samples per second the Nyquist frequency is 125 Hz, so a 130 Hz artifact cannot be represented and folds back to 250 − 130 = 120 Hz. Its harmonic at 260 Hz folds to 10 Hz.
- Close to the stimulating contact the artifact can exceed the amplifier’s input range. A saturated (clipped) channel loses the LFP entirely for as long as it stays at the limit. Clipping also creates new harmonics: the 4th harmonic of 130 Hz (520 Hz) folds to 520 − 2 × 250 = 20 Hz, a convincing but entirely artificial “beta peak”.

**Prediction:** Which pair will show the larger stimulation artifact with stimulation at contact 1?

- **L 0–1, which contains the stimulating contact** (expected)
- L 2–3, which does not
- Both the same

Shown afterwards: The pair containing the stimulating contact shows a far larger artifact. The artifact falls off with distance, so contacts 2 and 3 see smaller, more similar amounts, and more of it cancels.

**Checkpoint:** Stimulation runs at 130 Hz and the LFP is sampled at 250 Hz. Where does the artifact appear in the spectrum?

- 130 Hz — _shown if chosen:_ 130 Hz is above the Nyquist frequency (125 Hz at 250 Hz sampling), so it cannot appear there. It folds back to 250 − 130 = 120 Hz.
- **120 Hz** (correct)
- 65 Hz — _shown if chosen:_ 65 Hz is half the stimulation frequency, where entrained gamma can appear with dyskinesia. The artifact itself folds to 120 Hz.

Feedback when correct: 130 Hz lies above the 125 Hz Nyquist limit and folds back to 250 − 130 = 120 Hz.

Further reading: [Device profile of the percept PC deep brain stimulation system](https://pubmed.ncbi.nlm.nih.gov/?term=Device%20profile%20of%20the%20percept%20PC%20deep%20brain%20stimulation%20system); [Toward Electrophysiology-Based Intelligent Adaptive Deep Brain Stimulation for Movement Disorders](https://pubmed.ncbi.nlm.nih.gov/?term=Toward%20Electrophysiology-Based%20Intelligent%20Adaptive%20Deep%20Brain%20Stimulation%20for%20Movement%20Disorders)

- [ ] Accurate  - [ ] Needs change: …

#### 4.2 Sandwich sensing

> Record from the two contacts on either side of the stimulating contact.

**What it teaches**

- When contact 1 stimulates, contacts 0 and 2 are the same distance from it, so they see nearly the same artifact. In the pair 0–2 the artifact largely cancels, just as the heartbeat did. This symmetric arrangement is often called sandwich sensing.
- Tissue is never perfectly symmetric, so a small residual remains. It sits near 120 Hz, well away from the beta band, so beta can still be measured during stimulation.

**Checkpoint:** Stimulation is on contact 2. Which pair gives sandwich sensing?

- 0–1 — _shown if chosen:_ Contacts 0 and 1 sit at different distances from contact 2, so they pick up different amounts of artifact and it does not cancel.
- **1–3** (correct)
- 2–3 — _shown if chosen:_ The pair 2–3 contains the stimulating contact itself, so the full artifact enters the recording.

Feedback when correct: Contacts 1 and 3 sit 2 mm either side of contact 2, so the artifact is nearly equal on both and cancels.

Further reading: [Device profile of the percept PC deep brain stimulation system](https://pubmed.ncbi.nlm.nih.gov/?term=Device%20profile%20of%20the%20percept%20PC%20deep%20brain%20stimulation%20system); [Toward Electrophysiology-Based Intelligent Adaptive Deep Brain Stimulation for Movement Disorders](https://pubmed.ncbi.nlm.nih.gov/?term=Toward%20Electrophysiology-Based%20Intelligent%20Adaptive%20Deep%20Brain%20Stimulation%20for%20Movement%20Disorders)

- [ ] Accurate  - [ ] Needs change: …

#### 4.3 Stimulation suppresses beta

> Effective stimulation near the beta generator reduces beta, the signal adaptive DBS uses.

**What it teaches**

- Stimulation near the motor STN suppresses beta power and shortens beta bursts. The effect depends on amplitude and on how close the stimulating contact is to the generator.
- Adaptive (closed-loop) DBS uses this relationship: it measures beta through a sandwich pair and raises or lowers stimulation according to beta power. This course stops before closed-loop control. The sensing principles here are what it relies on.

**Prediction:** As you raise the amplitude at contact 1, what will happen to beta in L 0–2?

- It will rise
- It will not change
- **It will fall progressively** (expected)

Shown afterwards: Beta falls as the amplitude rises, and recovers over about a second when stimulation is reduced.

**Checkpoint:** Adaptive DBS adjusts stimulation according to beta power measured during stimulation. Which recording makes that possible?

- A monopolar contact next to the stimulating contact — _shown if chosen:_ A monopolar contact is compared with the case in the chest, so nothing cancels the large stimulation artifact.
- **A sandwich pair flanking the stimulating contact** (correct)
- The pair containing the stimulating contact — _shown if chosen:_ A pair containing the stimulating contact records the full artifact, which can saturate the amplifier.

Feedback when correct: The flanking pair cancels most of the artifact, so beta remains measurable while stimulation runs.

Further reading: [Adaptive deep brain stimulation in advanced Parkinson disease](https://pubmed.ncbi.nlm.nih.gov/?term=Adaptive%20deep%20brain%20stimulation%20in%20advanced%20Parkinson%20disease); [The modulatory effect of adaptive deep brain stimulation on beta bursts in Parkinson's disease](https://pubmed.ncbi.nlm.nih.gov/?term=The%20modulatory%20effect%20of%20adaptive%20deep%20brain%20stimulation%20on%20beta%20bursts%20in%20Parkinson's%20disease); [Toward Electrophysiology-Based Intelligent Adaptive Deep Brain Stimulation for Movement Disorders](https://pubmed.ncbi.nlm.nih.gov/?term=Toward%20Electrophysiology-Based%20Intelligent%20Adaptive%20Deep%20Brain%20Stimulation%20for%20Movement%20Disorders)

**Module practical** (graded from the learner’s own recording): At what frequency does the stimulation artifact appear in L 2–3?

- Set Montage to Adjacent pairs. Turn stimulation on at left contact 1, at least 1.5 mA, 130 Hz.
- Wait 2 seconds, select L 2–3 and find the artifact peak between 90 and 125 Hz in the spectrum (4 s window).

On passing: You found the aliased stimulation artifact where the sampling theory predicts it.

- [ ] Accurate  - [ ] Needs change: …

### Module 5: Program the stimulator

_Test each contact for benefit and side effects, and choose the widest therapeutic window._

#### 5.1 Run a monopolar review

> Test one contact at a time, raising the amplitude until benefit appears and then until a side effect does.

**What it teaches**

- After implantation, clinicians test each contact in turn with the implant case as the return electrode (monopolar). For each contact they raise the amplitude in small steps, note the lowest amplitude giving clear benefit (for example, reduced rigidity) and the lowest amplitude producing a side effect.
- The difference between the two is the therapeutic window. A wide window lets the patient be treated comfortably and leaves room for adjustment. Here, sensing data from earlier modules gives a head start: the contacts nearest the beta region often give benefit at low amplitudes.

**Checkpoint:** Contact 2 gives benefit at 2.0 mA and muscle contraction at 2.4 mA. Contact 1 gives benefit at 1.6 mA and muscle contraction at 4.1 mA. Which is the better choice?

- Contact 2, because its side effect needs more than 2 mA — _shown if chosen:_ Its side effect starts only 0.4 mA above its benefit threshold. What matters is the gap between the two, the therapeutic window.
- **Contact 1, because its window is 2.5 mA rather than 0.4 mA** (correct)
- Either, because both give benefit — _shown if chosen:_ Both help, but contact 2 leaves only 0.4 mA before side effects. A small change in amplitude or swelling around the lead could cross it.

Feedback when correct: Contact 1 leaves 2.5 mA between benefit and side effect; contact 2 only 0.4 mA. The wider window is safer and easier to adjust.

Further reading: [Introduction to the programming of deep brain stimulators](https://pubmed.ncbi.nlm.nih.gov/?term=Introduction%20to%20the%20programming%20of%20deep%20brain%20stimulators); [Patient-specific analysis of the volume of tissue activated during deep brain stimulation](https://pubmed.ncbi.nlm.nih.gov/?term=Patient-specific%20analysis%20of%20the%20volume%20of%20tissue%20activated%20during%20deep%20brain%20stimulation)

- [ ] Accurate  - [ ] Needs change: …

#### 5.2 Where side effects come from

> Side effects tell you which neighbouring pathway the field has reached.

**What it teaches**

- The internal capsule, carrying motor fibres to the face and limbs, runs alongside the STN laterally and anteriorly. Spread into it causes muscle contraction or slurred speech. Medially and ventrally, spread towards oculomotor fibres can cause eye deviation or double vision. The type of side effect therefore hints at the direction of spread.
- Pulse width changes how much charge each pulse delivers. Shorter pulses need more current for the same effect but can affect different elements unequally. Clinical studies have reported wider therapeutic windows with short pulses (around 30 µs). In this model, short pulses spare the capsule more than the motor STN.

**Checkpoint:** Muscle contraction in the face appears at a low amplitude on an upper contact. Which structure has the field most likely reached?

- **The internal capsule** (correct)
- The red nucleus — _shown if chosen:_ Muscle contraction comes from activating motor fibres. They run in the internal capsule, lateral to the STN; the red nucleus lies medial and is not a motor fibre tract.
- The contralateral STN — _shown if chosen:_ The other STN is in the opposite hemisphere, centimetres away. A field a few millimetres across cannot reach it.

Feedback when correct: Motor fibres in the internal capsule run lateral to the STN; their activation causes muscle contraction.

Further reading: [Short pulse width widens the therapeutic window of subthalamic neurostimulation](https://pubmed.ncbi.nlm.nih.gov/?term=Short%20pulse%20width%20widens%20the%20therapeutic%20window%20of%20subthalamic%20neurostimulation); [Introduction to the programming of deep brain stimulators](https://pubmed.ncbi.nlm.nih.gov/?term=Introduction%20to%20the%20programming%20of%20deep%20brain%20stimulators); [Patient-specific analysis of the volume of tissue activated during deep brain stimulation](https://pubmed.ncbi.nlm.nih.gov/?term=Patient-specific%20analysis%20of%20the%20volume%20of%20tissue%20activated%20during%20deep%20brain%20stimulation)

**Module practical** (graded from the learner’s own recording): Which left contact has the widest therapeutic window?

- In the Monopolar review panel, keep the pulse width at 60 µs. For each left contact, raise the amplitude until rigidity is at least half relieved and record the benefit threshold.
- Keep raising it until a side effect appears and record that threshold, or record none if nothing appears by 5 mA.
- Compare the therapeutic windows in your table.

On passing: You ran a monopolar review and chose the contact with the widest margin between benefit and side effects.

- [ ] Accurate  - [ ] Needs change: …

### Module 6: Adaptive DBS

_Close the loop: let sensed beta decide when to stimulate, and tune the controller._

#### 6.1 Close the loop

> Instead of stimulating all the time, let the patient’s own beta decide when stimulation is needed.

**What it teaches**

- Adaptive (closed-loop) DBS measures a biomarker and adjusts stimulation in response. Here the biomarker is beta amplitude, sensed through the sandwich pair around the stimulating contact. A single-threshold controller ramps the amplitude up while sensed beta is above a threshold and down while it is below.
- The aim is similar benefit with less stimulation: fewer side effects and less battery use. Studies have reported clinical benefit with substantially less stimulation than continuous DBS, and sensing-based adaptive DBS has recently entered clinical use. Which biomarker and controller work best for whom is still being researched.

**Prediction:** Compared with continuous stimulation at the maximum amplitude, how much energy will adaptive DBS deliver?

- The same
- **Less** (expected)
- More

Shown afterwards: Adaptive DBS delivers less: it stimulates hard only while beta is high and turns down between bursts.

**Checkpoint:** The threshold is set below the lowest value the beta estimate ever reaches. How will the adaptive system behave?

- It will never stimulate — _shown if chosen:_ Stimulation rises whenever the estimate is above the threshold. If it is always above, the controller never turns down.
- **It will stimulate continuously at its maximum amplitude, like conventional DBS** (correct)
- It will stimulate only during movement — _shown if chosen:_ The controller follows beta, not movement. With a threshold this low, beta is above it at rest and during movement alike.

Feedback when correct: If sensed beta is always above threshold, the controller ramps up and stays at its maximum, which is continuous DBS with extra steps.

Further reading: [Adaptive deep brain stimulation in advanced Parkinson disease](https://pubmed.ncbi.nlm.nih.gov/?term=Adaptive%20deep%20brain%20stimulation%20in%20advanced%20Parkinson%20disease); [The modulatory effect of adaptive deep brain stimulation on beta bursts in Parkinson's disease](https://pubmed.ncbi.nlm.nih.gov/?term=The%20modulatory%20effect%20of%20adaptive%20deep%20brain%20stimulation%20on%20beta%20bursts%20in%20Parkinson's%20disease); [Toward Electrophysiology-Based Intelligent Adaptive Deep Brain Stimulation for Movement Disorders](https://pubmed.ncbi.nlm.nih.gov/?term=Toward%20Electrophysiology-Based%20Intelligent%20Adaptive%20Deep%20Brain%20Stimulation%20for%20Movement%20Disorders)

- [ ] Accurate  - [ ] Needs change: …

#### 6.2 Tune the controller

> A controller is only as good as its sensing band, threshold, smoothing and ramp.

**What it teaches**

- The sensing band should sit on the patient’s own beta peak. A band placed off the peak senses mostly background, so the controller rarely triggers. The threshold sets how much beta is tolerated before stimulation rises.
- Smoothing trades noise for speed: a short time constant follows individual bursts, a long one follows slower changes such as medication cycles. The ramp speed limits how quickly amplitude can change, which matters for comfort as well as responsiveness.

**Checkpoint:** The sensing band is centred at 30 Hz but the patient’s beta peak is at 19 Hz. What is the likely result?

- **The controller rarely stimulates because the band senses mostly background activity** (correct)
- The controller stimulates harder because 30 Hz is a higher frequency — _shown if chosen:_ A higher sensing frequency does not mean more stimulation. The controller responds to power in its band, and this band misses the beta peak.
- The stimulation frequency changes to 30 Hz — _shown if chosen:_ The sensing band and the stimulation frequency are separate settings. Changing what is sensed does not change what is delivered.

Feedback when correct: An off-peak band carries little of the patient’s beta, so the estimate stays low and rarely crosses the threshold.

Further reading: [Adaptive deep brain stimulation in advanced Parkinson disease](https://pubmed.ncbi.nlm.nih.gov/?term=Adaptive%20deep%20brain%20stimulation%20in%20advanced%20Parkinson%20disease); [Eight-hours adaptive deep brain stimulation in patients with Parkinson disease](https://pubmed.ncbi.nlm.nih.gov/?term=Eight-hours%20adaptive%20deep%20brain%20stimulation%20in%20patients%20with%20Parkinson%20disease); [Toward Electrophysiology-Based Intelligent Adaptive Deep Brain Stimulation for Movement Disorders](https://pubmed.ncbi.nlm.nih.gov/?term=Toward%20Electrophysiology-Based%20Intelligent%20Adaptive%20Deep%20Brain%20Stimulation%20for%20Movement%20Disorders)

**Module practical** (graded from the learner’s own recording): What mean left amplitude did your controller deliver over the last 20 seconds?

- Capture an OFF window (medication OFF, at rest, stimulation off) on L 0–2.
- Run adaptive DBS on left contact 1 with a maximum of at least 2.5 mA. Tune it, then leave the settings unchanged for 20 seconds.
- Goal: left beta at most 65% of your OFF capture, with a mean amplitude at most 40% of the maximum.

On passing: You tuned a closed-loop controller to suppress beta while delivering a fraction of continuous stimulation.

- [ ] Accurate  - [ ] Needs change: …

### Module 7: Beyond Parkinson’s

_Other disorders, other targets, other biomarkers: pallidal theta in dystonia and thalamic tremor activity._

#### 7.1 Dystonia and the pallidum (patient: dystonia, GPi)

> In dystonia the lead goes to the internal globus pallidus, and the rhythm to look for is slower.

**What it teaches**

- Deep brain stimulation for dystonia usually targets the posteroventral internal globus pallidus (GPi). Recordings there in dystonia often show increased low-frequency activity, in the theta and low alpha range (about 4–12 Hz), rather than the parkinsonian beta peak.
- Levodopa does not have the effect it has in Parkinson’s disease, and clinical improvement after GPi stimulation can take weeks to months, so a fast biomarker is especially valuable. The patient here has a pallidal low-frequency peak that stimulation reduces.

**Checkpoint:** A GPi recording in a patient with dystonia shows a clear 7 Hz peak and little beta. How should you read it?

- **As the low-frequency pallidal activity often reported in dystonia** (correct)
- As an artifact, because only beta is meaningful in DBS recordings — _shown if chosen:_ Low-frequency pallidal activity is a widely reported finding in dystonia and is studied as a possible marker, so it should not be dismissed.
- As proof that the patient has Parkinson’s disease — _shown if chosen:_ This is a GPi recording in a patient with dystonia. A 7 Hz peak with little beta is not the Parkinsonian pattern.

Feedback when correct: Biomarkers depend on the disorder and the target. In dystonia, pallidal theta–alpha activity is the commonly reported candidate.

Further reading: [Pallidal activity in dystonia: oscillatory local field potentials](https://pubmed.ncbi.nlm.nih.gov/?term=Pallidal%20activity%20in%20dystonia%3A%20oscillatory%20local%20field%20potentials); [Theta-alpha oscillations characterize emotional and motor dysfunction in dystonia](https://pubmed.ncbi.nlm.nih.gov/?term=Theta-alpha%20oscillations%20characterize%20emotional%20and%20motor%20dysfunction%20in%20dystonia)

- [ ] Accurate  - [ ] Needs change: …

#### 7.2 Tremor and the thalamus (patient: essential tremor, VIM)

> For essential tremor the lead targets the thalamus, and the brain rhythm follows the shaking hand.

**What it teaches**

- Essential tremor is commonly treated by stimulating the ventral intermediate nucleus (VIM) of the thalamus. Essential tremor is mostly an action and postural tremor, so it appears when the arms are held out or used, typically at 4–12 Hz.
- Thalamic recordings often contain activity at the tremor frequency, mainly opposite the tremoring hand, and it can be compared with an accelerometer on the hand. Effective stimulation reduces both. Because the tremor comes and goes with posture, tremor-triggered stimulation is an obvious candidate for adaptive DBS.

**Prediction:** When stimulation turns on in the left VIM, what will happen to the right-hand tremor?

- **It will shrink** (expected)
- It will grow
- It will not change

Shown afterwards: The tremor shrinks within seconds of stimulation starting, one reason the VIM is a target for tremor.

**Checkpoint:** The right arm is held out and an accelerometer shows 5.5 Hz tremor. Where is a matching 5.5 Hz LFP peak most expected?

- **Left VIM** (correct)
- Right VIM — _shown if chosen:_ Each thalamus mainly serves the opposite side of the body, so right-arm tremor is expected in the left VIM.
- Neither: tremor is purely peripheral — _shown if chosen:_ Activity at the tremor frequency has been recorded in the thalamus of people with tremor, so it is not purely peripheral.

Feedback when correct: Each thalamus mainly controls the opposite side of the body, so the left VIM carries the strongest right-hand tremor activity.

Further reading: [Essential tremor: local field potentials in the thalamus](https://pubmed.ncbi.nlm.nih.gov/?term=Essential%20tremor%3A%20local%20field%20potentials%20in%20the%20thalamus); [Toward Electrophysiology-Based Intelligent Adaptive Deep Brain Stimulation for Movement Disorders](https://pubmed.ncbi.nlm.nih.gov/?term=Toward%20Electrophysiology-Based%20Intelligent%20Adaptive%20Deep%20Brain%20Stimulation%20for%20Movement%20Disorders)

**Module practical** (graded from the learner’s own recording): At what frequency is the tremor-related activity in the left VIM?

- With the essential tremor patient (this lesson sets it), hold the right arm out and keep stimulation off for at least 8 seconds.
- Read the 3–12 Hz peak of L 0–2 in the spectrum or the tremor panel.

On passing: You measured thalamic tremor activity contralateral to the tremoring hand.

- [ ] Accurate  - [ ] Needs change: …

## 3. Patient assessment

3 unseen virtual patients; for each, the learner reports the left adjacent pair that straddles the edge of the beta region, the left beta peak frequency and the left segment facing the beta source. Grading uses the simulator’s hidden truth: both pairs are accepted when the edge lies near a contact (expected beta within 80% of the largest), the peak within ±1.5 Hz, and both segments when the source points within 15° of the line between them. A patient passes with all three right; the assessment with 2 of 3.

- [ ] Accurate  - [ ] Needs change: …

## 4. Real recording

- Source: Rassoulou F, Steina A, Hartmann CJ, Vesper J, Butz M, Schnitzler A, Hirschmann J. Exploring the electrophysiology of Parkinson's disease with magnetoencephalography and deep brain recordings. Scientific Data 11, 889 (2024). OpenNeuro ds004998 v1.2.2, doi:10.18112/openneuro.ds004998.v1.2.2, CC0 1.0 (public domain dedication).
- Participant sub-2IhVOz; 60 s of rest per condition, OFF and ON levodopa; contacts marked bad: ON L0, OFF none.
- Selection: Chosen because both sides show a clear beta peak OFF levodopa; its reduction ON (about 0.6x on the clearest pair per side) is typical rather than the largest seen.
- Screening: 14 participants screened (4 more excluded by the criterion); 6 had a clear OFF beta peak, and beta fell ON in 5 of those. Criterion: First run of a task recorded in both conditions; rest 5-65 s free of marked bad segments; bipolar pairs without bad contacts; clear peak = 13-35 Hz maximum at least 2.5 times the mean of bins 3-6 Hz either side (the course's peak test). The pair with the clearest OFF peak per side is compared, which slightly favours finding a drop ON.

- [ ] Accurate  - [ ] Needs change: …

## 5. Overall

- [ ] Suitable for teaching as is
- [ ] Suitable after the changes noted above
- [ ] Not suitable

Comments: …
