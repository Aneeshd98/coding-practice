"""Extract a short resting STN LFP excerpt from OpenNeuro ds004998 for the course.

Source: Rassoulou F, Steina A, Hartmann CJ, Vesper J, Butz M, Schnitzler A, Hirschmann J.
"Exploring the electrophysiology of Parkinson's disease with magnetoencephalography and
deep brain recordings." Scientific Data 11, 889 (2024). OpenNeuro ds004998 v1.2.2,
doi:10.18112/openneuro.ds004998.v1.2.2, released under CC0.

The recordings are Elekta FIF files of 1.4-1.9 GB holding MEG together with the externalised
DBS leads, which were recorded through the EEG inputs (the subject's montage.tsv maps EEG001-004
to right STN contacts 0-3 and EEG005-008 to left STN contacts 0-3). FIF stores samples in time
order, so this reads the file as a stream, keeps only those eight channels for the first
seconds it needs, and stops: nothing else is downloaded or stored.

Processing: per channel, mean removed, zero-phase 0.5 Hz high-pass and 100 Hz low-pass
(Butterworth, order 4), decimated from 2000 to 250 Hz, and stored as int16 at 0.01 µV per step.
Contacts are kept as recorded against the amplifier reference (monopolar); the app forms
bipolar pairs.

Usage (one run per call, streamed from OpenNeuro's S3 bucket):
  curl -s -r 0-260000000 <run>_meg.fif | python3 scripts/prepare_recording.py <out.bin> <start_s> <seconds> [mapping]
where mapping names the recorded channel for each contact, from the subject's montage.tsv,
e.g. R0=EEG001,R1=EEG002,R2=EEG003,R3=EEG004,L0=EEG005,L1=EEG006,L2=EEG007,L3=EEG008 (the default).
"""
import json
import struct
import sys

import numpy as np
from scipy.signal import butter, sosfiltfilt

FIFF_NCHAN, FIFF_SFREQ, FIFF_CH_INFO, FIFF_DATA_BUFFER, FIFF_DATA_SKIP = 200, 201, 203, 300, 301
FIFF_BLOCK_START, FIFF_BLOCK_END = 104, 105
# Channel information is read only from the measurement-info block itself (head-position blocks
# nested inside it carry their own channel count and rate), and samples only from raw-data blocks.
FIFFB_MEAS_INFO, FIFFB_RAW_DATA, FIFFB_CONTINUOUS_DATA = 101, 102, 112
DTYPES = {2: ">i2", 3: ">i4", 4: ">f4", 5: ">f8"}
NAMES = [f"R{c}" for c in range(4)] + [f"L{c}" for c in range(4)]
STEP_UV = 0.01
OUT_FS = 250

out, start_s, seconds = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
mapping = dict(m.split("=") for m in (sys.argv[4] if len(sys.argv) > 4 else ",".join(f"{n}=EEG00{i + 1}" for i, n in enumerate(NAMES))).split(","))
WANTED = [mapping[n] for n in NAMES]
stream = sys.stdin.buffer


def read(n):
    b = stream.read(n)
    if len(b) < n:
        raise EOFError
    return b


nchan = sfreq = None
channels = []
blocks = []
chunks, have, need = [], 0, None
try:
    while True:
        kind, typ, size, nxt = struct.unpack(">iiii", read(16))
        if nxt not in (0, -1):
            raise ValueError("non-sequential FIF tags; download the whole file instead")
        data = read(size)
        inner = blocks[-1] if blocks else None
        if kind == FIFF_BLOCK_START:
            blocks.append(struct.unpack(">i", data[:4])[0])
        elif kind == FIFF_BLOCK_END:
            blocks.pop()
        elif inner == FIFFB_MEAS_INFO and kind == FIFF_NCHAN:
            nchan = struct.unpack(">i", data)[0]
        elif inner == FIFFB_MEAS_INFO and kind == FIFF_SFREQ:
            sfreq = struct.unpack(">f", data)[0]
        elif inner == FIFFB_MEAS_INFO and kind == FIFF_CH_INFO:
            rng, cal = struct.unpack(">ff", data[12:20])
            name = data[80:96].split(b"\0")[0].decode("latin-1")
            channels.append((name, rng * cal))
        elif inner in (FIFFB_RAW_DATA, FIFFB_CONTINUOUS_DATA) and kind == FIFF_DATA_SKIP:
            raise ValueError("data skips are not supported")
        elif inner in (FIFFB_RAW_DATA, FIFFB_CONTINUOUS_DATA) and kind == FIFF_DATA_BUFFER:
            if need is None:
                if not (nchan and sfreq and len(channels) == nchan):
                    raise ValueError("channel information missing before the data")
                index = [next(i for i, c in enumerate(channels) if c[0] == w) for w in WANTED]
                scale = np.array([channels[i][1] for i in index]) * 1e6
                skip, need = int(round(start_s * sfreq)), int(round((start_s + seconds + 2) * sfreq))
            block = np.frombuffer(data, dtype=DTYPES[typ & 0xFFFF]).reshape(-1, nchan)[:, index] * scale
            chunks.append(block)
            have += len(block)
            if have >= need:
                break
except EOFError:
    pass

if need is None or have < need:
    raise SystemExit(f"stream ended after {have} of {need} samples; fetch a larger range")
x = np.concatenate(chunks)[skip:need].astype(np.float64)
x -= x.mean(0)
sos_hp = butter(4, 0.5, "highpass", fs=sfreq, output="sos")
sos_lp = butter(4, 100, "lowpass", fs=sfreq, output="sos")
x = sosfiltfilt(sos_lp, sosfiltfilt(sos_hp, x, axis=0), axis=0)
factor = int(round(sfreq / OUT_FS))
y = x[1 * OUT_FS * factor : 1 * OUT_FS * factor + int(seconds * OUT_FS) * factor : factor]  # drop 1 s of filter edge
q = np.clip(np.rint(y / STEP_UV), -32767, 32767).astype("<i2")
open(out, "wb").write(q.tobytes())
print(json.dumps({"file": out, "fs_in": sfreq, "samples": len(q), "channels": NAMES, "rms_uv": np.sqrt((y**2).mean(0)).round(2).tolist(), "clipped": int((np.abs(y / STEP_UV) > 32767).sum())}))
