"""Accept browser fall reports and broadcast nurse alerts."""

FALL_CONFIDENCE_THRESHOLD = 0.6


def should_accept_fall_report(confidence: float, danger_level: str) -> bool:
    return confidence >= FALL_CONFIDENCE_THRESHOLD and danger_level in ("medium", "high")


def build_fall_message(
    confidence: float,
    danger_level: str,
    coordinates: dict[str, int] | None,
    custom: str | None = None,
) -> str:
    if custom:
        return custom
    base = f"Fall detected (confidence {confidence:.0%}, danger {danger_level})"
    if coordinates:
        return f"{base} at coordinates ({coordinates.get('x')}, {coordinates.get('y')})"
    return base
