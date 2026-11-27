# Veri-View

Veri-View is a Chromium browser extension and local Python backend for screening images and videos for signs of AI generation or manipulation. It runs model inference on your computer and is intended as an experimental aid, not proof of authenticity.

## What it does

- **Images:** Screens images on web pages and displays a screening score and visual indicator.
- **Videos:** Screens direct MP4/WebM files and samples frames from supported video players. Streamed video is captured in the browser; the full stream is not downloaded by Veri-View.
- **Reports:** Creates a local PDF report with the screening result, media hash, and available metadata.
- **Local analysis:** Sends media to the local backend at `127.0.0.1:5000` for inference. It does not send media to a cloud inference API.

## Before you start

- Python **3.11–3.13** is recommended. Python 3.13 was used for the latest verification.
- Google Chrome, Brave, or Microsoft Edge.
- Internet access for the first model download. The image checkpoint is about 350 MB; the video frame model downloads the first time you analyze a video.
- Several gigabytes of free disk space for Python packages and cached model weights.

The models are downloaded from Hugging Face and cached on your computer. Only the model weights are downloaded; images and videos submitted for screening stay on your computer and are sent only to the local backend. See the [PyTorch installation guide](https://pytorch.org/get-started/locally/) if you need a platform-specific CPU, CUDA, or macOS installation.

## Backend setup

Open a terminal and clone the repository, then move into its `backend` directory:

```text
git clone https://github.com/d2r43/veri-view.git
cd veri-view/backend
```

Create a virtual environment and activate it using the instructions for your operating system.

### Windows — PowerShell

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python app.py
```

If PowerShell says script execution is blocked, allow scripts for this terminal session only, then activate again:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\venv\Scripts\Activate.ps1
```

For Windows Command Prompt instead of PowerShell, activate with:

```bat
venv\Scripts\activate.bat
```

### macOS

```bash
python3 -m venv venv
source venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python app.py
```

### Linux

```bash
python3 -m venv venv
source venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python app.py
```

On Debian or Ubuntu, if creating the environment reports that `venv` is unavailable, install the distribution's `python3-venv` package and repeat the setup. For GPU-specific PyTorch builds, use the official PyTorch installation selector linked above.

The backend listens on `http://127.0.0.1:5000`. On its first start, wait for **Model Loaded Successfully**. The first download can take a few minutes. Check that the server responds by opening:

```text
http://127.0.0.1:5000/health
```

You should see a healthy status response. Keep the terminal open while using the extension. To stop the backend, press **Ctrl+C** in that terminal.

## Install the browser extension

1. Start the backend and leave it running.
2. Open the extensions page for your browser:
   - Chrome: `chrome://extensions`
   - Brave: `brave://extensions`
   - Edge: `edge://extensions`
3. Turn on **Developer mode**.
4. Choose **Load unpacked** and select this repository's `extension` folder.
5. Pin Veri-View if you want quick access from the toolbar.

After updating the repository, use the extension's **Reload** button on the extensions page, then refresh the page being analyzed.

## Use Veri-View

### Images

Open a regular website containing images. Veri-View screens eligible images automatically; hover an image to view its Veri-View indicator and details. Pages managed by the browser itself, such as `chrome://` or `brave://` pages, do not allow extensions to run.

### Videos

- **Direct MP4/WebM:** Open a page containing a direct video and use the Veri-View video control.
- **Streamed players:** Open the video's watch page, hover the player, and choose Veri-View. Keep that tab active while it captures and analyzes up to eight frames locally.

Live streams, thumbnail previews, DRM-protected players, and players that block seeking or screen capture may not work. Video results summarize sampled frames; they are not temporal or audio analysis.

### Screening reports

Use **Generate PDF Report** in the result view to create a report with the score, SHA-256 hash, and available metadata or sampled-frame count. Reports are saved by the local backend.

## Scores and limitations

Scores are model outputs, not calibrated probabilities, guarantees, or proof that media is real or AI-generated. Performance can vary with image compression, editing, new generators, and media outside the model's training data. The model publisher's validation figures are author-reported and are not independently verified by this project. Treat results as screening signals and corroborate them with other evidence.

## Tests

From the `backend` directory with the virtual environment activated, run the offline tests:

```bash
python -m unittest test_model_config test_scoring test_api
```

These tests do not download model weights. A full startup check also loads the local model; run `python app.py` and confirm the terminal prints **Model Loaded Successfully**.

## Troubleshooting

- **`Model Loaded Successfully` does not appear:** Confirm the virtual environment is active and dependencies installed. The first model download needs internet access. Read the full `Model Load Failed` message in the backend terminal.
- **“AI model is unavailable” in the browser:** The backend started without loading the image model. Stop it with **Ctrl+C**, correct the model-loading error, and restart it.
- **The extension cannot connect:** Open `http://127.0.0.1:5000/health`. If it does not respond, start the backend and check that another program is not using port 5000.
- **No indicator appears after updating:** Reload Veri-View from the browser's extensions page and refresh the website tab.
- **A video is not analyzed:** Use the video's watch page, keep the tab active, and check that the player supports seeking and visible-frame capture.

## Local API

The extension uses these local backend routes:

| Route | Purpose |
| --- | --- |
| `GET /health` | Check that the backend is running |
| `POST /check` | Analyze an uploaded image |
| `POST /check-video` | Analyze a direct video upload |
| `POST /check-video-frames` | Analyze frames captured locally from a streamed player |
| `POST /report` | Generate a PDF report |

Image uploads are limited to 10 MB. Direct video uploads are limited to 50 MB. Streamed-video analysis accepts up to eight frames, with a 10 MB combined upload limit.

## Privacy notes

- Images and video frames are analyzed by the local Python backend.
- The extension does not upload media to a cloud inference service.
- Public model weights are downloaded from Hugging Face and cached locally.
- When screening a web page, the extension passes the source URL to the local backend as context; it does not ask the backend to fetch arbitrary URLs.


