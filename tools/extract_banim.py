#!/usr/bin/env python3
"""Extract .banim animation files from Spacebase DF-9 to JSON format.

.banim binary format (Double Fine / MOAI DFAnimData):
    Header: 'ANM ' (4B) + uncompressed_size (u32) + compressed_size (u32)
    Payload: zlib raw deflate (wbits=-15)

Decompressed payload:
    [0:4]   f32 sample_interval (0 = all CONSTANT, 1/30 = 30fps)
    [4:8]   f32 duration (seconds)
    [8]     u8  version (always 1)
    [9]     u8  num_curves (total joint + visibility curves)

Curve data (after 10-byte header):
    5-byte bone table header: [0, 0, 0, num_animated_bones, 0]
    Per animated bone:
        4-byte descriptor: [bone_index, 0, num_curves, first_attr]
        Per curve (first uses first_attr; subsequent have u8 attr prefix):
            Read u32: if == 1 → CONSTANT (f32 value follows)
                       else → CURVE (low u16 = keyframe count)
            CURVE format: seek back 2, f32 min, f32 max,
                          count × (u16 time, u16 value) keyframes

    Optional visibility section at end:
        u32(1) marker + u16(count) + count × (u16 target, u32 type, f32/curve)
    Or u16(0) if no visibility curves.

Attr IDs: 0=PIV_X 1=PIV_Y 2=PIV_Z 3=LOC_X 4=LOC_Y 5=LOC_Z
           6=ROT_X 7=ROT_Y 8=ROT_Z 9=SCL_X 10=SCL_Y 11=SCL_Z

Usage:
    python extract_banim.py <input.banim> [output.json]
    python extract_banim.py --all <asset_dir> [output_dir]
"""

import struct
import zlib
import json
import os
import sys
import glob

ATTR_NAMES = [
    'PIV_X', 'PIV_Y', 'PIV_Z',
    'LOC_X', 'LOC_Y', 'LOC_Z',
    'ROT_X', 'ROT_Y', 'ROT_Z',
    'SCL_X', 'SCL_Y', 'SCL_Z',
]


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


def parse_banim(data):
    """Parse the DFAnimData binary format.

    Returns a dict with:
        sample_interval, duration, version, num_curves,
        bones: [{bone_index, curves: [{attr, type, value|keyframes, min, max}]}],
        visibility: [{target, type, value|keyframes, min, max}]
    """
    sample_interval = struct.unpack_from('<f', data, 0)[0]
    duration = struct.unpack_from('<f', data, 4)[0]
    version = data[8]
    num_curves = data[9]

    result = {
        'sample_interval': sample_interval,
        'duration': duration,
        'version': version,
        'num_curves': num_curves,
        'bones': [],
        'visibility': [],
    }

    if num_curves == 0:
        return result

    curve_data = data[10:]
    off = 0

    # 5-byte bone table header
    num_animated_bones = curve_data[3]
    off = 5

    total_parsed = 0

    for _bi in range(num_animated_bones):
        bone_idx = curve_data[off]
        num_c = curve_data[off + 2]
        first_attr = curve_data[off + 3]
        off += 4

        bone = {'bone_index': bone_idx, 'curves': []}
        attrs = [first_attr]

        for ci in range(num_c):
            if ci > 0:
                attrs.append(curve_data[off])
                off += 1

            attr_id = attrs[ci]
            marker = struct.unpack_from('<I', curve_data, off)[0]

            if marker == 1:
                # TRACK_CONSTANT
                val = struct.unpack_from('<f', curve_data, off + 4)[0]
                bone['curves'].append({
                    'attr': attr_id,
                    'attr_name': ATTR_NAMES[attr_id] if attr_id < len(ATTR_NAMES) else f'attr{attr_id}',
                    'type': 'constant',
                    'value': val,
                })
                off += 8
            else:
                # TRACK_CURVE: low u16 = keyframe count
                count = marker & 0xFFFF
                fmin = struct.unpack_from('<f', curve_data, off + 2)[0]
                fmax = struct.unpack_from('<f', curve_data, off + 6)[0]
                kf_off = off + 10

                keyframes = []
                for k in range(count):
                    t_raw = struct.unpack_from('<H', curve_data, kf_off + k * 4)[0]
                    v_raw = struct.unpack_from('<H', curve_data, kf_off + k * 4 + 2)[0]
                    t_sec = (t_raw / 65535.0) * duration if duration > 0 else 0
                    v_actual = fmin + (v_raw / 65535.0) * (fmax - fmin)
                    keyframes.append({'time': t_sec, 'value': v_actual})

                bone['curves'].append({
                    'attr': attr_id,
                    'attr_name': ATTR_NAMES[attr_id] if attr_id < len(ATTR_NAMES) else f'attr{attr_id}',
                    'type': 'curve',
                    'min': fmin,
                    'max': fmax,
                    'keyframes': keyframes,
                })
                off = kf_off + count * 4

            total_parsed += 1

        result['bones'].append(bone)

    # Visibility section
    remaining = len(curve_data) - off
    if remaining >= 6:
        vis_marker = struct.unpack_from('<I', curve_data, off)[0]
        off += 4
        if vis_marker == 1:
            vis_count = struct.unpack_from('<H', curve_data, off)[0]
            off += 2
            for _vi in range(vis_count):
                target = struct.unpack_from('<H', curve_data, off)[0]
                tt = struct.unpack_from('<I', curve_data, off + 2)[0]
                if tt == 1:
                    val = struct.unpack_from('<f', curve_data, off + 6)[0]
                    result['visibility'].append({
                        'target': target,
                        'type': 'constant',
                        'value': val,
                    })
                    off += 10
                else:
                    count = tt & 0xFFFF
                    fmin = struct.unpack_from('<f', curve_data, off + 4)[0]
                    fmax = struct.unpack_from('<f', curve_data, off + 8)[0]
                    kf_off = off + 12
                    keyframes = []
                    for k in range(count):
                        t_raw = struct.unpack_from('<H', curve_data, kf_off + k * 4)[0]
                        v_raw = struct.unpack_from('<H', curve_data, kf_off + k * 4 + 2)[0]
                        t_sec = (t_raw / 65535.0) * duration
                        v_actual = fmin + (v_raw / 65535.0) * (fmax - fmin)
                        keyframes.append({'time': t_sec, 'value': v_actual})
                    result['visibility'].append({
                        'target': target,
                        'type': 'curve',
                        'min': fmin,
                        'max': fmax,
                        'keyframes': keyframes,
                    })
                    off = kf_off + count * 4
                total_parsed += 1

    if total_parsed != num_curves:
        raise ValueError(f"Parsed {total_parsed}/{num_curves} curves")

    return result


# Backward-compatible wrapper used by convert_to_gltf.py
def try_parse_banim(data):
    """Parse .banim data, returning a dict suitable for glTF conversion."""
    try:
        result = parse_banim(data)
        return result
    except Exception:
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
        success = fail = 0
        for path in sorted(banim_files):
            fname = os.path.splitext(os.path.basename(path))[0]
            try:
                dec = decompress_banim(path)
                anim = parse_banim(dec)

                json_path = os.path.join(output_dir, f"{fname}.json")
                export_json(anim, json_path)

                nb = len(anim['bones'])
                nc = anim['num_curves']
                nv = len(anim['visibility'])
                dur = anim['duration']
                print(f"OK   {fname}: {nc} curves ({nb} bones, {nv} vis), {dur:.2f}s")
                success += 1
            except Exception as e:
                print(f"FAIL {fname}: {e}")
                fail += 1

        print(f"\n{success} parsed, {fail} failed out of {success + fail}")

    else:
        input_path = sys.argv[1]
        output_path = sys.argv[2] if len(sys.argv) > 2 else input_path.rsplit('.', 1)[0] + '.json'

        dec = decompress_banim(input_path)
        anim = parse_banim(dec)
        export_json(anim, output_path)

        nb = len(anim['bones'])
        nc = anim['num_curves']
        nv = len(anim['visibility'])
        dur = anim['duration']
        print(f"Exported {output_path}: {nc} curves ({nb} bones, {nv} vis), {dur:.2f}s")
