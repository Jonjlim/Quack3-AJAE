"""Heart rate estimation via remote photoplethysmography (rPPG).

Uses MediaPipe Face Mesh (0.10.21 legacy API — migrate to Tasks post-hackathon)
to extract forehead ROI, CHROM chrominance method, autocorrelation + FFT fusion,
and analytic confidence intervals.
"""

import base64
import os
import tempfile

# pyrefly: ignore [missing-import]
import cv2
import mediapipe as mp
import numpy as np
from scipy.signal import butter, filtfilt

# MediaPipe forehead landmark indices (upper forehead region)
_FOREHEAD_LANDMARKS = [10, 67, 69, 104, 108, 109, 151, 299, 337, 338]

_BPM_LOW = 42.0
_BPM_HIGH = 240.0
_HZ_LOW = _BPM_LOW / 60.0
_HZ_HIGH = _BPM_HIGH / 60.0

_MIN_FACE_COVERAGE = 0.50
_MAX_MOTION_SCORE = 0.70
_MIN_LUMINANCE = 30.0
_MAX_LUMINANCE = 230.0
_METHOD_AGREEMENT_BPM = 10.0
_CI_HALF_WIDTH_MIN = 3.0
_CI_HALF_WIDTH_MAX = 25.0
_UNRELIABLE_CI_HALF_WIDTH = 15.0


def _video_suffix(video_bytes: bytes) -> str:
    if len(video_bytes) >= 4 and video_bytes[:4] == b"\x1aE\xdf\xa3":
        return ".webm"
    if len(video_bytes) >= 8 and video_bytes[4:8] == b"ftyp":
        return ".mp4"
    return ".webm"


def _decode_video(video_b64: str) -> tuple[list[np.ndarray], float]:
    video_bytes = base64.b64decode(video_b64)
    suffix = _video_suffix(video_bytes)

    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    try:
        tmp.write(video_bytes)
        tmp.close()

        cap = cv2.VideoCapture(tmp.name)
        if not cap.isOpened():
            raise RuntimeError(f"Could not open uploaded video ({suffix})")

        reported_fps = cap.get(cv2.CAP_PROP_FPS)
        frames: list[np.ndarray] = []
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            frames.append(frame)
        cap.release()

        if reported_fps and reported_fps >= 1.0:
            fps = float(reported_fps)
        elif frames:
            fps = max(len(frames) / 8.0, 24.0)
        else:
            fps = 30.0
    finally:
        os.unlink(tmp.name)

    return frames, fps


def _extract_roi_series(
    frames: list[np.ndarray],
) -> tuple[np.ndarray, np.ndarray, np.ndarray, float, float, list[float]]:
    """Return RGB means per frame, face coverage, motion score, landmark centroids."""
    face_mesh = mp.solutions.face_mesh.FaceMesh(
        static_image_mode=False,
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    )

    r_vals: list[float] = []
    g_vals: list[float] = []
    b_vals: list[float] = []
    luminances: list[float] = []
    centroids: list[np.ndarray | None] = []
    detected = 0

    prev_centroid: np.ndarray | None = None
    displacements: list[float] = []

    for frame in frames:
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = face_mesh.process(rgb)

        if not results.multi_face_landmarks:
            centroids.append(None)
            continue

        detected += 1
        landmarks = results.multi_face_landmarks[0]
        h, w = frame.shape[:2]

        pts = np.array(
            [
                [int(landmarks.landmark[i].x * w), int(landmarks.landmark[i].y * h)]
                for i in _FOREHEAD_LANDMARKS
            ],
            dtype=np.int32,
        )
        mask = np.zeros((h, w), dtype=np.uint8)
        cv2.fillConvexPoly(mask, cv2.convexHull(pts), 255)

        r_mean = cv2.mean(frame[:, :, 2], mask=mask)[0]
        g_mean = cv2.mean(frame[:, :, 1], mask=mask)[0]
        b_mean = cv2.mean(frame[:, :, 0], mask=mask)[0]
        r_vals.append(r_mean)
        g_vals.append(g_mean)
        b_vals.append(b_mean)
        luminances.append(0.299 * r_mean + 0.587 * g_mean + 0.114 * b_mean)

        centroid = pts.mean(axis=0)
        centroids.append(centroid)
        if prev_centroid is not None:
            norm = max(h, w)
            displacements.append(float(np.linalg.norm(centroid - prev_centroid) / norm))
        prev_centroid = centroid

    face_mesh.close()

    face_coverage = detected / len(frames) if frames else 0.0
    motion_score = float(np.mean(displacements)) if displacements else 0.0
    motion_score = min(1.0, motion_score * 8.0)

    return (
        np.array(r_vals, dtype=np.float64),
        np.array(g_vals, dtype=np.float64),
        np.array(b_vals, dtype=np.float64),
        face_coverage,
        motion_score,
        luminances,
    )


def _bandpass_filter(signal: np.ndarray, fps: float) -> np.ndarray:
    if len(signal) < 10:
        return signal
    nyquist = fps / 2.0
    low = _HZ_LOW / nyquist
    high = min(_HZ_HIGH / nyquist, 0.99)
    b, a = butter(N=2, Wn=[low, high], btype="band")
    return filtfilt(b, a, signal)


def _chrom_signal(r: np.ndarray, g: np.ndarray, b: np.ndarray) -> np.ndarray:
    """CHROM: De Haan & Jeanne, TBME 2013."""
    r_n = r / (np.mean(r) + 1e-6)
    g_n = g / (np.mean(g) + 1e-6)
    b_n = b / (np.mean(b) + 1e-6)
    x_chrom = 3.0 * r_n - 2.0 * g_n
    y_chrom = 1.5 * r_n + g_n - 1.5 * b_n
    alpha = np.std(x_chrom) / (np.std(y_chrom) + 1e-6)
    return x_chrom - alpha * y_chrom


def _psd_peak_bpm(signal: np.ndarray, fps: float) -> tuple[float, float]:
    """FFT peak BPM and peak prominence ratio (0–1)."""
    windowed = signal * np.hanning(len(signal))
    fft = np.fft.rfft(windowed)
    freqs = np.fft.rfftfreq(len(windowed), d=1.0 / fps)
    mask = (freqs >= _HZ_LOW) & (freqs <= _HZ_HIGH)
    magnitudes = np.abs(fft[mask])
    valid_freqs = freqs[mask]

    if len(magnitudes) == 0:
        return 0.0, 0.0

    peak_idx = int(np.argmax(magnitudes))
    peak_freq = valid_freqs[peak_idx]
    peak_mag = magnitudes[peak_idx]
    mean_mag = float(np.mean(magnitudes)) + 1e-6
    prominence = min(1.0, peak_mag / (mean_mag * 3.0))
    return float(peak_freq * 60.0), prominence


def _autocorr_peak_bpm(signal: np.ndarray, fps: float) -> float:
    """Autocorrelation peak in valid HR lag range."""
    sig = signal - np.mean(signal)
    if len(sig) < 10:
        return 0.0
    corr = np.correlate(sig, sig, mode="full")
    corr = corr[len(corr) // 2 :]
    corr[0] = 0.0

    min_lag = int(fps * 60.0 / _BPM_HIGH)
    max_lag = int(fps * 60.0 / _BPM_LOW)
    max_lag = min(max_lag, len(corr) - 1)
    if max_lag <= min_lag:
        return 0.0

    segment = corr[min_lag : max_lag + 1]
    if len(segment) == 0:
        return 0.0
    peak_lag = min_lag + int(np.argmax(segment))
    if peak_lag <= 0:
        return 0.0
    return 60.0 * fps / peak_lag


def _compute_ci(
    bpm: float,
    prominence: float,
    n_samples: int,
    face_coverage: float,
    motion_score: float,
) -> tuple[float, float, float]:
    """Analytic 95% CI half-width from spectral prominence and quality multipliers."""
    base_sigma = 12.0 / (prominence * np.sqrt(max(n_samples, 10)) + 1e-6)
    coverage_mult = 1.0 + (1.0 - face_coverage) * 1.5
    motion_mult = 1.0 + motion_score * 1.2
    half_width = base_sigma * coverage_mult * motion_mult
    half_width = float(np.clip(half_width, _CI_HALF_WIDTH_MIN, _CI_HALF_WIDTH_MAX))
    low = max(_BPM_LOW, bpm - half_width)
    high = min(_BPM_HIGH, bpm + half_width)
    return low, high, half_width


def _composite_confidence(
    prominence: float,
    face_coverage: float,
    motion_score: float,
    methods_agree: bool,
) -> float:
    motion_quality = 1.0 - motion_score
    agreement = 1.0 if methods_agree else 0.4
    score = 0.35 * prominence + 0.30 * face_coverage + 0.20 * motion_quality + 0.15 * agreement
    return float(np.clip(score, 0.0, 1.0))


def _signal_quality_label(confidence: float) -> str:
    if confidence >= 0.75:
        return "good"
    if confidence >= 0.5:
        return "fair"
    return "poor"


def _measurement_status(
    confidence: float,
    face_coverage: float,
    ci_half_width: float,
    methods_agree: bool,
    has_hr: bool,
) -> str:
    if not has_hr:
        return "unreliable"
    if face_coverage < _MIN_FACE_COVERAGE or ci_half_width > _UNRELIABLE_CI_HALF_WIDTH:
        return "unreliable"
    if confidence >= 0.65 and methods_agree:
        return "reliable"
    if confidence >= 0.5:
        return "estimated"
    return "unreliable"


def _failure(
    error: str,
    face_coverage: float = 0.0,
    motion_score: float = 0.0,
    peak_prominence: float = 0.0,
) -> dict:
    return {
        "heart_rate_bpm": None,
        "heart_rate_bpm_low": None,
        "heart_rate_bpm_high": None,
        "confidence": 0.0,
        "signal_quality": "poor",
        "measurement_status": "unreliable",
        "quality_metrics": {
            "face_coverage": round(face_coverage, 3),
            "motion_score": round(motion_score, 3),
            "peak_prominence": round(peak_prominence, 3),
            "chrom_fft_agreement_bpm": None,
        },
        "error": error,
    }


def detect_rppg(video: str) -> dict:
    """Estimate heart rate from a base64-encoded video clip (~8s from client).

    Returns dict with HR point estimate, CI bounds, confidence, quality metrics.
    """
    try:
        frames, fps = _decode_video(video)

        if len(frames) < 10:
            return _failure("Too few frames extracted from video")

        r, g, b, face_coverage, motion_score, luminances = _extract_roi_series(frames)

        min_samples = min(30, max(10, len(frames) // 2))
        if len(r) < min_samples:
            return _failure(
                "Could not detect face in enough frames",
                face_coverage=face_coverage,
                motion_score=motion_score,
            )

        if face_coverage < _MIN_FACE_COVERAGE:
            return _failure(
                f"Face visible in only {face_coverage:.0%} of frames — hold still and face the camera",
                face_coverage=face_coverage,
                motion_score=motion_score,
            )

        if motion_score > _MAX_MOTION_SCORE:
            return _failure(
                "Too much head movement — hold still for vitals",
                face_coverage=face_coverage,
                motion_score=motion_score,
            )

        mean_lum = float(np.mean(luminances)) if luminances else 128.0
        if mean_lum < _MIN_LUMINANCE or mean_lum > _MAX_LUMINANCE:
            return _failure(
                "Lighting too dark or too bright — move to even lighting",
                face_coverage=face_coverage,
                motion_score=motion_score,
            )

        duration_s = len(frames) / fps if fps > 0 else 8.0
        signal_fps = len(r) / duration_s if duration_s > 0 else fps

        chrom = _chrom_signal(r, g, b)
        filtered = _bandpass_filter(chrom, signal_fps)

        fft_bpm, prominence = _psd_peak_bpm(filtered, signal_fps)
        ac_bpm = _autocorr_peak_bpm(filtered, signal_fps)

        methods_agree = (
            fft_bpm > 0
            and ac_bpm > 0
            and abs(fft_bpm - ac_bpm) <= _METHOD_AGREEMENT_BPM
        )

        if methods_agree:
            bpm = (fft_bpm + ac_bpm) / 2.0
            agreement_bpm = abs(fft_bpm - ac_bpm)
        elif fft_bpm > 0 and prominence >= 0.25:
            bpm = fft_bpm
            agreement_bpm = abs(fft_bpm - ac_bpm) if ac_bpm > 0 else None
            methods_agree = False
        else:
            return _failure(
                "Could not estimate heart rate — hold still with face visible",
                face_coverage=face_coverage,
                motion_score=motion_score,
                peak_prominence=prominence,
            )

        confidence = _composite_confidence(prominence, face_coverage, motion_score, methods_agree)
        hr_low, hr_high, ci_half = _compute_ci(bpm, prominence, len(filtered), face_coverage, motion_score)
        status = _measurement_status(confidence, face_coverage, ci_half, methods_agree, True)
        quality = _signal_quality_label(confidence)

        return {
            "heart_rate_bpm": round(bpm, 1),
            "heart_rate_bpm_low": round(hr_low, 1),
            "heart_rate_bpm_high": round(hr_high, 1),
            "confidence": round(confidence, 3),
            "signal_quality": quality,
            "measurement_status": status,
            "quality_metrics": {
                "face_coverage": round(face_coverage, 3),
                "motion_score": round(motion_score, 3),
                "peak_prominence": round(prominence, 3),
                "chrom_fft_agreement_bpm": round(agreement_bpm, 2) if agreement_bpm is not None else None,
            },
            "error": None,
        }

    except Exception as e:
        return _failure(str(e))
