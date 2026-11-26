"""Build the MRI slice volume used by the 3D view.

Input: the ICBM 152 Nonlinear Symmetrical 2009c template as distributed by TemplateFlow
(tpl-MNI152NLin2009cSym), at 1 mm:
  tpl-MNI152NLin2009cSym_res-1_T1w.nii.gz
  tpl-MNI152NLin2009cSym_res-1_desc-brain_mask.nii.gz
from https://templateflow.s3.amazonaws.com/tpl-MNI152NLin2009cSym/. Its licence (the
McGill copyright notice) is reproduced in public/anatomy/MNI152-LICENSE.txt and must
accompany every copy.

Changes made here: the T1-weighted image is cropped to a box around the deep nuclei,
voxels outside the template's brain mask are set to 0, and intensities inside the mask
are rescaled to 1-255 (1st to 99.5th percentile) and stored as 8-bit values.

Usage: python3 scripts/prepare_mri.py <folder containing the two files above>
"""
import gzip
import json
import struct
import sys
from pathlib import Path

import numpy as np

source = Path(sys.argv[1])
out = Path(__file__).resolve().parents[1] / "public" / "anatomy"

# Crop box in template millimetres (x right, y anterior, z superior), inclusive.
LO = np.array([-60, -60, -40])
HI = np.array([60, 40, 50])
DTYPES = {2: np.uint8, 4: np.int16, 8: np.int32, 16: np.float32, 64: np.float64, 512: np.uint16}


def read_nifti(path):
    """Minimal NIfTI-1 reader: little-endian, single volume, sform affine."""
    b = gzip.decompress(path.read_bytes())
    if struct.unpack("<i", b[:4])[0] != 348:
        raise ValueError(f"{path} is not a little-endian NIfTI-1 file")
    dim = struct.unpack("<8h", b[40:56])
    datatype = struct.unpack("<h", b[70:72])[0]
    vox_offset = int(struct.unpack("<f", b[108:112])[0])
    slope, inter = struct.unpack("<2f", b[112:120])
    sform_code = struct.unpack("<h", b[254:256])[0]
    if sform_code <= 0:
        raise ValueError(f"{path} has no sform affine")
    affine = np.array([struct.unpack("<4f", b[280 + 16 * r : 296 + 16 * r]) for r in range(3)] + [[0, 0, 0, 1]])
    shape = dim[1 : 1 + dim[0]][:3]
    data = np.frombuffer(b, dtype=np.dtype(DTYPES[datatype]).newbyteorder("<"), count=int(np.prod(shape)), offset=vox_offset)
    data = data.reshape(shape, order="F").astype(np.float64)
    if slope not in (0.0, 1.0) or inter != 0.0:
        data = data * (slope or 1.0) + inter
    return data, affine


t1, affine = read_nifti(source / "tpl-MNI152NLin2009cSym_res-1_T1w.nii.gz")
mask, mask_affine = read_nifti(source / "tpl-MNI152NLin2009cSym_res-1_desc-brain_mask.nii.gz")
if not np.allclose(affine, mask_affine):
    raise ValueError("T1 and mask are not on the same grid")
if not np.allclose(np.abs(np.diag(affine)[:3]), 1) or not np.allclose(affine[:3, :3], np.diag(np.diag(affine)[:3])):
    raise ValueError("expected an axis-aligned 1 mm grid")

# Voxel index for each millimetre coordinate in the box.
inv = np.linalg.inv(affine)
xs, ys, zs = (np.arange(LO[a], HI[a] + 1) for a in range(3))
ix = np.rint(inv[0, 0] * xs + inv[0, 3]).astype(int)
iy = np.rint(inv[1, 1] * ys + inv[1, 3]).astype(int)
iz = np.rint(inv[2, 2] * zs + inv[2, 3]).astype(int)
box = t1[np.ix_(ix, iy, iz)]
inside = mask[np.ix_(ix, iy, iz)] > 0.5
lo, hi = np.percentile(t1[mask > 0.5], [1, 99.5])
scaled = np.where(inside, np.clip(np.rint(1 + 254 * (box - lo) / (hi - lo)), 1, 255), 0).astype(np.uint8)

# x varies fastest, then y, then z: the layout of a WebGL 3D texture (width, height, depth).
(out / "mri.bin").write_bytes(scaled.transpose(2, 1, 0).tobytes())
(out / "mri.json").write_text(
    json.dumps(
        {
            "format": "uint8 volume, x fastest, then y, then z; 0 = outside the brain mask",
            "origin": LO.tolist(),
            "spacing": 1,
            "shape": [len(xs), len(ys), len(zs)],
            "source": "ICBM 152 Nonlinear Symmetrical 2009c (TemplateFlow tpl-MNI152NLin2009cSym), T1w, res-1",
            "licence": "MNI152-LICENSE.txt",
        },
        indent=2,
    )
    + "\n"
)
print("wrote", out / "mri.bin", scaled.shape, f"{scaled.nbytes / 1e6:.2f} MB", "inside:", f"{inside.mean():.0%}")
