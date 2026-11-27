# Veri-View: AI Media Screening 🛡️

![Veri-View Banner](https://img.shields.io/badge/Status-Production_Ready-success)
![Python](https://img.shields.io/badge/Backend-Flask_%2B_Transformers-blue)
![AI Model](https://img.shields.io/badge/Model-Imager_1_Pro-yellow)

**Veri-View** is a privacy-first Chrome Extension that scans web images and user-selected direct videos for AI-generated content. Media is analyzed by a local Python backend.

> **Reports:** Generates screening reports containing the media hash, model score, and available metadata. The report is not a legal finding or proof of authenticity.

## ✨ Key Features

- **🧠 Real-Time AI Analysis**: Uses the local [`Imagers/imager-1-pro`](https://huggingface.co/Imagers/imager-1-pro) classifier for AI-generated image screening. Its model card reports results on its Defactify validation split; those author-reported metrics are not independent validation and do not guarantee accuracy on every website or generator. The first startup downloads roughly 350 MB of weights.
- **🎞️ Video Screening**: Hover a direct MP4 or WebM video and click the Veri-View widget to sample up to eight frames with a separate deepfake frame classifier. This is frame-level screening, not temporal analysis, and cannot catch every manipulation. Video uploads are limited to 50 MB and analyzed by the local backend. Streaming players that expose only `blob:` or segmented URLs are not supported yet.
- **⚡ Passive Scanning**: Automatically highlights images on webpages:
  - 🟢 **Green Border**: No AI-generation signal detected
  - 🔴 **Red Border**: High AI-generation model score
  - 🟡 **Yellow Border**: Inconclusive model score
- **📄 Screening Reports**: One-click generation of PDF reports with:
  - SHA-256 media hash
  - Available image metadata or sampled video-frame count
  - Model name, score, and screening result
- **🔒 Privacy First**: Media bytes are sent from the browser to `localhost` for analysis. Video bytes are held in a temporary local file while frames are decoded, then the file is removed. No image or video is sent to a cloud inference API.

Model scores are screening signals, not calibrated probabilities or proof of authenticity. An inconclusive score should be reviewed independently.

## 🛠️ Tech Stack

- **Frontend**: Vanilla JavaScript (Manifest V3), HTML5, CSS3.
- **Backend**: Python (Flask).
- **AI Engine**: Hugging Face `transformers` (ConvNeXt), `torch`, `Pillow`.
- **Reports**: `hashlib` (Hashing), `reportlab` (PDF Generation).

## 🚀 Installation & Setup

### Prerequisites
- Python 3.10+
- Google Chrome (or Edge/Brave)

### 1. Backend Setup
The backend handles the heavy AI lifting.

```bash
# Clone the repository
git clone https://github.com/d2r43/veri-view.git
cd veri-view/backend

# Create Virtual Environment
python -m venv venv

# Activate (Windows)
.\venv\Scripts\Activate.ps1

# Install Dependencies (Important: includes torch & transformers)
pip install -r requirements.txt

# Start the Server
python app.py
```
*Server runs on `http://localhost:5000`*

### 2. Extension Setup
Load the frontend into your browser.

1.  Open Chrome and navigate to `chrome://extensions`.
2.  Enable **Developer Mode** (toggle in top-right).
3.  Click **Load Unpacked**.
4.  Select the `extension` folder from this project.
5.  Pin the 🛡️ Veri-View icon to your toolbar.

## 📖 Usage Guide

1.  **Start the Backend**: Ensure `app.py` is running (or double-click `start_server.bat`).
2.  **Browse**: Open a page with images or direct MP4/WebM videos.
3.  **Visual Indicators**:
    - Images are screened automatically; hover an image to open the **Veri-View Widget**.
    - Hover a direct MP4/WebM video, then click the widget to sample up to eight frames.
    - Streaming players that expose only `blob:` or segmented URLs are not supported.
4.  **Get Details**: Click the widget or extension icon to open the screening dashboard.
5.  **Report**: Click **"Generate PDF Report"** to download the evidence file.

## ⚖️ Legal Disclaimer

This tool uses probabilistic AI models to estimate the likelihood of manipulation. It is intended as a **preliminary forensic aid** and not definitive proof in a court of law. Always corroborate findings with manual expert analysis.

---
