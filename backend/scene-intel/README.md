# Deprecated — scene-intel

This folder is **legacy**. Active code has moved:

| Former concern | New location |
|----------------|--------------|
| rPPG vitals | [`backend/rppg/`](../rppg/) |
| Fall detection | Browser — `frontend/nurse-command/src/lib/browserFallDetector.ts` |

`fall_detection/` and `generalFunctions/GeminiAPI.py` are **not used** in production. They may be removed after the team finishes migration.

Do not add new features here.

`testscript.py` is a manual test. It expects a local, untracked `tempvid.mov` next to the script (`VIDEO_PATH`) and is not part of pytest.
