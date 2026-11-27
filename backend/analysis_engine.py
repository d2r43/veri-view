import hashlib
import io
import os
import tempfile
import cv2
import numpy as np
from PIL import Image
from PIL.ExifTags import TAGS
from urllib.parse import urlparse
from transformers import pipeline
from scoring import aggregate_frame_scores, fake_probability, verdict_for_score
# import mediapipe as mp (DISABLED due to DLL errors)

# Image-level AI generation model. Override to test a different local model.
MODEL_ID = os.environ.get("VERIVIEW_IMAGE_MODEL", "Imagers/imager-1-pro")
try:
    print(f"Loading AI image model ({MODEL_ID})...")
    pipe = pipeline("image-classification", model=MODEL_ID)
    print("Model Loaded Successfully.")
except Exception as e:
    print(f"Model Load Failed: {e}")
    pipe = None

# Keep the frame-level face-manipulation detector for video. It is loaded only
# when a user asks to analyze a video, so image-only browsing does not load two models.
VIDEO_MODEL_ID = os.environ.get(
    "VERIVIEW_VIDEO_MODEL", "dima806/deepfake_vs_real_image_detection"
)
video_pipe = None
video_model_load_attempted = False


def get_video_pipeline():
    """Load the video frame model on the first video request only."""
    global video_pipe, video_model_load_attempted
    if not video_model_load_attempted:
        video_model_load_attempted = True
        try:
            print(f"Loading video frame model ({VIDEO_MODEL_ID})...")
            video_pipe = pipeline("image-classification", model=VIDEO_MODEL_ID)
        except Exception as e:
            print(f"Video frame model load failed: {e}")
            video_pipe = None
    return video_pipe

# Trust Score Helper
TRUSTED_DOMAINS = {
    'wikipedia.org': 'High',
    'gov.in': 'High',
    'nytimes.com': 'High',
    'bbc.com': 'High',
    'reuters.com': 'High',
    'twitter.com': 'Medium',
    'facebook.com': 'Medium',
    'instagram.com': 'Low',
    'whatsapp.com': 'Low'
}

def get_domain_trust(url):
    try:
        domain = urlparse(url).netloc
        # Handle subdomains (e.g., en.wikipedia.org)
        for d in TRUSTED_DOMAINS:
            if domain.endswith(d):
                return {"domain": domain, "trust": TRUSTED_DOMAINS[d]}
        return {"domain": domain, "trust": "Neutral"}
    except:
        return {"domain": "Unknown", "trust": "Unknown"}

def get_image_hash(image_bytes):
    return hashlib.sha256(image_bytes).hexdigest()

def get_image_metadata(pil_image):
    meta_dict = {}
    try:
        info = pil_image.getexif()
        if info:
            for tag, value in info.items():
                decoded = TAGS.get(tag, tag)
                # Filter useful tags
                if decoded in ['Make', 'Model', 'Software', 'DateTime', 'DateTimeOriginal']:
                    meta_dict[decoded] = str(value)
    except Exception as e:
        print(f"Metadata Error: {e}")
    
    if not meta_dict:
        return "Stripped / None Found"
    return meta_dict

def analyze_image(image_bytes, url="", classifier=pipe, model_id=MODEL_ID):
    """
    Enhanced Forensic Analysis with MediaPipe.
    Returns: Score, Verdict, Hash, Metadata, Domain Trust.
    """
    try:
        # 1. Image Forensics (Hash & Metadata)
        img_hash = get_image_hash(image_bytes)
        
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            return {"score": None, "verdict": "ERROR", "error": "Image decode failed"}

        # Domain Trust
        trust_info = get_domain_trust(url)
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        pil_image = Image.fromarray(img_rgb)
        full_pil = Image.open(io.BytesIO(image_bytes))
        metadata = get_image_metadata(full_pil)

        if classifier is None:
            return {"score": None, "verdict": "ERROR", "error": "AI model is unavailable"}
        predictions = classifier(pil_image)
        fake_score = fake_probability(predictions)
        if fake_score is None:
            return {"score": None, "verdict": "ERROR", "error": "Model labels were not recognized"}
        verdict = verdict_for_score(fake_score)

        return {
            "score": round(fake_score, 2),
            "verdict": verdict,
            "hash": img_hash,
            "metadata": metadata,
            "trust_idx": trust_info,
            "model": model_id,
        }

    except Exception as e:
        print(f"Analysis Error: {e}")
        return {"score": None, "verdict": "ERROR", "error": "Image analysis failed"}


def analyze_video(video_bytes, url="", max_frames=8):
    """Sample up to eight frames from a local temporary copy and score each."""
    suffix = ".webm" if "webm" in url.lower() else ".mp4"
    temp_path = None
    capture = None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temp_file:
            temp_file.write(video_bytes)
            temp_path = temp_file.name

        capture = cv2.VideoCapture(temp_path)
        frame_total = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
        if not capture.isOpened() or frame_total < 1:
            return {"score": None, "verdict": "ERROR", "error": "Video could not be decoded"}

        classifier = get_video_pipeline()
        if classifier is None:
            return {"score": None, "verdict": "ERROR", "error": "Video analysis model is unavailable"}

        frame_indexes = np.linspace(0, frame_total - 1, num=min(max_frames, frame_total), dtype=int)
        results = []
        for frame_index in frame_indexes:
            capture.set(cv2.CAP_PROP_POS_FRAMES, int(frame_index))
            ok, frame = capture.read()
            if not ok:
                continue
            encoded, buffer = cv2.imencode(".jpg", frame)
            if encoded:
                results.append(analyze_image(
                    buffer.tobytes(), url=url, classifier=classifier, model_id=VIDEO_MODEL_ID
                ))

        aggregation = aggregate_frame_scores([item.get("score") for item in results])
        if aggregation is None:
            return {"score": None, "verdict": "ERROR", "error": "No video frames could be analyzed"}

        return {
            **aggregation,
            "hash": hashlib.sha256(video_bytes).hexdigest(),
            "metadata": {"sampled_frames": aggregation["frame_count"]},
            "trust_idx": get_domain_trust(url),
            "model": VIDEO_MODEL_ID,
            "media_type": "video",
        }
    except Exception as e:
        print(f"Video analysis error: {e}")
        return {"score": None, "verdict": "ERROR", "error": "Video analysis failed"}
    finally:
        if capture is not None:
            capture.release()
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)


def analyze_video_frames(frame_bytes, url=""):
    """Analyze already-cropped browser frames without storing the full video."""
    if not frame_bytes or len(frame_bytes) > 8:
        return {"score": None, "verdict": "ERROR", "error": "Provide between 1 and 8 video frames"}
    classifier = get_video_pipeline()
    if classifier is None:
        return {"score": None, "verdict": "ERROR", "error": "Video analysis model is unavailable"}

    results = [
        analyze_image(frame, url=url, classifier=classifier, model_id=VIDEO_MODEL_ID)
        for frame in frame_bytes
    ]
    aggregation = aggregate_frame_scores([item.get("score") for item in results])
    if aggregation is None:
        return {"score": None, "verdict": "ERROR", "error": "No video frames could be analyzed"}

    return {
        **aggregation,
        "hash": hashlib.sha256(b"".join(frame_bytes)).hexdigest(),
        "metadata": {"sampled_frames": aggregation["frame_count"], "capture_method": "local browser frame capture"},
        "trust_idx": get_domain_trust(url),
        "model": VIDEO_MODEL_ID,
        "media_type": "video",
    }
