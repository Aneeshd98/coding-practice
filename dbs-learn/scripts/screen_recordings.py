"""Screen OpenNeuro ds004998 participants for the real-recording lesson.

For each participant with peri-operative four-contact recordings: take the first run of a task
recorded both OFF and ON levodopa, extract rest 5-65 s with prepare_recording.py (streamed, using
the participant's montage), skip it if a marked bad segment falls in that window, and report the
bipolar pair per side with the clearest OFF beta peak and its ON/OFF beta power ratio. Pairs that
use a contact marked bad in either condition are left out.

Usage: python3 scripts/screen_recordings.py <scratch folder> scripts/prepare_recording.py <id,id,...>
"""
import csv, io, json, re, subprocess, sys, urllib.request
import numpy as np
from scipy.signal import welch
D, SCRIPT = sys.argv[1], sys.argv[2]
B = 'https://s3.amazonaws.com/openneuro.org/ds004998'
get = lambda u: urllib.request.urlopen(u, timeout=30).read().decode('utf-8-sig')
subjects = [s for s in sys.argv[3].split(',')]
for s in subjects:
    try:
        rows = list(csv.DictReader(io.StringIO(get(f'{B}/sub-{s}/ses-PeriOp/montage/sub-{s}_ses-PeriOp_montage.tsv')), delimiter='\t'))
        mapping = ','.join([f'R{i}={r["right_contacts_old"]}' for i, r in enumerate(rows)] + [f'L{i}={r["left_contacts_old"]}' for i, r in enumerate(rows)])
        listing = urllib.request.urlopen(f'https://s3.amazonaws.com/openneuro.org?list-type=2&prefix=ds004998/sub-{s}/', timeout=30).read().decode()
        keys = re.findall(r'<Key>([^<]+_run-1(?:_split-01)?_meg\.fif)</Key>', listing)
        task = next(t for t in ('HoldL', 'HoldR', 'MoveL', 'MoveR') if any(f'task-{t}_acq-MedOff' in k for k in keys) and any(f'task-{t}_acq-MedOn' in k for k in keys))
        out = {}
        for med in ('MedOff', 'MedOn'):
            stem = f'{B}/sub-{s}/ses-PeriOp/meg/sub-{s}_ses-PeriOp_task-{task}_acq-{med}_run-1'
            fif = next(k for k in keys if f'task-{task}_acq-{med}_run-1' in k)
            ev = list(csv.DictReader(io.StringIO(get('https://s3.amazonaws.com/openneuro.org/' + fif.replace('_meg.fif', '_events.tsv'))), delimiter='\t'))
            rest = [e for e in ev if e['trial_type'] == 'rest']
            bad = [(float(e['onset']), float(e['onset']) + float(e['duration'])) for e in ev if 'bad' in e['trial_type']]
            assert rest and float(rest[0]['onset']) == 0 and float(rest[0]['duration']) >= 70, 'no rest at start'
            assert not any(a < 66 and b > 4 for a, b in bad), 'bad segment in window'
            st = {r['name']: r['status'] for r in csv.DictReader(io.StringIO(get(stem + '_channels.tsv')), delimiter='\t')}
            f = f'{D}/{s}-{med}.bin'
            cmd = f"curl -sS --max-time 300 -r 0-300000000 'https://s3.amazonaws.com/openneuro.org/{fif}' | python3 -I {SCRIPT} {f} 4 60 '{mapping}'"
            r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
            info = json.loads([l for l in r.stdout.splitlines() if l.startswith('{')][0])
            out[med] = (np.frombuffer(open(f, 'rb').read(), '<i2').reshape(-1, 8) * 0.01, [st.get(m.split('=')[1]) for m in mapping.split(',')])
        names = [m.split('=')[0] for m in mapping.split(',')]
        line = []
        for side in 'LR':
            best = None
            for a, b in ((0, 1), (1, 2), (2, 3), (0, 2), (1, 3)):
                ia, ib = names.index(f'{side}{a}'), names.index(f'{side}{b}')
                if 'bad' in (out['MedOff'][1][ia], out['MedOff'][1][ib], out['MedOn'][1][ia], out['MedOn'][1][ib]): continue
                res = []
                for med in ('MedOff', 'MedOn'):
                    x = out[med][0][:, ia] - out[med][0][:, ib]
                    fr, p = welch(x, fs=250, nperseg=500)
                    beta = (fr >= 13) & (fr <= 35); k = np.argmax(np.where(beta, p, 0))
                    flank = p[(np.abs(fr - fr[k]) >= 3) & (np.abs(fr - fr[k]) <= 6)].mean()
                    res.append((np.trapezoid(p[beta], fr[beta]), fr[k], p[k] / flank))
                if best is None or res[0][2] > best[1][0][2]: best = (f'{side}{a}-{b}', res)
            if best:
                (po, fo, ro), (pn, fn, rn) = best[1]
                line.append(f'{best[0]} OFF peak {fo:4.1f}Hz prom {ro:3.1f} | ON prom {rn:3.1f} | ON/OFF {pn / po:4.2f}')
        print(s, task, ' || '.join(line), flush=True)
    except Exception as e:
        print(s, 'skipped:', type(e).__name__, str(e)[:120], flush=True)
