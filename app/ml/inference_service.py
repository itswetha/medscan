"""Single-model MobileNetV2 inference and Grad-CAM (ONNX Runtime + NumPy, no TensorFlow)."""

import os
from pathlib import Path
from threading import Lock
from uuid import UUID

# Set native thread limits before importing numerical libraries.
for _thread_env_var in (
    "OMP_NUM_THREADS",
    "OPENBLAS_NUM_THREADS",
    "MKL_NUM_THREADS",
    "NUMEXPR_NUM_THREADS",
):
    os.environ[_thread_env_var] = "1"

import cv2
import numpy as np
from PIL import Image

from app.core.config import settings
from app.ml.gradcam_numpy import gradcam_heatmap, load_head

MODEL_PATH = Path(settings.model_path).expanduser().resolve()
ONNX_PATH = MODEL_PATH.with_suffix(".onnx")
HEAD_PATH = MODEL_PATH.parent / "gradcam_head.npz"
MODEL_VERSION = "mobilenetv2-v1.0"
CLASS_NAMES = ["NORMAL", "PNEUMONIA", "TUBERCULOSIS", "UNKNOWN"]
LAST_CONV_LAYER_NAME = "block_16_project_BN"

_session = None
_input_name = None
_head = None
_model_load_lock = Lock()
_inference_lock = Lock()

cv2.setNumThreads(1)


def _load_model_once():
    """Initialize the ONNX session and Grad-CAM head weights on first use."""
    global _session, _input_name, _head
    if _session is None:
        with _model_load_lock:
            if _session is None:
                import onnxruntime as ort

                options = ort.SessionOptions()
                options.intra_op_num_threads = 1
                options.inter_op_num_threads = 1
                options.enable_cpu_mem_arena = False
                session = ort.InferenceSession(
                    str(ONNX_PATH), options, providers=["CPUExecutionProvider"]
                )
                _head = load_head(HEAD_PATH)
                _input_name = session.get_inputs()[0].name
                _session = session
    return _session, _input_name, _head


def preprocess_image(image_path: str):
    with Image.open(image_path) as source:
        img = source.convert("RGB").resize((224, 224))
    orig_img = np.asarray(img)
    # Same as keras.applications.mobilenet_v2.preprocess_input: scale to [-1, 1].
    arr = orig_img.astype("float32") / 127.5 - 1.0
    arr = np.expand_dims(arr, axis=0)
    return arr, orig_img


def _save_gradcam_overlay(heatmap: np.ndarray, orig_img: np.ndarray, scan_id: UUID | str) -> str:
    height, width = orig_img.shape[:2]
    resized_heatmap = cv2.resize(heatmap, (width, height))
    heatmap_uint8 = np.uint8(255 * resized_heatmap)
    colored_heatmap = cv2.applyColorMap(heatmap_uint8, cv2.COLORMAP_JET)
    original_bgr = cv2.cvtColor(orig_img, cv2.COLOR_RGB2BGR)
    overlay = cv2.addWeighted(original_bgr, 0.6, colored_heatmap, 0.4, 0)

    output_path = Path(settings.upload_dir) / str(scan_id) / "gradcam.png"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if not cv2.imwrite(str(output_path), overlay):
        raise RuntimeError(f"Could not save Grad-CAM image to {output_path}")
    return str(output_path)


def run_analysis(scan_id: UUID | str, image_path: str) -> dict:
    """Run four-class prediction and Grad-CAM."""
    with _inference_lock:
        session, input_name, head = _load_model_once()
        img_array, orig_img = preprocess_image(image_path)
        outputs = session.run(None, {input_name: img_array})
        activations = next(o for o in outputs if o.ndim == 4)[0]
        pred_probs = next(o for o in outputs if o.ndim == 2)[0]

        pred_class_idx = int(np.argmax(pred_probs))
        confidence = float(pred_probs[pred_class_idx])
        probabilities = {
            CLASS_NAMES[index]: float(pred_probs[index])
            for index in range(len(CLASS_NAMES))
        }
        heatmap = gradcam_heatmap(activations, head, pred_class_idx)
        gradcam_path = _save_gradcam_overlay(heatmap, orig_img, scan_id)

        return {
            "normal_probability": probabilities["NORMAL"],
            "pneumonia_probability": probabilities["PNEUMONIA"],
            "tuberculosis_probability": probabilities["TUBERCULOSIS"],
            "other_probability": probabilities["UNKNOWN"],
            "ai_confidence": confidence,
            "gradcam_path": gradcam_path,
            "model_version": MODEL_VERSION,
        }
