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
                # Convert euler to quaternion (simplified — proper conversion in production)
                # For now, store as-is and let glTF viewers handle it
                pass

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

    def add_skin(self, joint_indices, skeleton_root):
        """Add a skin. Returns skin index."""
        # Generate identity inverse bind matrices
        ibm_count = len(joint_indices)
        identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        ibm_data = struct.pack(f'<{ibm_count * 16}f', *(identity * ibm_count))
        ibm_bv = self.add_buffer_view(ibm_data)
        ibm_acc = self.add_accessor(ibm_bv, GLTF_FLOAT, ibm_count, 'MAT4')

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

    def add_animation(self, name, anim_data, joint_indices, bone_name_to_idx):
        """Add an animation from parsed .banim data."""
        if anim_data.get('raw') or not anim_data.get('bones'):
            return

        channels = []
        samplers = []

        fps = anim_data.get('fps', 30.0)
        if fps <= 0:
            fps = 30.0

        for bone_data in anim_data['bones']:
            bone_name = bone_data['name']
            if bone_name not in bone_name_to_idx:
                continue

            bone_idx = bone_name_to_idx[bone_name]
            if bone_idx >= len(joint_indices):
                continue

            target_node = joint_indices[bone_idx]
            keyframes = bone_data['keyframes']
            if not keyframes:
                continue

            # Time values
            times = [kf['frame'] / fps for kf in keyframes]
            time_data = struct.pack(f'<{len(times)}f', *times)
            time_bv = self.add_buffer_view(time_data)
            time_acc = self.add_accessor(time_bv, GLTF_FLOAT, len(times), 'SCALAR',
                                         [min(times)], [max(times)])

            # Translation
            trans_values = []
            for kf in keyframes:
                trans_values.extend(kf['translation'])
            trans_data = struct.pack(f'<{len(trans_values)}f', *trans_values)
            trans_bv = self.add_buffer_view(trans_data)
            trans_acc = self.add_accessor(trans_bv, GLTF_FLOAT, len(keyframes), 'VEC3')

            sampler_idx = len(samplers)
            samplers.append({'input': time_acc, 'output': trans_acc, 'interpolation': 'LINEAR'})
            channels.append({
                'sampler': sampler_idx,
                'target': {'node': target_node, 'path': 'translation'},
            })

            # Rotation (quaternion)
            rot_values = []
            for kf in keyframes:
                rot_values.extend(kf['rotation'])
            rot_data = struct.pack(f'<{len(rot_values)}f', *rot_values)
            rot_bv = self.add_buffer_view(rot_data)
            rot_acc = self.add_accessor(rot_bv, GLTF_FLOAT, len(keyframes), 'VEC4')

            sampler_idx = len(samplers)
            samplers.append({'input': time_acc, 'output': rot_acc, 'interpolation': 'LINEAR'})
            channels.append({
                'sampler': sampler_idx,
                'target': {'node': target_node, 'path': 'rotation'},
            })

            # Scale
            scale_values = []
            for kf in keyframes:
                scale_values.extend(kf['scale'])
            scale_data = struct.pack(f'<{len(scale_values)}f', *scale_values)
            scale_bv = self.add_buffer_view(scale_data)
            scale_acc = self.add_accessor(scale_bv, GLTF_FLOAT, len(keyframes), 'VEC3')

            sampler_idx = len(samplers)
            samplers.append({'input': time_acc, 'output': scale_acc, 'interpolation': 'LINEAR'})
            channels.append({
                'sampler': sampler_idx,
                'target': {'node': target_node, 'path': 'scale'},
            })

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
        skin_idx = builder.add_skin(joint_indices, root_node)
        builder.gltf['nodes'][mesh_node]['skin'] = skin_idx

    # Build bone name→index map for animations
    bone_name_to_idx = {b['name']: i for i, b in enumerate(bones)}

    # Add animations
    if anim_dir and os.path.isdir(anim_dir):
        banim_files = sorted(glob.glob(os.path.join(anim_dir, '*.banim')))
        for banim_path in banim_files:
            anim_name = os.path.splitext(os.path.basename(banim_path))[0]
            try:
                dec = decompress_banim(banim_path)
                anim_data = try_parse_banim(dec)
                if not anim_data.get('raw'):
                    builder.add_animation(anim_name, anim_data, joint_indices, bone_name_to_idx)
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
        # Also check relative to the brig file's character/prop directory
        parent = Path(brig_path).parent.parent.parent  # Up from Rig/ to model dir
        extracted_tex = os.path.join(extracted_dir, *parent.relative_to(munged_dir).parts)
        if os.path.isdir(extracted_tex):
            tex_dirs.insert(0, extracted_tex)

        # Find animation directory
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
