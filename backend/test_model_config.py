"""Offline tests for the image model checkpoint selection."""
import unittest

from model_config import (
    DEFAULT_IMAGE_MODEL_ID,
    DEFAULT_IMAGE_MODEL_REVISION,
    image_pipeline_options,
)


class ImageModelConfigTests(unittest.TestCase):
    def test_default_uses_pinned_safetensors_checkpoint(self):
        self.assertEqual(
            image_pipeline_options({}),
            {
                "repo_id": DEFAULT_IMAGE_MODEL_ID,
                "revision": DEFAULT_IMAGE_MODEL_REVISION,
                "filename": "model.safetensors",
            },
        )
        self.assertEqual(len(DEFAULT_IMAGE_MODEL_REVISION), 40)

    def test_model_and_revision_can_be_overridden_for_local_testing(self):
        options = image_pipeline_options({
            "VERIVIEW_IMAGE_MODEL": "example/model",
            "VERIVIEW_IMAGE_MODEL_REVISION": "test-revision",
        })
        self.assertEqual(options["repo_id"], "example/model")
        self.assertEqual(options["revision"], "test-revision")
        self.assertEqual(options["filename"], "model.safetensors")


if __name__ == "__main__":
    unittest.main()
