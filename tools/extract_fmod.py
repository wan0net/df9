#!/usr/bin/env python3
"""
extract_fmod.py — Extract audio from Spacebase DF-9 FMOD .fsb banks.

Uses vgmstream-cli to decrypt (key: DFm3t4lFTW) and extract each stream
from the FSB5 banks into individual WAV files.

Requirements: vgmstream-cli (brew install vgmstream)

Usage:
    python3 tools/extract_fmod.py

Output: public/assets/audio/{music,sfx,ambience,ui,voice}/
"""

import os
import subprocess
import json
import re
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
STEAM_AUDIO = Path.home() / "Library/Application Support/Steam/steamapps/common/SpacebaseDF9/Space.app/Contents/MacOS/OSX/Audio"
OUTPUT_DIR = PROJECT_ROOT / "public" / "assets" / "audio"

FMOD_KEY = "DFm3t4lFTW"
VGMSTREAM = "vgmstream-cli"


def get_stream_count(fsb_path: Path) -> int:
    """Get the number of streams in an FSB file."""
    result = subprocess.run(
        [VGMSTREAM, "-K", FMOD_KEY, "-m", str(fsb_path)],
        capture_output=True, text=True
    )
    # Look for "stream count: N"
    for line in result.stdout.splitlines():
        m = re.search(r'stream count:\s*(\d+)', line)
        if m:
            return int(m.group(1))
    return 1  # Default to 1 stream


def get_stream_name(fsb_path: Path, stream_idx: int) -> str:
    """Get the name of a specific stream."""
    result = subprocess.run(
        [VGMSTREAM, "-K", FMOD_KEY, "-m", "-s", str(stream_idx), str(fsb_path)],
        capture_output=True, text=True
    )
    for line in result.stdout.splitlines():
        m = re.search(r'stream name:\s*(.+)', line)
        if m:
            name = m.group(1).strip()
            # Remove file extension from stream name
            name = Path(name).stem
            # Sanitize
            name = re.sub(r'[^\w\-]', '_', name)
            return name
    return f"stream_{stream_idx:03d}"


def extract_fsb(fsb_path: Path, output_dir: Path, category: str) -> int:
    """Extract all streams from an FSB file to WAV."""
    print(f"\n{'='*60}")
    print(f"Processing: {fsb_path.name} → {category}/")

    num_streams = get_stream_count(fsb_path)
    print(f"  Streams: {num_streams}")

    out_dir = output_dir / category
    out_dir.mkdir(parents=True, exist_ok=True)

    extracted = 0
    for i in range(1, num_streams + 1):
        name = get_stream_name(fsb_path, i)
        out_path = out_dir / f"{name}.wav"

        result = subprocess.run(
            [VGMSTREAM, "-K", FMOD_KEY, "-s", str(i), "-o", str(out_path), str(fsb_path)],
            capture_output=True, text=True
        )

        if result.returncode == 0 and out_path.exists():
            size_kb = out_path.stat().st_size // 1024
            # Get duration from output
            dur = ""
            for line in result.stdout.splitlines():
                m = re.search(r'play duration:.*\(([\d:\.]+)\s*seconds?\)', line)
                if m:
                    dur = f" ({m.group(1)}s)"
                    break
            print(f"  [{i}/{num_streams}] {name}.wav: {size_kb}KB{dur}")
            extracted += 1
        else:
            print(f"  [{i}/{num_streams}] {name}: FAILED")
            if result.stderr:
                print(f"    {result.stderr.strip()[:80]}")

    return extracted


def main():
    # Check vgmstream
    try:
        subprocess.run([VGMSTREAM, "--help"], capture_output=True)
    except FileNotFoundError:
        print(f"vgmstream-cli not found. Install with: brew install vgmstream")
        return

    if not STEAM_AUDIO.exists():
        print(f"Steam audio directory not found: {STEAM_AUDIO}")
        return

    print(f"Source: {STEAM_AUDIO}")
    print(f"Output: {OUTPUT_DIR}")

    # Banks to extract
    banks = [
        ("Music/Music.fsb", "music"),
        ("SFX/SFX.fsb", "sfx"),
        ("SFX/Ambience.fsb", "ambience"),
        ("UI/UI_Bank.fsb", "ui"),
    ]

    total = 0
    for fsb_name, category in banks:
        fsb_path = STEAM_AUDIO / fsb_name
        if fsb_path.exists():
            count = extract_fsb(fsb_path, OUTPUT_DIR, category)
            total += count
        else:
            print(f"\n{fsb_name}: NOT FOUND, skipping")

    # Voice bank
    voice_dir = STEAM_AUDIO / "Voice"
    if voice_dir.exists():
        for fsb_file in sorted(voice_dir.glob("*.fsb")):
            total += extract_fsb(fsb_file, OUTPUT_DIR, "voice")

    # MainGame_enUS (may not need key)
    main_dir = STEAM_AUDIO / "MainGame_enUS"
    if main_dir.exists():
        for fsb_file in sorted(main_dir.glob("*.fsb")):
            total += extract_fsb(fsb_file, OUTPUT_DIR, "main")

    print(f"\n{'='*60}")
    print(f"Total: {total} audio files extracted to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
