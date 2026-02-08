#!/usr/bin/env python3
"""
Kokoro TTS Script
Local text-to-speech using Kokoro 82M model (ONNX)
Generates high-quality audio with optimized voices.

Usage:
  python3 kokoro_tts.py "Hello world" --voice en_US_v1 --output output.wav
  python3 kokoro_tts.py "Hello world" --voice en_GB_v1 --speed 1.2
"""

import sys
import os
import json
import argparse
import wave
from pathlib import Path

# Kokoro ONNX imports
try:
    from kokoro_onnx import Kokoro
except ImportError:
    print("❌ kokoro-onnx not installed. Run: pip3 install kokoro-onnx", file=sys.stderr)
    sys.exit(1)

try:
    from huggingface_hub import snapshot_download
except ImportError:
    print("❌ huggingface-hub not installed. Run: pip3 install huggingface-hub", file=sys.stderr)
    sys.exit(1)

try:
    import numpy as np
except ImportError:
    print("❌ numpy not installed. Run: pip3 install numpy", file=sys.stderr)
    sys.exit(1)


def get_model_path():
    """Download Kokoro model from HuggingFace if needed."""
    # Check HuggingFace cache first
    hf_cache = Path.home() / '.cache' / 'huggingface' / 'hub'
    kokoro_snapshots = list(hf_cache.glob('models--thewh1teagle--kokoro/snapshots/*/'))

    if kokoro_snapshots:
        snapshot_dir = kokoro_snapshots[0]
        model_file = snapshot_dir / 'kokoro-v0_19.onnx'
        voices_file = snapshot_dir / 'voices.json'

        if model_file.exists() and voices_file.exists():
            print(f"📦 Using cached model", file=sys.stderr)
            return str(model_file), str(voices_file)

    # Also check custom kokoro cache
    custom_cache = Path.home() / '.cache' / 'kokoro'
    kokoro_snapshots = list(custom_cache.glob('models--thewh1teagle--kokoro/snapshots/*/'))

    if kokoro_snapshots:
        snapshot_dir = kokoro_snapshots[0]
        model_file = snapshot_dir / 'kokoro-v0_19.onnx'
        voices_file = snapshot_dir / 'voices.json'

        if model_file.exists() and voices_file.exists():
            print(f"📦 Using cached model", file=sys.stderr)
            return str(model_file), str(voices_file)

    # Download if not found
    print("📥 Downloading Kokoro model...", file=sys.stderr)
    try:
        repos_to_try = ["thewh1teagle/kokoro", "hexgrad/Kokoro"]

        for repo_id in repos_to_try:
            try:
                print(f"   Trying {repo_id}...", file=sys.stderr)
                model_dir = snapshot_download(repo_id)

                # Find model and voices files
                model_file = Path(model_dir) / 'kokoro-v0_19.onnx'
                voices_file = Path(model_dir) / 'voices.json'

                if not model_file.exists():
                    onnx_files = list(Path(model_dir).glob('*.onnx'))
                    if onnx_files:
                        model_file = onnx_files[0]

                if model_file.exists() and voices_file.exists():
                    print(f"✅ Model downloaded", file=sys.stderr)
                    return str(model_file), str(voices_file)
            except Exception as e:
                print(f"   {repo_id} failed: {str(e)[:80]}", file=sys.stderr)
                continue

        raise Exception("No Kokoro model found in any source")
    except Exception as e:
        print(f"❌ Failed to get model: {e}", file=sys.stderr)
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Kokoro TTS - Local high-quality speech synthesis")
    parser.add_argument("text", help="Text to convert to speech")
    parser.add_argument("--voice", default="en_US_v1", help="Voice ID (default: en_US_v1)")
    parser.add_argument("--speed", type=float, default=1.0, help="Speech speed (0.5-2.0, default: 1.0)")
    parser.add_argument("--output", default="/tmp/kokoro_output.wav", help="Output audio path")
    parser.add_argument("--json", action="store_true", help="Output as JSON")

    args = parser.parse_args()

    # Text validation
    if not args.text.strip():
        print("❌ No text provided", file=sys.stderr)
        sys.exit(1)

    if len(args.text) > 10000:
        print(f"❌ Text too long ({len(args.text)} chars, max 10000)", file=sys.stderr)
        sys.exit(1)

    try:
        # Get model paths
        model_path, voices_path = get_model_path()

        # Initialize Kokoro and patch voices if needed
        print("🔧 Initializing Kokoro...", file=sys.stderr)
        kokoro = Kokoro(model_path=model_path, voices_path=voices_path)

        # If voices is loaded as numpy array from JSON, convert back to dict
        if isinstance(kokoro.voices, np.ndarray):
            print("🔄 Patching voices format...", file=sys.stderr)
            # Reload as JSON dict
            with open(voices_path, 'r') as f:
                voices_dict = json.load(f)
            kokoro.voices = voices_dict

        # Generate speech
        print(f"🔊 Generating ({len(args.text)} chars)...", file=sys.stderr)
        audio_samples = kokoro.create(
            text=args.text,
            voice=args.voice,
            speed=args.speed
        )

        # Convert to bytes (Kokoro returns tuple (samples, sample_rate) or just samples)
        if isinstance(audio_samples, tuple):
            audio_array, sample_rate_returned = audio_samples
        else:
            audio_array = audio_samples
            sample_rate_returned = 24000

        if isinstance(audio_array, np.ndarray):
            # Convert float32 to int16
            audio_int16 = np.clip(audio_array * 32767, -32768, 32767).astype(np.int16)
            audio_bytes = audio_int16.tobytes()
        else:
            audio_bytes = audio_array if isinstance(audio_array, bytes) else audio_array.tobytes()

        # Save WAV file
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        sample_rate = 24000  # Kokoro default
        num_channels = 1
        sample_width = 2  # 16-bit

        with wave.open(str(output_path), 'wb') as wav_file:
            wav_file.setnchannels(num_channels)
            wav_file.setsampwidth(sample_width)
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(audio_bytes)

        duration = len(audio_bytes) / (sample_rate * num_channels * sample_width)

        if args.json:
            result = {
                "success": True,
                "output": str(output_path),
                "size": len(audio_bytes),
                "text_length": len(args.text),
                "voice": args.voice,
                "speed": args.speed,
                "sample_rate": sample_rate,
                "duration_seconds": duration
            }
            print(json.dumps(result))
        else:
            print(f"✅ Audio saved: {output_path}")
            print(f"   Size: {len(audio_bytes) / 1024:.0f} KB")
            print(f"   Duration: {duration:.1f}s")
            print(f"   Voice: {args.voice}, Speed: {args.speed}x")

    except Exception as e:
        error_msg = str(e)
        if args.json:
            result = {
                "success": False,
                "error": error_msg
            }
            print(json.dumps(result), file=sys.stderr)
        else:
            print(f"❌ TTS failed: {error_msg}", file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
