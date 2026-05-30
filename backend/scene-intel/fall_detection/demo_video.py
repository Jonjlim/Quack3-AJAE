"""Demo fallback — trigger a CRITICAL_FALL alert without live CV or network streams."""

import argparse
import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path

import httpx

REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from fall_detection.detector import FallDetector
from fall_detection.sampler import sample_frames


async def trigger_fall_api(api_base: str = "http://localhost:8000") -> None:
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{api_base}/api/v1/demo/trigger-fall")
        response.raise_for_status()
        data = response.json()
        print(f"[demo] Fall alert broadcast: {data['alert']['alert_id']}")


async def process_video(
    video_path: str,
    api_base: str = "http://localhost:8000",
    every_n_frames: int = 30,
) -> None:
    detector = FallDetector(consecutive_threshold=3)
    for frame_index, frame in sample_frames(video_path, every_n_frames=every_n_frames):
        is_fall = detector.analyze_frame(frame)
        if is_fall and detector.flag_frame():
            print(f"[demo] Fall detected at frame {frame_index}")
            await trigger_fall_api(api_base)
            detector.reset()
            return
    print("[demo] No fall detected in video — use --trigger for manual demo")


async def main() -> None:
    parser = argparse.ArgumentParser(description="ER-OVERWATCH fall demo trigger")
    parser.add_argument("--trigger", action="store_true", help="Fire demo fall alert via API")
    parser.add_argument("--video", type=str, help="Path to local fall demo video")
    parser.add_argument("--api", type=str, default="http://localhost:8000")
    parser.add_argument("--every-n-frames", type=int, default=30)
    args = parser.parse_args()

    if args.trigger:
        await trigger_fall_api(args.api)
    elif args.video:
        await process_video(args.video, args.api, args.every_n_frames)
    else:
        parser.print_help()


if __name__ == "__main__":
    asyncio.run(main())
