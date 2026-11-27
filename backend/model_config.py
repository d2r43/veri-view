"""Stable local model selection for Veri-View's image classifier."""
import os


DEFAULT_IMAGE_MODEL_ID = "Imagers/imager-1-pro"
# The publisher's main revision has an incompatible wrapped PyTorch checkpoint.
# This immutable revision contains a flat torchvision-compatible safetensors
# checkpoint. Do not follow mutable `main`.
DEFAULT_IMAGE_MODEL_REVISION = "29c4343c448ca1325346071f3bbef3785b639b6c"
DEFAULT_IMAGE_MODEL_FILE = "model.safetensors"


def image_pipeline_options(environ=None):
    """Return deterministic model options, with optional local overrides."""
    environ = os.environ if environ is None else environ
    return {
        "repo_id": environ.get("VERIVIEW_IMAGE_MODEL", DEFAULT_IMAGE_MODEL_ID),
        "revision": environ.get(
            "VERIVIEW_IMAGE_MODEL_REVISION", DEFAULT_IMAGE_MODEL_REVISION
        ),
        "filename": DEFAULT_IMAGE_MODEL_FILE,
    }
