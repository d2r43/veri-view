# Veri-View

Veri-View is a browser extension for screening images and videos for signs of AI generation or manipulation. The extension sends media to a Python backend running on your computer, where the models analyze it locally.

**Detection results are estimates, not proof.** Use Veri-View as a screening aid, not as the sole basis for important decisions.

## Models

- **Images:** [`Imagers/imager-1-pro`](https://huggingface.co/Imagers/imager-1-pro), using a ConvNeXt-Base architecture.
- **Video frames:** [`dima806/deepfake_vs_real_image_detection`](https://huggingface.co/dima806/deepfake_vs_real_image_detection). The backend samples frames from a video and analyzes them individually.

The image model is a ConvNeXt model, not a Vision Transformer (ViT). Model files are downloaded from Hugging Face when needed and cached on your computer.

## How it works

1. The browser extension sends the selected media to the Veri-View backend on your computer.
2. The backend analyzes the image or sampled video frames.
3. The extension displays the screening result. You can also generate a PDF report.

The backend uses `http://127.0.0.1:5000`. Media analysis runs locally; media is not sent to a hosted inference service.

## Requirements

- Python 3.13
- Git
- An internet connection to install dependencies and download the models the first time
- Enough disk space for the Python packages and model files

The first model download may take several minutes. Later runs use the local cache.

## Backend setup

Open a terminal at the repository root, then follow the instructions for your operating system.

### Windows — PowerShell

```powershell
cd backend
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
python app.py
```

If PowerShell blocks activation, allow scripts for this terminal session and activate again:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

If `py -3.13` is not recognized, install Python 3.13 and reopen PowerShell.

### macOS

```bash
cd backend
python3.13 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
python app.py
```

If `python3.13` is not found, install Python 3.13 and reopen Terminal.

### Linux

```bash
cd backend
python3.13 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
python app.py
```

On Debian or Ubuntu, if creating the virtual environment fails, install the venv package for Python 3.13, then retry:

```bash
sudo apt update
sudo apt install python3.13-venv
```

Keep the terminal open while using the extension. The backend is ready when it reports that the model loaded and Flask is running at `http://127.0.0.1:5000`. Stop it with **Ctrl+C**.

### Start the backend again later

From the `backend` directory, activate the environment and start the app:

**Windows PowerShell**

```powershell
.\.venv\Scripts\Activate.ps1
python app.py
```

**macOS or Linux**

```bash
source .venv/bin/activate
python app.py
```

## Load the browser extension

1. Start the backend.
2. Open the extensions page:
   - Chrome: `chrome://extensions`
   - Brave: `brave://extensions`
3. Turn on **Developer mode**.
4. Select **Load unpacked**.
5. Choose the repository’s `extension` folder.
6. Open an image or video and use the Veri-View extension.

Load the extension separately in each browser where you want to use it. If you edit extension files, reload Veri-View from the browser’s extensions page.

## Run the tests

With the backend environment activated, run:

```bash
python -m unittest discover -v
```

Run the tests from the `backend` directory.

## Privacy

- Media is sent from the extension to the backend on your own computer.
- Model inference runs locally; media is not sent to a hosted inference service.
- The model files are downloaded from Hugging Face when needed. This requires an internet connection for the initial download.
- The backend is intended for local use. Do not expose its port to the public internet.

## Limitations

AI detection is imperfect. Compression, resizing, editing, unfamiliar content, and newer generation methods can affect results. A high score does not prove media is fake, and a low score does not prove it is authentic. Video results are based on sampled frames and may miss details between them.

Do not treat Veri-View results or generated reports as legal findings or definitive proof.

## License

This project is licensed under the MIT License. See [`LICENSE`](LICENSE).
