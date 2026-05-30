"""Scene Intelligence entry point — subscribes to AI WebSocket or runs demo mode."""

import argparse
import asyncio
import sys
from pathlib import Path

import httpx

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))


async def send_alert_http(api_base: str) -> None:
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{api_base}/api/v1/demo/trigger-fall")
        response.raise_for_status()
        print(f"[scene-intel] Demo fall triggered: {response.json()}")


async def main() -> None:
    parser = argparse.ArgumentParser(description="ER-OVERWATCH Scene Intelligence")
    parser.add_argument("--api", default="http://localhost:8000")
    parser.add_argument("--demo", action="store_true", help="Trigger demo fall alert")
    args = parser.parse_args()

    if args.demo:
        await send_alert_http(args.api)
        return

    print("[scene-intel] Ready — connect LiveKit frame pipeline or use --demo")
    print("  python fall_detection/demo_video.py --trigger")
    print("  python fall_detection/demo_video.py --video path/to/fall.mp4")


if __name__ == "__main__":
    asyncio.run(main())
