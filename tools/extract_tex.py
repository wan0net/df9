#!/usr/bin/env python3
"""Extract .tex spritesheet files from Spacebase DF-9 to PNG format.

.tex binary format (Double Fine / private MOAI fork):
    Header (32 bytes):
        [0x00:0x04]  char[4]   Magic: 'TEX '
        [0x04:0x06]  uint16LE  Width
        [0x06:0x08]  uint16LE  Height
        [0x08:0x0C]  uint32LE  Format code (compression_type << 8 | dim_index)
        [0x0C:0x10]  uint32LE  Stream 1 compressed size
        [0x10:0x14]  uint32LE  Stream 1 decompressed size
        [0x14:0x18]  uint32LE  Stream 2 compressed size
        [0x18:0x1C]  uint32LE  Stream 2 decompressed size
        [0x1C:0x20]  char[4]   Chunk ID (ignore)

    Data:
        [0x20 .. 0x20+s1_csz)   Stream 1: DXT5/BC3 mip chain (raw deflate)
        [0x20+s1_csz .. +s2_csz) Stream 2: RGBA8888 base level (raw deflate)

    For sprite extraction, always use Stream 2 (lossless RGBA8888).

Companion .lua files (TexturePacker format) define sprite UV regions.

Usage:
    python3 tools/extract_tex.py <input.tex> [output.png]
    python3 tools/extract_tex.py --sprites <input.tex> <input.lua> [output_dir]
    python3 tools/extract_tex.py --all <asset_dir> [output_dir]

See extracted_assets/TEX_FORMAT.md for full format specification.
"""

import struct
import zlib
import re
import os
import sys
import glob
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Pillow not installed. Run: pip install Pillow")
    raise SystemExit(1)


# ---------------------------------------------------------------------------
# TEX decoding
# ---------------------------------------------------------------------------


def decompress_stream(data: bytes, compressed_sz: int, decomp_sz: int) -> bytes:
    """Decompress a TEX data stream (raw deflate or stored raw)."""
    if compressed_sz == 0:
        return b""
    if compressed_sz == decomp_sz:
        return data[:compressed_sz]  # stored raw (tiny textures)
    return zlib.decompress(data[:compressed_sz], -15)  # raw deflate


def read_tex(path: str) -> Image.Image:
    """Decode a Spacebase DF-9 .tex file to a PIL RGBA image.

    Uses Stream 2 (lossless RGBA8888) when available; falls back to
    Stream 1 (DXT5) via DDS wrapper + Pillow for format 0x03 (DXT1).
    """
    with open(path, "rb") as f:
        data = f.read()

    magic = data[0:4]
    if magic != b"TEX ":
        raise ValueError(f"Not a TEX file (magic={magic!r})")

    w = struct.unpack_from("<H", data, 0x04)[0]
    h = struct.unpack_from("<H", data, 0x06)[0]
    fmt = struct.unpack_from("<I", data, 0x08)[0]
    s1_csz = struct.unpack_from("<I", data, 0x0C)[0]
    s1_dsz = struct.unpack_from("<I", data, 0x10)[0]
    s2_csz = struct.unpack_from("<I", data, 0x14)[0]
    s2_dsz = struct.unpack_from("<I", data, 0x18)[0]

    fmt_high = (fmt >> 8) & 0xFF

    # Stream 2 starts after header + stream 1
    s2_start = 32 + s1_csz
    s2_raw = data[s2_start : s2_start + s2_csz]
    s2 = decompress_stream(s2_raw, s2_csz, s2_dsz)

    if len(s2) != s2_dsz:
        raise ValueError(f"Stream 2 size mismatch: got {len(s2)}, expected {s2_dsz}")

    if fmt_high == 0x02 and s2_dsz == w * h * 4:
        return Image.frombytes("RGBA", (w, h), s2)

    elif fmt_high in (0x01, 0x05) and s2_dsz == w * h:
        return Image.frombytes("L", (w, h), s2)

    elif fmt_high == 0x03:
        return _decode_dxt_via_dds(w, h, s2, s2_dsz, b"DXT1", 8)

    elif fmt_high == 0x02 and s2_dsz == w * h:
        return Image.frombytes("L", (w, h), s2)

    elif fmt_high == 0x05 and s2_dsz == w * h * 4:
        return Image.frombytes("RGBA", (w, h), s2)

    else:
        raise ValueError(
            f"Unknown format 0x{fmt_high:02x} with s2_dsz={s2_dsz} "
            f"(w*h={w * h}, w*h*4={w * h * 4})"
        )


def _decode_dxt_via_dds(
    w: int,
    h: int,
    dxt_data: bytes,
    dxt_size: int,
    fourcc: bytes,
    block_size: int,
) -> Image.Image:
    """Decode DXT block data by wrapping in a base-level-only DDS header."""
    import io

    linear_size = max(1, (w + 3) // 4) * max(1, (h + 3) // 4) * block_size
    DDSD_FLAGS = 0x1 | 0x2 | 0x4 | 0x1000 | 0x80000

    header = struct.pack("<4sI", b"DDS ", 124)
    header += struct.pack("<IIIII", DDSD_FLAGS, h, w, linear_size, 0)
    header += struct.pack("<I", 1)
    header += b"\x00" * 44
    header += struct.pack("<II", 32, 0x4) + fourcc + b"\x00" * 20
    header += struct.pack("<I", 0x1000) + b"\x00" * 16

    return Image.open(io.BytesIO(header + dxt_data[:linear_size]))


def get_tex_info(path: str) -> dict:
    """Read TEX header fields without full decompression."""
    with open(path, "rb") as f:
        hdr = f.read(32)

    if len(hdr) < 32 or hdr[0:4] != b"TEX ":
        raise ValueError(f"Not a TEX file: {path}")

    return {
        "width": struct.unpack_from("<H", hdr, 0x04)[0],
        "height": struct.unpack_from("<H", hdr, 0x06)[0],
        "format": struct.unpack_from("<I", hdr, 0x08)[0],
        "s1_csz": struct.unpack_from("<I", hdr, 0x0C)[0],
        "s1_dsz": struct.unpack_from("<I", hdr, 0x10)[0],
        "s2_csz": struct.unpack_from("<I", hdr, 0x14)[0],
        "s2_dsz": struct.unpack_from("<I", hdr, 0x18)[0],
        "chunk_id": hdr[0x1C:0x20].decode("ascii", errors="replace"),
    }


# ---------------------------------------------------------------------------
# Lua sprite definition parsing
# ---------------------------------------------------------------------------


def parse_sprite_lua(lua_path: str) -> list[dict]:
    """Parse a TexturePacker Lua sprite definition file.

    Returns list of dicts with keys:
        name, u0, v0, u1, v1, colorRect, sourceSize, trimmed, rotated
    """
    with open(lua_path, "r") as f:
        content = f.read()

    sprites = []
    blocks = content.split('name = "')[1:]

    for block in blocks:
        name = block.split('"')[0]

        uv = re.search(
            r"uvRect\s*=\s*\{\s*"
            r"u0\s*=\s*([\d.]+)\s*,\s*v0\s*=\s*([\d.]+)\s*,\s*"
            r"u1\s*=\s*([\d.]+)\s*,\s*v1\s*=\s*([\d.]+)",
            block,
        )
        if not uv:
            continue

        cr = re.search(
            r"spriteColorRect\s*=\s*\{\s*"
            r"x\s*=\s*([\d.]+)\s*,\s*y\s*=\s*([\d.]+)\s*,\s*"
            r"width\s*=\s*([\d.]+)\s*,\s*height\s*=\s*([\d.]+)",
            block,
        )
        ss = re.search(
            r"spriteSourceSize\s*=\s*\{\s*"
            r"width\s*=\s*([\d.]+)\s*,\s*height\s*=\s*([\d.]+)",
            block,
        )
        trimmed = "spriteTrimmed = true" in block
        rotated = "textureRotated = true" in block

        sprite: dict = {
            "name": name,
            "u0": float(uv.group(1)),
            "v0": float(uv.group(2)),
            "u1": float(uv.group(3)),
            "v1": float(uv.group(4)),
            "trimmed": trimmed,
            "rotated": rotated,
        }

        if cr:
            sprite["colorRect"] = {
                "x": int(float(cr.group(1))),
                "y": int(float(cr.group(2))),
                "w": int(float(cr.group(3))),
                "h": int(float(cr.group(4))),
            }
        if ss:
            sprite["sourceSize"] = {
                "w": int(float(ss.group(1))),
                "h": int(float(ss.group(2))),
            }

        sprites.append(sprite)

    return sprites


# ---------------------------------------------------------------------------
# Sprite extraction
# ---------------------------------------------------------------------------


def extract_sprite(
    sheet: Image.Image,
    sprite: dict,
    output_path: str,
    *,
    reconstruct_trim: bool = True,
) -> tuple[int, int]:
    """Extract a single sprite from the decoded spritesheet.

    If reconstruct_trim is True and the sprite was trimmed, the full
    sourceSize canvas is reconstructed with transparent padding.

    Returns (output_width, output_height).
    """
    w, h = sheet.size
    px0 = round(sprite["u0"] * w)
    py0 = round(sprite["v0"] * h)
    px1 = round(sprite["u1"] * w)
    py1 = round(sprite["v1"] * h)

    crop = sheet.crop((px0, py0, px1, py1))

    # Handle rotation (TexturePacker stores rotated sprites 90° CW)
    if sprite.get("rotated"):
        crop = crop.rotate(90, expand=True)

    # Handle trimming — reconstruct full-size sprite with transparent padding
    if reconstruct_trim and sprite.get("trimmed") and sprite.get("sourceSize"):
        ss = sprite["sourceSize"]
        cr = sprite.get("colorRect", {"x": 0, "y": 0})
        full = Image.new("RGBA", (ss["w"], ss["h"]), (0, 0, 0, 0))
        full.paste(crop, (cr["x"], cr["y"]))
        crop = full

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    crop.save(output_path, "PNG")
    return crop.size


def extract_all_sprites(
    tex_path: str,
    lua_path: str,
    output_dir: str,
    *,
    reconstruct_trim: bool = True,
) -> int:
    """Extract all sprites from a TEX+Lua pair.

    Returns number of sprites extracted.
    """
    sheet = read_tex(tex_path)
    sprites = parse_sprite_lua(lua_path)
    os.makedirs(output_dir, exist_ok=True)

    extracted = 0
    for sp in sprites:
        out_name = sp["name"]
        if not out_name.endswith(".png"):
            out_name += ".png"
        out_path = os.path.join(output_dir, out_name)

        try:
            size = extract_sprite(
                sheet, sp, out_path, reconstruct_trim=reconstruct_trim
            )
            extracted += 1
        except Exception as e:
            print(f"  ERROR {sp['name']}: {e}")

    return extracted


# ---------------------------------------------------------------------------
# Batch extraction
# ---------------------------------------------------------------------------


def extract_directory(asset_dir: str, output_dir: str) -> None:
    """Extract all TEX+Lua pairs found recursively under asset_dir."""
    tex_files = sorted(glob.glob(os.path.join(asset_dir, "**/*.tex"), recursive=True))

    total_tex = 0
    total_sprites = 0
    total_sheets = 0

    for tex_path in tex_files:
        base = os.path.splitext(tex_path)[0]
        lua_path = base + ".lua"
        rel_dir = os.path.relpath(os.path.dirname(tex_path), asset_dir)
        tex_name = os.path.splitext(os.path.basename(tex_path))[0]

        try:
            info = get_tex_info(tex_path)
            fmt_str = f"0x{info['format']:04x}"
            dim_str = f"{info['width']}x{info['height']}"
        except Exception as e:
            print(f"SKIP {tex_name}: {e}")
            continue

        # Save full spritesheet PNG
        sheet_out_dir = os.path.join(output_dir, rel_dir)
        os.makedirs(sheet_out_dir, exist_ok=True)
        sheet_png = os.path.join(sheet_out_dir, f"{tex_name}.png")

        try:
            sheet = read_tex(tex_path)
            sheet.save(sheet_png, "PNG")
            total_sheets += 1
        except Exception as e:
            print(f"FAIL {tex_name} ({dim_str} {fmt_str}): {e}")
            continue

        # Extract individual sprites if Lua file exists
        if os.path.exists(lua_path):
            sprites = parse_sprite_lua(lua_path)
            sprite_dir = os.path.join(sheet_out_dir, tex_name)

            count = 0
            for sp in sprites:
                out_name = sp["name"]
                if not out_name.endswith(".png"):
                    out_name += ".png"
                out_path = os.path.join(sprite_dir, out_name)

                try:
                    extract_sprite(sheet, sp, out_path)
                    count += 1
                except Exception as e:
                    print(f"  ERROR {sp['name']}: {e}")

            total_sprites += count
            print(
                f"OK   {rel_dir}/{tex_name}: {dim_str} {fmt_str} "
                f"→ sheet + {count}/{len(sprites)} sprites"
            )
        else:
            print(
                f"OK   {rel_dir}/{tex_name}: {dim_str} {fmt_str} → sheet only (no .lua)"
            )

        total_tex += 1

    print(f"\n{total_tex} TEX files processed:")
    print(f"  {total_sheets} spritesheets saved")
    print(f"  {total_sprites} individual sprites extracted")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    if sys.argv[1] == "--all":
        if len(sys.argv) < 3:
            print("Usage: python3 extract_tex.py --all <asset_dir> [output_dir]")
            sys.exit(1)
        asset_dir = sys.argv[2]
        output_dir = sys.argv[3] if len(sys.argv) > 3 else "extracted_tex"
        extract_directory(asset_dir, output_dir)

    elif sys.argv[1] == "--sprites":
        if len(sys.argv) < 4:
            print(
                "Usage: python3 extract_tex.py --sprites <input.tex> <input.lua> [output_dir]"
            )
            sys.exit(1)
        tex_path = sys.argv[2]
        lua_path = sys.argv[3]
        output_dir = sys.argv[4] if len(sys.argv) > 4 else "sprites"

        count = extract_all_sprites(tex_path, lua_path, output_dir)
        tex_name = os.path.basename(tex_path)
        print(f"Extracted {count} sprites from {tex_name} → {output_dir}/")

    elif sys.argv[1] == "--info":
        if len(sys.argv) < 3:
            print("Usage: python3 extract_tex.py --info <input.tex>")
            sys.exit(1)
        info = get_tex_info(sys.argv[2])
        fmt_high = (info["format"] >> 8) & 0xFF
        fmt_low = info["format"] & 0xFF
        fmt_types = {0x01: "A8", 0x02: "DXT5+RGBA", 0x03: "DXT1", 0x05: "RGBA"}
        print(f"File:       {sys.argv[2]}")
        print(f"Dimensions: {info['width']}x{info['height']}")
        print(f"Format:     0x{info['format']:04x} ({fmt_types.get(fmt_high, '?')})")
        print(f"Stream 1:   {info['s1_csz']:,} compressed → {info['s1_dsz']:,} bytes")
        print(f"Stream 2:   {info['s2_csz']:,} compressed → {info['s2_dsz']:,} bytes")
        print(f"Chunk ID:   {info['chunk_id']}")

    else:
        # Single TEX → PNG
        tex_path = sys.argv[1]
        output_path = (
            sys.argv[2]
            if len(sys.argv) > 2
            else (os.path.splitext(tex_path)[0] + ".png")
        )
        img = read_tex(tex_path)
        img.save(output_path, "PNG")
        print(f"Extracted {img.size[0]}x{img.size[1]} {img.mode} → {output_path}")


if __name__ == "__main__":
    main()
