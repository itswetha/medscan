import cv2
import numpy as np

BLUR_VARIANCE_THRESHOLD = 100.0
MINIMUM_DIMENSION = 512


def check_image_quality(image: np.ndarray) -> dict:
    height, width = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if image.ndim == 3 else image
    blur_variance = float(cv2.Laplacian(gray, cv2.CV_64F).var())

    blur_passes = blur_variance >= BLUR_VARIANCE_THRESHOLD
    resolution_passes = width >= MINIMUM_DIMENSION and height >= MINIMUM_DIMENSION
    score = (60 if blur_passes else 0) + (40 if resolution_passes else 0)

    issues: list[str] = []
    if not blur_passes:
        issues.append("Image appears blurry")
    if not resolution_passes:
        issues.append(f"Image resolution is too small (minimum {MINIMUM_DIMENSION} × {MINIMUM_DIMENSION} pixels)")

    return {
        "quality_score": max(0, min(100, score)),
        "quality_status": "good" if score >= 70 else "poor",
        "quality_issues": issues,
    }
