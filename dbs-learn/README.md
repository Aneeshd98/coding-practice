# Subthalamic Lab

An interactive teaching course on **deep brain stimulation (DBS) sensing**. Learners work with a live, simulated recording of local field potentials (LFPs) from two DBS leads, the way sensing-enabled DBS systems record them, beside a 3D brain in which the target nucleus glows with the patient's live activity. One lesson uses a real STN recording, OFF and ON levodopa.

> Teaching simulation only. It does not model any specific device and must not be used for clinical decisions or to choose stimulation settings. The physiology has not yet had a clinical review: see [`docs/clinical-review.md`](docs/clinical-review.md).

## Course

Seven modules, 20 lessons. Every lesson has a guide, a hands-on experiment and a checkpoint that explains why each wrong answer is wrong. Eleven lessons ask the learner to predict the outcome before the experiment opens, then compare.

| Module | Lessons | Graded practical |
|---|---|---|
| 1. Leads and sensing | Where the lead sits · Why record between contacts · Find the beta contacts · Directional leads | Find the left adjacent pair with the most beta, from the last 8 s |
| 2. Beta and medication | Read an LFP spectrum · Levodopa and beta · A real patient, OFF and ON · A second biomarker: gamma · Beta across the day | Capture settled OFF and ON windows and report the beta power ratio |
| 3. Bursts and movement | Beta comes in bursts · Movement and the beta rebound | Report the ON mean burst duration with a threshold fixed from the OFF baseline |
| 4. Stimulation and artifacts | The stimulation artifact · Sandwich sensing · Stimulation suppresses beta | Measure where the 130 Hz artifact appears at 250 Hz sampling |
| 5. Program the stimulator | Run a monopolar review · Where side effects come from | Find the contact with the widest therapeutic window |
| 6. Adaptive DBS | Close the loop · Tune the controller | Run an adaptive controller that suppresses beta while using less energy |
| 7. Beyond Parkinson's | Dystonia and the pallidum · Tremor and the thalamus | Measure the tremor-related frequency in the left VIM |

Practicals are graded from the learner's own recorded samples, so they cannot be passed by guessing, and they reject windows recorded in the wrong state.

**Patient assessment** (`#/assess`): three virtual patients the learner has not met. For each, find the beta pair, the beta peak frequency and the segment facing the beta source from the recording alone, with the beta region hidden. Answers are graded against the simulator's hidden truth; two of three patients must pass.

**Progress** is kept in the browser. The course map can export it to a file and import it elsewhere; imported assessment results are re-graded, not trusted.

## Run it

Requires Node.js 22 or newer.

```sh
npm install
npm run dev           # http://127.0.0.1:5173
npm run lint          # ESLint, including the React hooks rules
npm test              # model, DSP, grading, recording and review-pack tests
npm run build         # type-check and production build into dist/
npm run test:browser  # Playwright: learner flows and layout checks at 320-1280 px
npm run test:visual   # optional pixel snapshots, see below
npm run review-pack   # regenerate docs/clinical-review.md after changing the course
```

Set `CHROME_PATH` to use a preinstalled Chrome for the browser tests. CI (`.github/workflows/dbs-learn.yml`) runs lint, unit tests, the build and the browser tests on every push to `main` and `claude/**` branches and on pull requests, and deploys `main` to GitHub Pages.

`npm run test:visual` takes pixel snapshots of views that do not depend on the live signal. Text renders slightly differently between browser builds, so baselines are recorded on the first run on each machine (in `e2e/.visual-baselines`, not committed) and compared on later runs: use it to check a styling change before and after. The layout tests, which hold in any browser, run in CI.

## How it works

| Part | Files | What it does |
|---|---|---|
| Simulator | `src/sim/model.ts`, `src/sim/worker.ts` | Seeded generator in a Web Worker at 250 Hz: contact voltages against the implant case, an artifact-free copy, directional segments, and witness lanes (ECG, stimulation, true burst state, sensed beta, accelerometer). |
| Physiology | `model.ts`, `chronic.ts`, `field.ts` | Bursty beta shaped by medication, movement and stimulation; a hidden per-patient beta frequency, generator edge and direction; dyskinesia gamma that entrains to half the stimulation frequency; pallidal theta (dystonia) and thalamic tremor activity; ECG pickup; stimulation artifact with aliasing and saturation; an adaptive controller; a day of chronic beta; an illustrative field model for side effects. All parameters are tabulated in the review pack. |
| Signal processing | `src/dsp/` | Ring buffer with state history, montages with ±400 µV saturation, Welch spectra with a peak-prominence test, band-pass and envelope, bursts, cue-locked averages, directional beta, the spectrogram, and the real-recording analysis. |
| Course | `src/course/` | Lessons with references, practical graders, the assessment, and the review-pack generator. |
| 3D brain | `src/three/`, `src/ui/BrainPanel.tsx` | Three.js scene: glass or solid brain, schematic nuclei, leads (ring or directional), the live glow, the activation volume, the hidden beta edge and direction, and an optional MRI template slice through the target. 2D fallback without WebGL. |
| UI | `src/ui/`, `src/app/` | React app: live traces with a spectrogram strip, analysis tools, lessons, course map, free lab, assessment, progress transfer. Light and dark themes. |

Performance: with every tool open, the analysis and the trace and spectrogram drawing cause no long main-thread tasks. The cost is in rendering the 3D brain, which renders on demand and lowers its resolution when frames slow down. Analysis therefore stays on the main thread.

## Data

| Data | Source | Licence | Prepared by |
|---|---|---|---|
| Brain and head surfaces | Cortex Atlas anatomy (Z-Anatomy, BodyParts3D/DBCLS, Lee Perry-Smith head scan) | CC BY-SA 4.0 | `scripts/prepare_anatomy.py` |
| MRI slice | ICBM 152 2009c symmetric T1 template via TemplateFlow | McGill licence (notice in `public/anatomy/MNI152-LICENSE.txt`) | `scripts/prepare_mri.py` |
| Real STN recording | OpenNeuro ds004998, participant sub-2IhVOz (Rassoulou et al., Scientific Data 2024) | CC0 | `scripts/prepare_recording.py` (streams only the DBS contacts), `scripts/screen_recordings.py` |

The real participant was chosen because both sides show a clear beta peak OFF levodopa. Of 14 eligible participants screened with the course's peak test, 6 had a clear OFF peak (beta fell ON in 5 of them) and 8 had none; the lesson says so. See `public/recordings/ds004998-sub-2IhVOz.json`.

## Known simplifications

- Beta comes from an envelope-modulated oscillator with a single sharp-edged source, not a network model; the levodopa effect takes seconds rather than tens of minutes.
- The stimulation artifact, field model and adaptive controller are illustrative, not device- or patient-specific; the activation volume is not a validated volume of tissue activated.
- Deep nuclei are schematic shapes at approximate positions; the brain surfaces and MRI template are only approximately aligned.
- Dystonia and tremor are highly simplified.
- The course needs a review by a DBS clinician or electrophysiologist before learners rely on it. `docs/clinical-review.md` is prepared for that review and is regenerated from the course.

## Credits

The architecture ideas (worker-driven simulation, ring buffer, practicals graded against recorded samples, an anatomical 3D view beside the live recording) were inspired by Cortex Atlas, an EEG course by jeetblahiri. No code from that project was copied. Data credits are in `public/anatomy/ATTRIBUTION.txt` and `public/recordings/ATTRIBUTION.txt`; software and font licences in `public/THIRD-PARTY.txt`.
