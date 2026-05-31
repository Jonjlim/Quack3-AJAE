"""Test script for fall detection using tempvid.mov."""

import os
import sys
import json
import time
from fall_detection.detector import detect_fall


VIDEO_PATH = os.path.join(os.path.dirname(__file__), "tempvid.mov")


def load_video(path):
    """Load video file as raw bytes."""
    print(f"[1/4] Loading video from: {path}")

    if not os.path.exists(path):
        print(f"  ERROR: File not found — {path}")
        sys.exit(1)

    size_mb = os.path.getsize(path) / (1024 * 1024)
    print(f"  File size: {size_mb:.2f} MB")

    with open(path, "rb") as f:
        data = f.read()

    print(f"  Loaded {len(data):,} bytes")
    return data


def run_detection(video_bytes):
    """Run fall detection and time the call."""
    print("[2/4] Sending video to Gemini for fall detection...")
    start = time.time()
    result = detect_fall(video_bytes)
    elapsed = time.time() - start
    print(f"  Gemini responded in {elapsed:.2f}s")
    return result


def print_result(result):
    """Print the detection result in a readable format."""
    print("[3/4] Detection result:")
    print(f"  Fall detected : {result['fall_detected']}")
    print(f"  Confidence    : {result['confidence']}")
    print(f"  Danger level  : {result['danger_level']}")
    print(f"  Coordinates   : {result['coordinates']}")
    print(f"  Frame time    : {result['frame_timestamp']}")
    print()
    print("[4/4] Raw JSON output:")
    print(json.dumps(result, indent=2))


def main():
    """Main entry point — load video, detect falls, print results."""
    print("=" * 50)
    print("  FALL DETECTION TEST")
    print("=" * 50)
    print()

    video_bytes = load_video(VIDEO_PATH)
    result = run_detection(video_bytes)
    print_result(result)

    print()
    print("=" * 50)
    print("  TEST COMPLETE")
    print("=" * 50)


if __name__ == "__main__":
    main()
