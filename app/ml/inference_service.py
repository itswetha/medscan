"""Single-model MobileNetV2 inference and Grad-CAM integration."""

import hashlib
import json
import os
import tempfile
from pathlib import Path
from threading import Lock
from typing import Any
from uuid import UUID
from zipfile import ZipFile

import cv2
import numpy as np
from PIL import Image

from app.core.config import settings

MODEL_PATH = Path(settings.model_path).expanduser().resolve()
MODEL_VERSION = "mobilenetv2-v1.0"
CLASS_NAMES = ["NORMAL", "PNEUMONIA", "TUBERCULOSIS", "UNKNOWN"]
LAST_CONV_LAYER_NAME = "block_16_project_BN"

_model = None
_grad_model = None
_tensorflow = None
_preprocess_input = None
_model_load_lock = Lock()


def _compatible_model_path() -> Path:
    """Make a cached compatibility copy for Keras' null Dense quantization field.

    The original .keras archive is never modified. Only a null
    `quantization_config` field on Dense is removed; non-null quantization
    metadata is rejected instead of silently discarded.
    """
    with ZipFile(MODEL_PATH, "r") as archive:
        if "config.json" not in archive.namelist():
            raise ValueError(f"Not a supported Keras archive: {MODEL_PATH}")
        config = json.loads(archive.read("config.json"))

    removed = 0

    def strip_null_dense_quantization(value: Any) -> None:
        nonlocal removed
        if isinstance(value, dict):
            layer_config = value.get("config")
            if value.get("class_name") == "Dense" and isinstance(layer_config, dict):
                if "quantization_config" in layer_config:
                    if layer_config["quantization_config"] is not None:
                        raise ValueError("Model has non-null Dense quantization metadata; refusing to alter it")
                    layer_config.pop("quantization_config")
                    removed += 1
            for child in value.values():
                strip_null_dense_quantization(child)
        elif isinstance(value, list):
            for child in value:
                strip_null_dense_quantization(child)

    strip_null_dense_quantization(config)
    if not removed:
        return MODEL_PATH

    digest = hashlib.sha256(MODEL_PATH.read_bytes()).hexdigest()
    cache_dir = Path(tempfile.gettempdir()) / "medscan-model-cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    compatible_path = cache_dir / f"mobilenetv2-v1.0-{digest}.keras"
    if compatible_path.is_file():
        return compatible_path

    temporary_path = cache_dir / f".{compatible_path.name}.{os.getpid()}.tmp"
    try:
        with ZipFile(MODEL_PATH, "r") as source, ZipFile(temporary_path, "w") as target:
            for item in source.infolist():
                contents = source.read(item.filename)
                if item.filename == "config.json":
                    contents = json.dumps(config, separators=(",", ":")).encode("utf-8")
                target.writestr(item, contents)
        os.replace(temporary_path, compatible_path)
    finally:
        temporary_path.unlink(missing_ok=True)
    return compatible_path


def _load_model_once():
    """Initialize the shared Keras model and Grad-CAM model on first use."""
    global _model, _grad_model, _tensorflow, _preprocess_input
    if _model is None:
        with _model_load_lock:
            if _model is None:
                import tensorflow as tf

                _preprocess_input = tf.keras.applications.mobilenet_v2.preprocess_input
                loaded_model = tf.keras.models.load_model(str(_compatible_model_path()), compile=False)
                grad_model = tf.keras.models.Model(
                    inputs=loaded_model.input,
                    outputs=[loaded_model.get_layer(LAST_CONV_LAYER_NAME).output, loaded_model.output],
                )
                _tensorflow = tf
                _grad_model = grad_model
                _model = loaded_model
    return _model, _grad_model, _tensorflow


def preprocess_image(image_path: str):
    img = Image.open(image_path).convert("RGB").resize((224, 224))
    orig_img = np.array(img)
    arr = orig_img.astype("float32")
    arr = _preprocess_input(arr)
    arr = np.expand_dims(arr, axis=0)
    return arr, orig_img


def predict(image_path: str, model):
    img_array, orig_img = preprocess_image(image_path)
    pred_probs = model.predict(img_array, verbose=0)[0]
    pred_class_idx = int(np.argmax(pred_probs))
    return {
        "predicted_class": CLASS_NAMES[pred_class_idx],
        "confidence": float(pred_probs[pred_class_idx]),
        "all_probs": {CLASS_NAMES[i]: float(pred_probs[i]) for i in range(len(CLASS_NAMES))},
        "pred_class_idx": pred_class_idx,
        "pred_probs": pred_probs,
        "orig_img": orig_img,
        "img_array": img_array,
    }


def get_gradcam(img_array, grad_model, tf, class_idx=None):
    with tf.GradientTape() as tape:
        conv_output, predictions = grad_model(img_array)
        if class_idx is None:
            class_idx = int(tf.argmax(predictions[0]))
        loss = predictions[:, class_idx]

    grads = tape.gradient(loss, conv_output)
    pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))
    conv_output = conv_output[0]
    heatmap = tf.reduce_sum(tf.multiply(pooled_grads, conv_output), axis=-1)
    heatmap = tf.maximum(heatmap, 0) / (tf.math.reduce_max(heatmap) + 1e-8)
    return heatmap.numpy(), class_idx


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
    """Run four-class prediction and Grad-CAM using one shared model object."""
    model, grad_model, tf = _load_model_once()
    prediction = predict(image_path, model)
    heatmap, _ = get_gradcam(
        prediction["img_array"],
        grad_model,
        tf,
        class_idx=prediction["pred_class_idx"],
    )
    gradcam_path = _save_gradcam_overlay(heatmap, prediction["orig_img"], scan_id)
    probabilities = prediction["all_probs"]

    return {
        "normal_probability": probabilities["NORMAL"],
        "pneumonia_probability": probabilities["PNEUMONIA"],
        "tuberculosis_probability": probabilities["TUBERCULOSIS"],
        "other_probability": probabilities["UNKNOWN"],
        "ai_confidence": prediction["confidence"],
        "gradcam_path": gradcam_path,
        "model_version": MODEL_VERSION,
    }
