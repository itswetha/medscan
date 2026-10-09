"""Grad-CAM for the MobileNetV2 head, computed in NumPy (no TensorFlow needed)."""

from pathlib import Path

import numpy as np


def load_head(npz_path: str | Path) -> dict:
    data = np.load(str(npz_path))
    return {key: data[key] for key in data.files}


def gradcam_heatmap(activations: np.ndarray, head: dict, class_idx: int) -> np.ndarray:
    """Gradient of the class probability w.r.t. the last conv activations.

    activations: (H, W, C) output of the layer before the head (block_16_project_BN).
    Returns a (H, W) heatmap scaled to 0..1.
    """
    height, width, _ = activations.shape
    n = height * width
    flat = activations.reshape(n, -1)

    z = flat @ head["conv_w"] + head["conv_b"]
    zb = z * head["bn_scale"] + head["bn_shift"]
    relu_max = float(head["relu_max"])
    if relu_max < 0:
        r, mask = np.maximum(zb, 0), zb > 0
    else:
        r, mask = np.clip(zb, 0, relu_max), (zb > 0) & (zb < relu_max)

    logits = r.mean(axis=0) @ head["dense_w"] + head["dense_b"]
    if int(head["softmax"]):
        e = np.exp(logits - logits.max())
        p = e / e.sum()
        dlogits = -p[class_idx] * p
        dlogits[class_idx] += p[class_idx]
    else:
        dlogits = np.zeros_like(logits)
        dlogits[class_idx] = 1.0

    dpooled = head["dense_w"] @ dlogits
    dzb = mask * (dpooled / n)
    da = (dzb * head["bn_scale"]) @ head["conv_w"].T
    pooled_grads = da.mean(axis=0)

    heat = np.maximum((flat * pooled_grads).sum(axis=-1), 0)
    heat = heat / (heat.max() + 1e-8)
    return heat.reshape(height, width).astype("float32")
