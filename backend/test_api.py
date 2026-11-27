"""Offline API tests. No model download or external image host is required."""
import importlib
import io
import sys
import types
import unittest
from unittest.mock import patch


# app.py imports a module that downloads the model during import. Substitute
# its boundaries so these route tests remain fast and network-free.
analysis_engine_stub = types.ModuleType("analysis_engine")
analysis_engine_stub.analyze_image = lambda image_bytes, url="": {}
analysis_engine_stub.analyze_video = lambda video_bytes, url="": {}
utils_stub = types.ModuleType("utils")
utils_stub.download_image_to_memory = lambda url: None
utils_stub.generate_pdf_report = lambda data: "reports/test.pdf"
sys.modules["analysis_engine"] = analysis_engine_stub
sys.modules["utils"] = utils_stub
sys.path.insert(0, ".")
app_module = importlib.import_module("app")


class CheckImageRouteTests(unittest.TestCase):
    def setUp(self):
        self.client = app_module.app.test_client()

    def test_uploaded_image_is_analyzed_without_remote_download(self):
        with patch.object(app_module, "analyze_image", return_value={"verdict": "REAL"}) as analyze:
            response = self.client.post(
                "/check",
                data={
                    "image": (io.BytesIO(bytes([1, 2, 3, 4])), "photo.jpg", "image/jpeg"),
                    "source_url": "https://images.example/photo.jpg",
                },
                content_type="multipart/form-data",
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["verdict"], "REAL")
        self.assertEqual(analyze.call_args.args[0], bytes([1, 2, 3, 4]))
        self.assertEqual(analyze.call_args.kwargs["url"], "https://images.example/photo.jpg")

    def test_missing_image_is_rejected(self):
        response = self.client.post("/check", json={})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json()["error"], "No image provided")

    def test_oversized_upload_is_rejected_before_analysis(self):
        image_data = bytes(10 * 1024 * 1024 + 1)
        with patch.object(app_module, "analyze_image") as analyze:
            response = self.client.post(
                "/check",
                data={"image": (io.BytesIO(image_data), "large.jpg", "image/jpeg")},
                content_type="multipart/form-data",
            )

        self.assertEqual(response.status_code, 413)
        analyze.assert_not_called()


class CheckVideoRouteTests(unittest.TestCase):
    def setUp(self):
        self.client = app_module.app.test_client()

    def test_uploaded_video_is_analyzed_by_local_backend(self):
        video_bytes = b"local video bytes"
        with patch.object(app_module, "analyze_video", return_value={
            "verdict": "REAL", "score": 12.0, "frame_count": 8, "media_type": "video"
        }) as analyze:
            response = self.client.post(
                "/check-video",
                data={
                    "video": (io.BytesIO(video_bytes), "sample.mp4", "video/mp4"),
                    "source_url": "https://media.example/sample.mp4",
                },
                content_type="multipart/form-data",
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["frame_count"], 8)
        self.assertEqual(analyze.call_args.args[0], video_bytes)
        self.assertEqual(analyze.call_args.kwargs["url"], "https://media.example/sample.mp4")

    def test_missing_video_is_rejected(self):
        response = self.client.post("/check-video", data={})
        self.assertEqual(response.status_code, 400)

    def test_oversized_video_is_rejected_before_analysis(self):
        video_bytes = bytes(50 * 1024 * 1024 + 1)
        with patch.object(app_module, "analyze_video") as analyze:
            response = self.client.post(
                "/check-video",
                data={"video": (io.BytesIO(video_bytes), "large.mp4", "video/mp4")},
                content_type="multipart/form-data",
            )

        self.assertEqual(response.status_code, 413)
        analyze.assert_not_called()


if __name__ == "__main__":
    unittest.main()
