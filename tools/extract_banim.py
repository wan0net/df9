#!/usr/bin/env python3
"""Extract .banim animation files from Spacebase DF-9 to JSON format.

.banim binary format (Double Fine's MungeAnim output):
    Header: 'ANM ' (4B) + uncompressed_size (u32) + compressed_size (u32)
    Payload: zlib raw deflate (wbits=-15)

Decompressed payload (DFAnimData packed format):
    [0:4]   u32 flags (always 0)
    [4:8]   f32 duration (seconds)
    [8]     u8  version (1)
    [9]     u8  num_curves (quantized animation channels)
    [10..]  per-curve packed u16 quantized keyframe samples

The curves are packed quantized streams from MOAI's MOAIAnimCurve.
Each curve maps to a single component (tx/ty/tz/rx/ry/rz/rw/sx/sy/sz)
of a specific bone. The mapping to bones follows the .brig bone order:
curves 0-9 = bone 0 (tx,ty,tz,rx,ry,rz,rw,sx,sy,sz), etc.

Usage:
    python extract_banim.py <input.banim> [output.json]
    python extract_banim.py --all <asset_dir> <output_dir>
"""

import struct
import zlib
import json
import os
import sys
import glob


def decompress_banim(path):
    """Decompress a .banim file and return raw bytes."""
    with open(path, 'rb') as f:
        data = f.read()

    magic = data[:4]
    if magic != b'ANM ':
        raise ValueError(f"Bad magic: {magic!r} (expected b'ANM ')")

    usize = struct.unpack_from('<I', data, 4)[0]
    csize = struct.unpack_from('<I', data, 8)[0]

    dec = zlib.decompress(data[12:12 + csize], -15)
    if len(dec) != usize:
        raise ValueError(f"Size mismatch: got {len(dec)}, expected {usize}")

    return dec


def parse_banim_packed(data):
    """Parse the DFAnimData packed format.

    Returns a dict with metadata and raw curve data for glTF conversion.
    """
    off = 0

    # Header
    flags = struct.unpack_from('<I', data, off)[0]; off += 4
    duration = struct.unpack_from('<f', data, off)[0]; off += 4
    version = data[off]; off += 1
    num_curves = data[off]; off += 1

    result = {
        'flags': flags,
        'duration': duration,
        'version': version,
        'numCurves': num_curves,
        'curves': [],
    }

    # Parse packed curves
    # The remaining data contains num_curves worth of quantized u16 samples.
    # Total remaining bytes / 2 = total u16 values.
    # These are distributed across num_curves channels.
    remaining = len(data) - off
    total_u16 = remaining // 2

    if num_curves == 0:
        return result

    # Each curve has the same number of samples (total / num_curves)
    # OR curves have variable length with a per-curve header.
    # Based on data analysis, try uniform sample count first.
    samples_per_curve = total_u16 // num_curves if num_curves > 0 else 0

    # Components per bone: tx, ty, tz, qx, qy, qz, qw, sx, sy, sz = 10
    components_per_bone = 10
    num_bones = num_curves // components_per_bone

    result['numBones'] = num_bones
    result['samplesPerCurve'] = samples_per_curve
    result['fps'] = 30.0  # MOAI default

    # Read all curves as quantized u16 arrays
    for c in range(num_curves):
        samples = []
        for _ in range(samples_per_curve):
            if off + 2 <= len(data):
                val = struct.unpack_from('<H', data, off)[0]
                samples.append(val)
                off += 2
        result['curves'].append(samples)

    # Consume any remaining bytes
    result['remainingBytes'] = len(data) - off

    return result


def try_parse_banim(data):
    """Parse .banim data using the packed DFAnimData format."""
    try:
        result = parse_banim_packed(data)
        if result['numCurves'] > 0 and result['duration'] > 0:
            return result
    except Exception:
        pass

    # Fallback: raw dump for manual inspection
    return {
        'raw': True,
        'size': len(data),
        'header_bytes': [data[i] for i in range(min(64, len(data)))],
    }


def export_json(anim_data, json_path):
    """Write animation data to JSON."""
    with open(json_path, 'w') as f:
        json.dump(anim_data, f, indent=2)


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    if sys.argv[1] == '--all':
        if len(sys.argv) < 3:
            print("Usage: python extract_banim.py --all <asset_dir> [output_dir]")
            sys.exit(1)

        asset_dir = sys.argv[2]
        output_dir = sys.argv[3] if len(sys.argv) > 3 else 'animations'
        os.makedirs(output_dir, exist_ok=True)

        banim_files = glob.glob(os.path.join(asset_dir, '**/*.banim'), recursive=True)
        success = fail = raw = 0
        for path in sorted(banim_files):
            fname = os.path.splitext(os.path.basename(path))[0]
            try:
                dec = decompress_banim(path)
                anim = try_parse_banim(dec)

                json_path = os.path.join(output_dir, f"{fname}.json")
                export_json(anim, json_path)

                if anim.get('raw'):
                    print(f"RAW  {fname}: {anim['size']} bytes")
                    raw += 1
                else:
                    nc = anim['numCurves']
                    nb = anim.get('numBones', 0)
                    dur = anim['duration']
                    print(f"OK   {fname}: {nc} curves, ~{nb} bones, {dur:.2f}s")
                    success += 1
            except Exception as e:
                print(f"FAIL {fname}: {e}")
                fail += 1

        print(f"\n{success} parsed, {raw} raw dumps, {fail} failed")

    else:
        input_path = sys.argv[1]
        output_path = sys.argv[2] if len(sys.argv) > 2 else input_path.rsplit('.', 1)[0] + '.json'

        dec = decompress_banim(input_path)
        anim = try_parse_banim(dec)
        export_json(anim, output_path)

        if anim.get('raw'):
            print(f"WARNING: Could not parse structure, saved raw dump to {output_path}")
        else:
            nc = anim['numCurves']
            nb = anim.get('numBones', 0)
            dur = anim['duration']
            print(f"Exported {output_path}: {nc} curves, ~{nb} bones, {dur:.2f}s")
