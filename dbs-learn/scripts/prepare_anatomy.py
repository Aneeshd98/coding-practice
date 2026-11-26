"""Build the brain and head surfaces used by the 3D view.

Input: the CC BY-SA 4.0 adapted atlas surfaces distributed with Cortex Atlas
(public/anatomy/cortex.mesh and scalp.mesh in github.com/jeetblahiri/eeg-learn),
themselves adapted from Z-Anatomy, BodyParts3D (DBCLS) and the Lee Perry-Smith
head scan. See public/anatomy/ATTRIBUTION.txt.

Changes made here: the cerebral surface is split into connected anatomical parts;
small parts lying entirely inside the deep core are dropped (the deep targets are
drawn separately as labelled schematic shapes); the remaining parts are grouped
into left and right cerebrum, cerebellum and brainstem; coordinates are
re-expressed in millimetres in an MNI-like frame (x right, y anterior, z superior,
origin near the anterior commissure); and the result is re-quantized.

Usage: python3 scripts/prepare_anatomy.py <folder containing cortex.mesh and scalp.mesh>
"""
import json
import struct
import sys
from pathlib import Path

import numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components

source = Path(sys.argv[1])
out = Path(__file__).resolve().parents[1] / "public" / "anatomy"


def load(path):
    b = path.read_bytes()
    if b[:4] != b"NSG1":
        raise ValueError(f"{path} is not a quantized atlas surface")
    n, t = struct.unpack("<II", b[4:12])
    v = np.frombuffer(b[12 : 12 + n * 6], dtype="<i2").reshape(-1, 3) / 8192
    f = np.frombuffer(b[12 + n * 6 : 12 + n * 6 + t * 2], dtype="<u2").reshape(-1, 3).astype(np.int64)
    # Source axes: x right, y superior, z anterior.
    return np.stack([v[:, 0], v[:, 2], v[:, 1]], 1), f


brain, faces = load(source / "cortex.mesh")
scalp, scalp_faces = load(source / "scalp.mesh")

edges = np.concatenate([faces[:, [0, 1]], faces[:, [1, 2]], faces[:, [2, 0]]])
graph = coo_matrix((np.ones(len(edges)), (edges[:, 0], edges[:, 1])), shape=(len(brain), len(brain)))
count, label = connected_components(graph, directed=False)

# Fit an MNI-like millimetre frame to the cerebral bounding box.
# Reference cerebral extents in MNI152 space (mm): x ±70, y -104..71, z -46..79.
lo, hi = brain.min(0), brain.max(0)
mni_lo, mni_hi = np.array([-70, -104, -72]), np.array([70, 71, 79])
scale = (mni_hi - mni_lo) / (hi - lo)
s = float(np.mean(scale))
centre_src = (lo + hi) / 2
centre_mni = (mni_lo + mni_hi) / 2


def to_mm(p):
    return (p - centre_src) * s + centre_mni


groups = {"cerebrum_left": [], "cerebrum_right": [], "cerebellum": [], "brainstem": []}
dropped = 0
for c in range(count):
    idx = np.where(label == c)[0]
    p = to_mm(brain[idx])
    m, a, b = p.mean(0), p.min(0), p.max(0)
    deep = np.all(np.abs([a[0], b[0]]) < 38) and a[2] > -40 and b[2] < 38 and a[1] > -45 and b[1] < 48
    if deep:
        dropped += 1
        continue
    if m[1] < -40 and m[2] < -12:
        groups["cerebellum"].append(c)
    elif abs(m[0]) < 18 and m[2] < -18:
        groups["brainstem"].append(c)
    else:
        groups["cerebrum_left" if m[0] < 0 else "cerebrum_right"].append(c)

parts = []
blobs = []
offset = 0


def emit(name, verts, tris):
    global offset
    q = np.round(verts * 64).astype("<i2")  # 1/64 mm steps
    blob = q.tobytes() + tris.astype("<u4").tobytes()
    parts.append({"name": name, "vertices": len(verts), "triangles": len(tris), "offset": offset})
    blobs.append(blob)
    offset += len(blob)


for name, comps in groups.items():
    keep = np.isin(label, comps)
    vid = np.where(keep)[0]
    remap = -np.ones(len(brain), dtype=np.int64)
    remap[vid] = np.arange(len(vid))
    tri = faces[np.all(keep[faces], 1)]
    emit(name, to_mm(brain[vid]), remap[tri])

emit("scalp", to_mm(scalp), scalp_faces)

out.mkdir(parents=True, exist_ok=True)
(out / "brain.bin").write_bytes(b"".join(blobs))
(out / "brain.json").write_text(json.dumps({"format": "int16 xyz in 1/64 mm, then uint32 triangle indices", "parts": parts}, indent=1) + "\n")
print(f"{count} source parts, {dropped} deep parts dropped, scale {s:.2f} mm per source unit")
for p in parts:
    print(p)
