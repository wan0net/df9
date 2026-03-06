#!/usr/bin/env python3
"""Convert Spacebase DF-9 .brig models + .banim animations + textures to glTF 2.0 (.glb).

Reads:
  - .brig mesh files (via extract_brig.py parser)
  - .rig Lua files (subset→texture mapping)
  - .banim animation files (via extract_banim.py parser)
  - .png textures

Outputs:
  - .glb files with embedded meshes, skeleton, animations, and textures

Usage:
    python convert_to_gltf.py --model <model.brig> --rig <model.rig> --texdir <textures/> --animdir <animations/> -o output.glb
    python convert_to_gltf.py --batch --munged <munged_dir> --extracted <extracted_dir> -o <output_dir>
"""

import struct
import zlib
import json
import math
import os
import sys
import re
import glob
import io
from pathlib import Path

# Import sibling parsers
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'extracted_assets'))

from extract_banim import decompress_banim, try_parse_banim

# Also need the brig parser
extract_brig_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'extracted_assets', 'extract_brig.py')
if os.path.exists(extract_brig_path):
    import importlib.util
    spec = importlib.util.spec_from_file_location("extract_brig", extract_brig_path)
    extract_brig = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(extract_brig)
    decompress_brig = extract_brig.decompress_brig
    parse_brig = extract_brig.parse_brig
else:
    raise ImportError(f"Cannot find extract_brig.py at {extract_brig_path}")


# ── glTF 2.0 constants ──────────────────────────────────────────────────

GLTF_BYTE = 5120
GLTF_UNSIGNED_BYTE = 5121
GLTF_SHORT = 5122
GLTF_UNSIGNED_SHORT = 5123
GLTF_UNSIGNED_INT = 5125
GLTF_FLOAT = 5126

GLTF_ARRAY_BUFFER = 34962
GLTF_ELEMENT_ARRAY_BUFFER = 34963


def euler_to_quaternion(rx, ry, rz):
    """Convert Euler angles (XYZ order, radians) to quaternion (x, y, z, w)."""
    cx, sx = math.cos(rx / 2), math.sin(rx / 2)
    cy, sy = math.cos(ry / 2), math.sin(ry / 2)
    cz, sz = math.cos(rz / 2), math.sin(rz / 2)
    return (
        sx * cy * cz + cx * sy * sz,  # qx
        cx * sy * cz - sx * cy * sz,  # qy
        cx * cy * sz + sx * sy * cz,  # qz
        cx * cy * cz - sx * sy * sz,  # qw
    )


def mat4_from_trs(t, r_euler, s):
    """Build a 4x4 column-major matrix from translation, euler rotation, scale."""
    qx, qy, qz, qw = euler_to_quaternion(r_euler[0], r_euler[1], r_euler[2])
    # Rotation matrix from quaternion
    xx, yy, zz = qx*qx, qy*qy, qz*qz
    xy, xz, yz = qx*qy, qx*qz, qy*qz
    wx, wy, wz = qw*qx, qw*qy, qw*qz
    r00 = 1 - 2*(yy+zz); r01 = 2*(xy-wz);     r02 = 2*(xz+wy)
    r10 = 2*(xy+wz);     r11 = 1 - 2*(xx+zz); r12 = 2*(yz-wx)
    r20 = 2*(xz-wy);     r21 = 2*(yz+wx);     r22 = 1 - 2*(xx+yy)
    # Apply scale
    sx, sy, sz = s
    # Column-major for glTF
    return [
        r00*sx, r10*sx, r20*sx, 0,
        r01*sy, r11*sy, r21*sy, 0,
        r02*sz, r12*sz, r22*sz, 0,
        t[0],   t[1],   t[2],   1,
    ]


def mat4_multiply(a, b):
    """Multiply two 4x4 column-major matrices."""
    result = [0]*16
    for col in range(4):
        for row in range(4):
            s = 0
            for k in range(4):
                s += a[k*4 + row] * b[col*4 + k]
            result[col*4 + row] = s
    return result


def mat4_inverse(m):
    """Invert a 4x4 column-major matrix."""
    # Cofactor expansion
    inv = [0]*16
    inv[0] = m[5]*m[10]*m[15] - m[5]*m[11]*m[14] - m[9]*m[6]*m[15] + m[9]*m[7]*m[14] + m[13]*m[6]*m[11] - m[13]*m[7]*m[10]
    inv[4] = -m[4]*m[10]*m[15] + m[4]*m[11]*m[14] + m[8]*m[6]*m[15] - m[8]*m[7]*m[14] - m[12]*m[6]*m[11] + m[12]*m[7]*m[10]
    inv[8] = m[4]*m[9]*m[15] - m[4]*m[11]*m[13] - m[8]*m[5]*m[15] + m[8]*m[7]*m[13] + m[12]*m[5]*m[11] - m[12]*m[7]*m[9]
    inv[12] = -m[4]*m[9]*m[14] + m[4]*m[10]*m[13] + m[8]*m[5]*m[14] - m[8]*m[6]*m[13] - m[12]*m[5]*m[10] + m[12]*m[6]*m[9]
    inv[1] = -m[1]*m[10]*m[15] + m[1]*m[11]*m[14] + m[9]*m[2]*m[15] - m[9]*m[3]*m[14] - m[13]*m[2]*m[11] + m[13]*m[3]*m[10]
    inv[5] = m[0]*m[10]*m[15] - m[0]*m[11]*m[14] - m[8]*m[2]*m[15] + m[8]*m[3]*m[14] + m[12]*m[2]*m[11] - m[12]*m[3]*m[10]
    inv[9] = -m[0]*m[9]*m[15] + m[0]*m[11]*m[13] + m[8]*m[1]*m[15] - m[8]*m[3]*m[13] - m[12]*m[1]*m[11] + m[12]*m[3]*m[9]
    inv[13] = m[0]*m[9]*m[14] - m[0]*m[10]*m[13] - m[8]*m[1]*m[14] + m[8]*m[2]*m[13] + m[12]*m[1]*m[10] - m[12]*m[2]*m[9]
    inv[2] = m[1]*m[6]*m[15] - m[1]*m[7]*m[14] - m[5]*m[2]*m[15] + m[5]*m[3]*m[14] + m[13]*m[2]*m[7] - m[13]*m[3]*m[6]
    inv[6] = -m[0]*m[6]*m[15] + m[0]*m[7]*m[14] + m[4]*m[2]*m[15] - m[4]*m[3]*m[14] - m[12]*m[2]*m[7] + m[12]*m[3]*m[6]
    inv[10] = m[0]*m[5]*m[15] - m[0]*m[7]*m[13] - m[4]*m[1]*m[15] + m[4]*m[3]*m[13] + m[12]*m[1]*m[7] - m[12]*m[3]*m[5]
    inv[14] = -m[0]*m[5]*m[14] + m[0]*m[6]*m[13] + m[4]*m[1]*m[14] - m[4]*m[2]*m[13] - m[12]*m[1]*m[6] + m[12]*m[2]*m[5]
    inv[3] = -m[1]*m[6]*m[11] + m[1]*m[7]*m[10] + m[5]*m[2]*m[11] - m[5]*m[3]*m[10] - m[9]*m[2]*m[7] + m[9]*m[3]*m[6]
    inv[7] = m[0]*m[6]*m[11] - m[0]*m[7]*m[10] - m[4]*m[2]*m[11] + m[4]*m[3]*m[10] + m[8]*m[2]*m[7] - m[8]*m[3]*m[6]
    inv[11] = -m[0]*m[5]*m[11] + m[0]*m[7]*m[9] + m[4]*m[1]*m[11] - m[4]*m[3]*m[9] - m[8]*m[1]*m[7] + m[8]*m[3]*m[5]
    inv[15] = m[0]*m[5]*m[10] - m[0]*m[6]*m[9] - m[4]*m[1]*m[10] + m[4]*m[2]*m[9] + m[8]*m[1]*m[6] - m[8]*m[2]*m[5]

    det = m[0]*inv[0] + m[1]*inv[4] + m[2]*inv[8] + m[3]*inv[12]
    if abs(det) < 1e-10:
        return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]  # identity fallback
    det = 1.0 / det
    return [v * det for v in inv]


def compute_inverse_bind_matrices(bones):
    """Compute inverse bind matrices for each bone from the bone hierarchy."""
    identity = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]
    world_transforms = []

    for i, bone in enumerate(bones):
        local = mat4_from_trs(bone['translation'], bone['rotation'], bone['scale'])
        if bone['parent'] >= 0 and bone['parent'] < len(world_transforms):
            world = mat4_multiply(world_transforms[bone['parent']], local)
        else:
            world = local
        world_transforms.append(world)

    return [mat4_inverse(w) for w in world_transforms]


class GLTFBuilder:
    """Builds a glTF 2.0 binary (.glb) file."""

    def __init__(self):
        self.gltf = {
            'asset': {'version': '2.0', 'generator': 'df9-converter'},
            'scene': 0,
            'scenes': [{'nodes': []}],
            'nodes': [],
            'meshes': [],
            'accessors': [],
            'bufferViews': [],
            'buffers': [],
            'materials': [],
            'textures': [],
            'images': [],
            'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}],
        }
        self.buffer_data = bytearray()

    def _pad_to_4(self):
        """Pad buffer to 4-byte alignment."""
        while len(self.buffer_data) % 4 != 0:
            self.buffer_data.append(0)

    def add_buffer_view(self, data, target=None):
        """Add raw bytes as a buffer view. Returns buffer view index."""
        self._pad_to_4()
        offset = len(self.buffer_data)
        self.buffer_data.extend(data)
        bv = {'buffer': 0, 'byteOffset': offset, 'byteLength': len(data)}
        if target:
            bv['target'] = target
        idx = len(self.gltf['bufferViews'])
        self.gltf['bufferViews'].append(bv)
        return idx

    def add_accessor(self, buffer_view, component_type, count, accessor_type, min_vals=None, max_vals=None):
        """Add an accessor. Returns accessor index."""
        acc = {
            'bufferView': buffer_view,
            'componentType': component_type,
            'count': count,
            'type': accessor_type,
        }
        if min_vals is not None:
            acc['min'] = min_vals
        if max_vals is not None:
            acc['max'] = max_vals
        idx = len(self.gltf['accessors'])
        self.gltf['accessors'].append(acc)
        return idx

    def add_image_png(self, png_path):
        """Add a PNG image. Returns image index."""
        with open(png_path, 'rb') as f:
            png_data = f.read()
        self._pad_to_4()
        bv_idx = self.add_buffer_view(png_data)
        img = {'bufferView': bv_idx, 'mimeType': 'image/png'}
        idx = len(self.gltf['images'])
        self.gltf['images'].append(img)
        return idx

    def add_texture(self, image_idx):
        """Add a texture referencing an image. Returns texture index."""
        tex = {'source': image_idx, 'sampler': 0}
        idx = len(self.gltf['textures'])
        self.gltf['textures'].append(tex)
        return idx

    def add_material(self, name, texture_idx=None, base_color=None):
        """Add a PBR material. Returns material index."""
        pbr = {}
        if texture_idx is not None:
            pbr['baseColorTexture'] = {'index': texture_idx}
        if base_color:
            pbr['baseColorFactor'] = base_color
        pbr['metallicFactor'] = 0.0
        pbr['roughnessFactor'] = 0.8
        mat = {'name': name, 'pbrMetallicRoughness': pbr, 'doubleSided': True}
        idx = len(self.gltf['materials'])
        self.gltf['materials'].append(mat)
        return idx

    def add_mesh(self, brig_data, material_map=None):
        """Build a mesh from parsed .brig data. Returns mesh node index."""
        verts = brig_data['vertices']
        subsets = brig_data['subsets']
        has_blend = brig_data.get('has_blend', False)

        # Build shared vertex attributes
        positions = []
        normals = []
        texcoords = []
        joints = []
        weights = []

        pos_min = [float('inf')] * 3
        pos_max = [float('-inf')] * 3

        for v in verts:
            px, py, pz = v['pos']
            positions.extend([px, py, pz])
            for i, val in enumerate([px, py, pz]):
                pos_min[i] = min(pos_min[i], val)
                pos_max[i] = max(pos_max[i], val)

            nx, ny, nz = v['normal']
            normals.extend([nx, ny, nz])

            u, vv = v['uv']
            texcoords.extend([u, 1.0 - vv])  # Flip V for glTF

            if has_blend:
                b = v['blend']
                # blend = (boneIdx1, boneIdx2, weight1, weight2)
                j0 = int(b[0]) if b[0] == b[0] else 0
                j1 = int(b[1]) if b[1] == b[1] else 0
                w0 = b[2] if b[2] == b[2] else 1.0
                w1 = b[3] if b[3] == b[3] else 0.0
                joints.extend([j0, j1, 0, 0])
                weights.extend([w0, w1, 0.0, 0.0])

        # Position accessor
        pos_data = struct.pack(f'<{len(positions)}f', *positions)
        pos_bv = self.add_buffer_view(pos_data, GLTF_ARRAY_BUFFER)
        pos_acc = self.add_accessor(pos_bv, GLTF_FLOAT, len(verts), 'VEC3', pos_min, pos_max)

        # Normal accessor
        norm_data = struct.pack(f'<{len(normals)}f', *normals)
        norm_bv = self.add_buffer_view(norm_data, GLTF_ARRAY_BUFFER)
        norm_acc = self.add_accessor(norm_bv, GLTF_FLOAT, len(verts), 'VEC3')

        # Texcoord accessor
        tc_data = struct.pack(f'<{len(texcoords)}f', *texcoords)
        tc_bv = self.add_buffer_view(tc_data, GLTF_ARRAY_BUFFER)
        tc_acc = self.add_accessor(tc_bv, GLTF_FLOAT, len(verts), 'VEC2')

        # Joints + weights (if skinned)
        joints_acc = None
        weights_acc = None
        if has_blend and joints:
            j_data = struct.pack(f'<{len(joints)}H', *joints)
            j_bv = self.add_buffer_view(j_data, GLTF_ARRAY_BUFFER)
            joints_acc = self.add_accessor(j_bv, GLTF_UNSIGNED_SHORT, len(verts), 'VEC4')

            w_data = struct.pack(f'<{len(weights)}f', *weights)
            w_bv = self.add_buffer_view(w_data, GLTF_ARRAY_BUFFER)
            weights_acc = self.add_accessor(w_bv, GLTF_FLOAT, len(verts), 'VEC4')

        # Build primitives per subset
        primitives = []
        for i, subset in enumerate(subsets):
            indices = subset['indices']
            if len(indices) == 0:
                continue

            idx_data = struct.pack(f'<{len(indices)}H', *indices)
            idx_bv = self.add_buffer_view(idx_data, GLTF_ELEMENT_ARRAY_BUFFER)

            idx_min = min(indices)
            idx_max = max(indices)
            idx_acc = self.add_accessor(idx_bv, GLTF_UNSIGNED_SHORT, len(indices), 'SCALAR',
                                        [idx_min], [idx_max])

            attrs = {
                'POSITION': pos_acc,
                'NORMAL': norm_acc,
                'TEXCOORD_0': tc_acc,
            }
            if joints_acc is not None:
                attrs['JOINTS_0'] = joints_acc
                attrs['WEIGHTS_0'] = weights_acc

            prim = {'attributes': attrs, 'indices': idx_acc, 'mode': 4}

            # Assign material
            if material_map and i in material_map:
                prim['material'] = material_map[i]

            primitives.append(prim)

        mesh_idx = len(self.gltf['meshes'])
        self.gltf['meshes'].append({'primitives': primitives})

        # Create node for mesh
        node = {'mesh': mesh_idx}
        node_idx = len(self.gltf['nodes'])
        self.gltf['nodes'].append(node)
        self.gltf['scenes'][0]['nodes'].append(node_idx)

        return node_idx

    def add_skeleton(self, bones):
        """Build skeleton nodes from .brig bone data. Returns (root_node_idx, joint_node_indices)."""
        if not bones:
            return None, []

        joint_indices = []
        base_idx = len(self.gltf['nodes'])

        for i, bone in enumerate(bones):
            node = {'name': bone['name']}

            t = bone['translation']
            if any(v != 0 for v in t):
                node['translation'] = list(t)

            r = bone['rotation']
            if any(v != 0 for v in r):
                # Convert Euler XYZ (radians) to quaternion for glTF
                qx, qy, qz, qw = euler_to_quaternion(r[0], r[1], r[2])
                node['rotation'] = [qx, qy, qz, qw]

            s = bone['scale']
            if not (s[0] == 1 and s[1] == 1 and s[2] == 1):
                node['scale'] = list(s)

            self.gltf['nodes'].append(node)
            joint_indices.append(base_idx + i)

        # Set up parent-child relationships
        for i, bone in enumerate(bones):
            if bone['parent'] >= 0 and bone['parent'] < len(bones):
                parent_node = self.gltf['nodes'][base_idx + bone['parent']]
                if 'children' not in parent_node:
                    parent_node['children'] = []
                parent_node['children'].append(base_idx + i)

        # Find root bones (no parent)
        roots = [base_idx + i for i, b in enumerate(bones) if b['parent'] < 0]

        # Add root(s) to scene
        for r in roots:
            self.gltf['scenes'][0]['nodes'].append(r)

        return roots[0] if roots else None, joint_indices

    def add_skin(self, joint_indices, skeleton_root, bones):
        """Add a skin with proper inverse bind matrices computed from bone hierarchy."""
        # Compute world transform for each bone, then invert for IBM
        ibm_list = compute_inverse_bind_matrices(bones)

        ibm_flat = []
        for mat4 in ibm_list:
            ibm_flat.extend(mat4)

        ibm_data = struct.pack(f'<{len(ibm_flat)}f', *ibm_flat)
        ibm_bv = self.add_buffer_view(ibm_data)
        ibm_acc = self.add_accessor(ibm_bv, GLTF_FLOAT, len(joint_indices), 'MAT4')

        skin = {
            'joints': joint_indices,
            'inverseBindMatrices': ibm_acc,
        }
        if skeleton_root is not None:
            skin['skeleton'] = skeleton_root

        idx = len(self.gltf.get('skins', []))
        if 'skins' not in self.gltf:
            self.gltf['skins'] = []
        self.gltf['skins'].append(skin)
        return idx

    def add_animation(self, name, anim_data, joint_indices, bones):
        """Add an animation from parsed .banim data.

        anim_data uses the new format from extract_banim.parse_banim():
          bones: [{bone_index, curves: [{attr, type, value|keyframes, min, max}]}]
        Each curve targets a single attr (LOC_X=3..SCL_Z=11).
        We merge per-attr curves into glTF translation/rotation/scale channels.
        """
        if anim_data.get('raw') or not anim_data.get('bones'):
            return

        duration = anim_data.get('duration', 0)
        if duration <= 0:
            return

        channels = []
        samplers = []

        for bone_entry in anim_data['bones']:
            bone_idx = bone_entry['bone_index']
            if bone_idx >= len(joint_indices) or bone_idx >= len(bones):
                continue

            target_node = joint_indices[bone_idx]
            bone_bind = bones[bone_idx]

            # Collect curves by attribute group
            loc_curves = {}  # attr_id → curve_info
            rot_curves = {}
            scl_curves = {}
            for curve in bone_entry['curves']:
                a = curve['attr']
                if 3 <= a <= 5:
                    loc_curves[a] = curve
                elif 6 <= a <= 8:
                    rot_curves[a] = curve
                elif 9 <= a <= 11:
                    scl_curves[a] = curve

            # Helper: evaluate a curve at a given time
            def eval_curve(curve, t):
                if curve['type'] == 'constant':
                    return curve['value']
                kfs = curve['keyframes']
                if not kfs:
                    return 0.0
                if t <= kfs[0]['time']:
                    return kfs[0]['value']
                if t >= kfs[-1]['time']:
                    return kfs[-1]['value']
                for i in range(len(kfs) - 1):
                    if kfs[i]['time'] <= t <= kfs[i+1]['time']:
                        dt = kfs[i+1]['time'] - kfs[i]['time']
                        if dt < 1e-9:
                            return kfs[i]['value']
                        frac = (t - kfs[i]['time']) / dt
                        return kfs[i]['value'] + frac * (kfs[i+1]['value'] - kfs[i]['value'])
                return kfs[-1]['value']

            # Helper: collect unique sorted time values from a set of curves
            def collect_times(curves_dict):
                times = set()
                for curve in curves_dict.values():
                    if curve['type'] == 'curve':
                        for kf in curve['keyframes']:
                            times.add(kf['time'])
                if not times:
                    # All constant — use start/end
                    times = {0.0, duration}
                return sorted(times)

            # Translation channel (LOC_X=3, LOC_Y=4, LOC_Z=5)
            if loc_curves:
                times = collect_times(loc_curves)
                bind_t = bone_bind['translation']
                trans_values = []
                for t in times:
                    tx = eval_curve(loc_curves[3], t) if 3 in loc_curves else bind_t[0]
                    ty = eval_curve(loc_curves[4], t) if 4 in loc_curves else bind_t[1]
                    tz = eval_curve(loc_curves[5], t) if 5 in loc_curves else bind_t[2]
                    trans_values.extend([tx, ty, tz])

                time_data = struct.pack(f'<{len(times)}f', *times)
                time_bv = self.add_buffer_view(time_data)
                time_acc = self.add_accessor(time_bv, GLTF_FLOAT, len(times), 'SCALAR',
                                             [min(times)], [max(times)])
                t_data = struct.pack(f'<{len(trans_values)}f', *trans_values)
                t_bv = self.add_buffer_view(t_data)
                t_acc = self.add_accessor(t_bv, GLTF_FLOAT, len(times), 'VEC3')

                si = len(samplers)
                samplers.append({'input': time_acc, 'output': t_acc, 'interpolation': 'LINEAR'})
                channels.append({'sampler': si, 'target': {'node': target_node, 'path': 'translation'}})

            # Rotation channel (ROT_X=6, ROT_Y=7, ROT_Z=8) — Euler XYZ → quaternion
            if rot_curves:
                times = collect_times(rot_curves)
                bind_r = bone_bind['rotation']
                rot_values = []
                for t in times:
                    rx = eval_curve(rot_curves[6], t) if 6 in rot_curves else bind_r[0]
                    ry = eval_curve(rot_curves[7], t) if 7 in rot_curves else bind_r[1]
                    rz = eval_curve(rot_curves[8], t) if 8 in rot_curves else bind_r[2]
                    qx, qy, qz, qw = euler_to_quaternion(rx, ry, rz)
                    rot_values.extend([qx, qy, qz, qw])

                time_data = struct.pack(f'<{len(times)}f', *times)
                time_bv = self.add_buffer_view(time_data)
                time_acc = self.add_accessor(time_bv, GLTF_FLOAT, len(times), 'SCALAR',
                                             [min(times)], [max(times)])
                r_data = struct.pack(f'<{len(rot_values)}f', *rot_values)
                r_bv = self.add_buffer_view(r_data)
                r_acc = self.add_accessor(r_bv, GLTF_FLOAT, len(times), 'VEC4')

                si = len(samplers)
                samplers.append({'input': time_acc, 'output': r_acc, 'interpolation': 'LINEAR'})
                channels.append({'sampler': si, 'target': {'node': target_node, 'path': 'rotation'}})

            # Scale channel (SCL_X=9, SCL_Y=10, SCL_Z=11)
            if scl_curves:
                times = collect_times(scl_curves)
                bind_s = bone_bind['scale']
                scl_values = []
                for t in times:
                    sx = eval_curve(scl_curves[9], t) if 9 in scl_curves else bind_s[0]
                    sy = eval_curve(scl_curves[10], t) if 10 in scl_curves else bind_s[1]
                    sz = eval_curve(scl_curves[11], t) if 11 in scl_curves else bind_s[2]
                    scl_values.extend([sx, sy, sz])

                time_data = struct.pack(f'<{len(times)}f', *times)
                time_bv = self.add_buffer_view(time_data)
                time_acc = self.add_accessor(time_bv, GLTF_FLOAT, len(times), 'SCALAR',
                                             [min(times)], [max(times)])
                s_data = struct.pack(f'<{len(scl_values)}f', *scl_values)
                s_bv = self.add_buffer_view(s_data)
                s_acc = self.add_accessor(s_bv, GLTF_FLOAT, len(times), 'VEC3')

                si = len(samplers)
                samplers.append({'input': time_acc, 'output': s_acc, 'interpolation': 'LINEAR'})
                channels.append({'sampler': si, 'target': {'node': target_node, 'path': 'scale'}})

        if channels:
            if 'animations' not in self.gltf:
                self.gltf['animations'] = []
            self.gltf['animations'].append({
                'name': name,
                'channels': channels,
                'samplers': samplers,
            })

    def build_glb(self):
        """Build the final GLB binary."""
        # Set buffer size
        self._pad_to_4()
        self.gltf['buffers'] = [{'byteLength': len(self.buffer_data)}]

        # Clean up empty arrays
        for key in ['textures', 'images', 'materials', 'skins', 'animations']:
            if key in self.gltf and not self.gltf[key]:
                del self.gltf[key]

        # JSON chunk
        json_str = json.dumps(self.gltf, separators=(',', ':'))
        json_bytes = json_str.encode('utf-8')
        # Pad to 4 bytes with spaces
        while len(json_bytes) % 4 != 0:
            json_bytes += b' '

        # Binary chunk
        bin_bytes = bytes(self.buffer_data)
        while len(bin_bytes) % 4 != 0:
            bin_bytes += b'\x00'

        # GLB header
        total_length = 12 + 8 + len(json_bytes) + 8 + len(bin_bytes)

        out = bytearray()
        # Header: magic + version + length
        out.extend(struct.pack('<III', 0x46546C67, 2, total_length))  # glTF magic
        # JSON chunk
        out.extend(struct.pack('<II', len(json_bytes), 0x4E4F534A))  # JSON magic
        out.extend(json_bytes)
        # BIN chunk
        out.extend(struct.pack('<II', len(bin_bytes), 0x004E4942))  # BIN magic
        out.extend(bin_bytes)

        return bytes(out)


def parse_rig_lua(rig_path):
    """Parse a .rig Lua file to extract subset→texture mapping."""
    with open(rig_path, 'r') as f:
        content = f.read()

    textures = []
    for match in re.finditer(r'sTexture\s*=\s*"([^"]+)"', content):
        textures.append(match.group(1))

    return textures


def find_texture_png(tex_path, search_dirs):
    """Find a texture PNG file given a partial path from .rig."""
    basename = os.path.basename(tex_path)
    for search_dir in search_dirs:
        # Try exact path
        full = os.path.join(search_dir, tex_path + '.png')
        if os.path.exists(full):
            return full
        # Try just basename
        for root, dirs, files in os.walk(search_dir):
            for f in files:
                if f == basename + '.png':
                    return os.path.join(root, f)
    return None


def convert_model(brig_path, rig_path=None, tex_dirs=None, anim_dir=None, output_path='output.glb'):
    """Convert a single model to GLB."""
    builder = GLTFBuilder()

    # Parse mesh
    dec = decompress_brig(brig_path)
    brig = parse_brig(dec)

    # Parse rig for texture mapping
    material_map = {}
    if rig_path and os.path.exists(rig_path):
        tex_list = parse_rig_lua(rig_path)
        tex_cache = {}  # texture_path → material_idx

        for i, tex_path in enumerate(tex_list):
            if tex_path in tex_cache:
                material_map[i] = tex_cache[tex_path]
                continue

            png_path = find_texture_png(tex_path, tex_dirs or [])
            if png_path:
                try:
                    img_idx = builder.add_image_png(png_path)
                    tex_idx = builder.add_texture(img_idx)
                    mat_idx = builder.add_material(os.path.basename(tex_path), tex_idx)
                    material_map[i] = mat_idx
                    tex_cache[tex_path] = mat_idx
                except Exception as e:
                    print(f"  Warning: Could not load texture {tex_path}: {e}")
            else:
                # Fallback: material without texture
                mat_idx = builder.add_material(os.path.basename(tex_path), base_color=[0.5, 0.5, 0.5, 1.0])
                material_map[i] = mat_idx
                tex_cache[tex_path] = mat_idx

    # Add mesh
    mesh_node = builder.add_mesh(brig, material_map)

    # Add skeleton
    bones = brig.get('bones', [])
    root_node, joint_indices = builder.add_skeleton(bones)

    # If skinned, attach skin to mesh node
    if brig.get('has_blend') and joint_indices:
        skin_idx = builder.add_skin(joint_indices, root_node, bones)
        builder.gltf['nodes'][mesh_node]['skin'] = skin_idx

    # Add animations
    if anim_dir and os.path.isdir(anim_dir):
        banim_files = sorted(glob.glob(os.path.join(anim_dir, '*.banim')))
        for banim_path in banim_files:
            anim_name = os.path.splitext(os.path.basename(banim_path))[0]
            try:
                dec = decompress_banim(banim_path)
                anim_data = try_parse_banim(dec)
                if not anim_data.get('raw'):
                    builder.add_animation(anim_name, anim_data, joint_indices, bones)
            except Exception as e:
                print(f"  Warning: Could not parse animation {anim_name}: {e}")

    # Write GLB
    glb_data = builder.build_glb()
    os.makedirs(os.path.dirname(output_path) or '.', exist_ok=True)
    with open(output_path, 'wb') as f:
        f.write(glb_data)

    return len(glb_data)


def batch_convert(munged_dir, extracted_dir, output_dir):
    """Batch convert all models found in munged + extracted asset directories."""
    os.makedirs(output_dir, exist_ok=True)

    # Find all .brig files
    brig_files = sorted(glob.glob(os.path.join(munged_dir, '**/*.brig'), recursive=True))
    print(f"Found {len(brig_files)} .brig files\n")

    success = fail = 0
    for brig_path in brig_files:
        model_name = os.path.splitext(os.path.basename(brig_path))[0]
        rig_dir = os.path.dirname(brig_path)

        # Find .rig file (same directory)
        rig_path = os.path.join(rig_dir, model_name + '.rig')
        if not os.path.exists(rig_path):
            rig_path = None

        # Find texture directories
        tex_dirs = [extracted_dir]
        # .brig lives in Characters/CharName/Rig/ — go up 1 level to CharName/
        parent = Path(brig_path).parent.parent
        extracted_tex = os.path.join(extracted_dir, *parent.relative_to(munged_dir).parts)
        if os.path.isdir(extracted_tex):
            tex_dirs.insert(0, extracted_tex)

        # Find animation directory (sibling of Rig/)
        anim_dir = os.path.join(parent, 'Animations')
        if not os.path.isdir(anim_dir):
            anim_dir = None

        output_path = os.path.join(output_dir, f"{model_name}.glb")

        try:
            size = convert_model(brig_path, rig_path, tex_dirs, anim_dir, output_path)
            anim_count = 0
            if anim_dir:
                anim_count = len(glob.glob(os.path.join(anim_dir, '*.banim')))
            print(f"OK   {model_name}: {size // 1024}KB, {anim_count} animations")
            success += 1
        except Exception as e:
            print(f"FAIL {model_name}: {e}")
            fail += 1

    print(f"\n{success} converted, {fail} failed")


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='Convert DF-9 assets to glTF')
    parser.add_argument('--batch', action='store_true', help='Batch convert all models')
    parser.add_argument('--model', help='Single .brig model to convert')
    parser.add_argument('--rig', help='Corresponding .rig Lua file')
    parser.add_argument('--texdir', action='append', help='Texture search directories')
    parser.add_argument('--animdir', help='Animation directory (.banim files)')
    parser.add_argument('--munged', help='Munged assets root (for batch mode)')
    parser.add_argument('--extracted', help='Extracted assets root (for batch mode)')
    parser.add_argument('-o', '--output', default='output.glb', help='Output path')

    args = parser.parse_args()

    if args.batch:
        if not args.munged or not args.extracted:
            print("Batch mode requires --munged and --extracted")
            sys.exit(1)
        batch_convert(args.munged, args.extracted, args.output)
    elif args.model:
        size = convert_model(args.model, args.rig, args.texdir or [], args.animdir, args.output)
        print(f"Wrote {args.output} ({size // 1024}KB)")
    else:
        parser.print_help()
