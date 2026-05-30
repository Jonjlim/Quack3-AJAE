"""Heart rate estimation via remote photoplethysmography (rPPG).

Uses MediaPipe Face Mesh to extract forehead ROI, then applies
green-channel + FFT-based POS algorithm to estimate heart rate.
"""

import base64
import tempfile
import os

import cv2
import numpy as np
import mediapipe as mp
from scipy.signal import butter, filtfilt

# MediaPipe forehead landmark indices (upper forehead region)
_FOREHEAD_LANDMARKS = [10, 67, 69, 104, 108, 109, 151, 299, 337, 338]

_BPM_LOW = 42.0
_BPM_HIGH = 240.0
_HZ_LOW = _BPM_LOW / 60.0    # 0.7 Hz
_HZ_HIGH = _BPM_HIGH / 60.0  # 4.0 Hz


def _decode_video(video_b64):
    """Decode a base64-encoded video into a list of BGR frames and the FPS.

    Args:
        video_b64: Base64-encoded video string.

    Returns:
        Tuple of (frames list[np.ndarray], fps float).
    """
    video_bytes = base64.b64decode(video_b64)

    tmp = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
    try:
        tmp.write(video_bytes)
        tmp.close()

        cap = cv2.VideoCapture(tmp.name)
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        frames = []
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            frames.append(frame)
        cap.release()
    finally:
        os.unlink(tmp.name)

    return frames, fps


def _extract_forehead_signal(frames, fps):
    """Extract mean green-channel values from the forehead ROI per frame.

    Args:
        frames: List of BGR frames.
        fps: Video frame rate.

    Returns:
        np.ndarray of green-channel means (length = number of valid frames).
    """
    face_mesh = mp.solutions.face_mesh.FaceMesh(
        static_image_mode=False,
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    )

    signal = []
    for frame in frames:
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = face_mesh.process(rgb)

        if not results.multi_face_landmarks:
            continue

        landmarks = results.multi_face_landmarks[0]
        h, w = frame.shape[:2]

        # Get forehead polygon points
        pts = np.array(
            [
                [int(landmarks.landmark[i].x * w), int(landmarks.landmark[i].y * h)]
                for i in _FOREHEAD_LANDMARKS
            ],
            dtype=np.int32,
        )

        # Create mask for forehead ROI
        mask = np.zeros((h, w), dtype=np.uint8)
        cv2.fillConvexPoly(mask, cv2.convexHull(pts), 255)

        # Extract mean green channel value
        green = frame[:, :, 1]
        mean_val = cv2.mean(green, mask=mask)[0]
        signal.append(mean_val)

    face_mesh.close()
    return np.array(signal, dtype=np.float64)


def _bandpass_filter(signal, fps):
    """Apply a Butterworth bandpass filter to isolate heart rate frequencies.

    Args:
        signal: 1-D numpy array of the raw pulse signal.
        fps: Sampling rate in Hz.

    Returns:
        Filtered signal as np.ndarray.
    """
    nyquist = fps / 2.0
    low = _HZ_LOW / nyquist
    high = min(_HZ_HIGH / nyquist, 0.99)
    b, a = butter(N=2, Wn=[low, high], btype="band")
    return filtfilt(b, a, signal)


def _estimate_hr(signal, fps):
    """Estimate heart rate in BPM from the filtered pulse signal via FFT.

    Args:
        signal: 1-D filtered signal array.
        fps: Sampling rate in Hz.

    Returns:
        Estimated heart rate in BPM (float).
    """
    # Windowing to reduce spectral leakage
    windowed = signal * np.hanning(len(signal))

    fft = np.fft.rfft(windowed)
    freqs = np.fft.rfftfreq(len(windowed), d=1.0 / fps)

    # Only consider frequencies in the valid heart rate range
    mask = (freqs >= _HZ_LOW) & (freqs <= _HZ_HIGH)
    magnitudes = np.abs(fft[mask])
    valid_freqs = freqs[mask]

    if len(magnitudes) == 0:
        return 0.0

    peak_freq = valid_freqs[np.argmax(magnitudes)]
    return float(peak_freq * 60.0)


def _assess_quality(signal):
    """Assess signal quality based on the signal-to-noise ratio.

    Args:
        signal: The filtered pulse signal.

    Returns:
        Tuple of (quality_label str, confidence float).
    """
    if len(signal) < 10:
        return "poor", 0.1

    std = np.std(signal)
    mean = np.mean(np.abs(signal))

    if mean == 0:
        return "poor", 0.1

    snr = std / mean

    if snr > 0.3:
        return "good", 0.9
    elif snr > 0.15:
        return "fair", 0.6
    else:
        return "poor", 0.3


def detect_rppg(video):
    """Estimate heart rate from a base64-encoded 5-second video.

    Args:
        video: Base64-encoded video string (mp4).

    Returns:
        dict with keys: heart_rate_bpm, confidence, signal_quality, error.
    """
    try:
        frames, fps = _decode_video(video)

        if len(frames) < 30:
            return {
                "heart_rate_bpm": None,
                "confidence": 0.0,
                "signal_quality": "poor",
                "error": "Too few frames extracted from video",
            }

        signal = _extract_forehead_signal(frames, fps)

        if len(signal) < 30:
            return {
                "heart_rate_bpm": None,
                "confidence": 0.0,
                "signal_quality": "poor",
                "error": "Could not detect face in enough frames",
            }

        filtered = _bandpass_filter(signal, fps)
        bpm = _estimate_hr(filtered, fps)
        quality, confidence = _assess_quality(filtered)

        return {
            "heart_rate_bpm": round(bpm, 1),
            "confidence": confidence,
            "signal_quality": quality,
            "error": None,
        }

    except Exception as e:
        return {
            "heart_rate_bpm": None,
            "confidence": 0.0,
            "signal_quality": "poor",
            "error": str(e),
        }