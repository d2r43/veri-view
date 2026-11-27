# Veri-View

Veri-View is a privacy-first browser extension for checking images and videos for signs of AI generation or manipulation. It sends media from the browser to a backend running on your own computer, where the model analyzes it.

> **Note:** Detection results are estimates, not proof. Treat the score as a signal for further review.

## How it works

1. The extension finds or receives an image or video in your browser.
2. It sends the media to the Veri-View backend on your computer.
3. The backend analyzes the media and returns a result to the extension.

The backend runs at `http://127.0.0.1:5000`. The model is downloaded from Hugging Face when needed, so an internet connection is required for the initial download. Media analysis is performed by the local backend.

## Requirements

- Python 3.13
- Git
- An internet connection for installing dependencies and downloading the model the first time

The first model download can take a while and requires several hundred megabytes of disk space.

## Backend setup

Run these commands from the repository’s `backend` directory.

### Windows PowerShell

From the repository root:

```powershell
cd backend
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
python app.py
```

If PowerShell blocks virtual-environment activation, allow it for the current terminal only, then activate again:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

If the Python launcher cannot find Python 3.13, install Python 3.13 and reopen PowerShell.

### macOS

From the repository root:

```bash
cd backend
python3.13 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
python app.py
```

If `python3.13` is not available, install Python 3.13 and reopen Terminal.

### Linux

From the repository root:

```bash
cd backend
python3.13 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
python app.py
```

On Debian or Ubuntu, if creating the virtual environment fails, install the venv package for your Python version, then repeat the setup:

```bash
sudo apt update
sudo apt install python3.13-venv
```

Keep the terminal running while you use the extension. The backend is ready when its startup output says the model loaded and Flask is running at `http://127.0.0.1:5000`.

To stop the backend, press **Ctrl+C** in that terminal.

### Starting it again later

Open a terminal in the repository’s `backend` directory, activate the virtual environment, and start the app:

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

## Load the extension

1. Start the backend using the instructions above.
2. Open your browser’s extensions page:
   - Chrome: `chrome://extensions`
   - Brave: `brave://extensions`
3. Turn on **Developer mode**.
4. Select **Load unpacked**.
5. Choose the repository’s `extension` folder.
6. Open an image or video in the browser and use the Veri-View extension.

The extension needs to be loaded separately in each browser where you want to use it. If you change extension files, reload Veri-View on the extensions page.

## Run the tests

With the backend virtual environment activated, run from the `backend` directory:

```bash
python -m unittest discover -v
```

If you prefer to run the API, model configuration, and scoring tests directly:

```bash
python -m unittest test_model_config test_scoring test_api
```

## Troubleshooting

### The extension cannot connect

- Confirm the backend terminal is still running.
- Check that the backend reports `http://127.0.0.1:5000`.
- Reload the extension from the browser’s extensions page.
- Keep the backend address at `127.0.0.1`; the extension expects the local service.

### The model fails to load

- Confirm Python dependencies installed successfully in the active virtual environment.
- Check that you have an internet connection for the initial model download.
- Run `python app.py` again and read the first error message printed in the terminal.
- On Windows, a Hugging Face symlink warning is generally non-fatal; the cache can still work, though it may use more disk space.

### Activation fails

Make sure the terminal is in the `backend` directory and that `.venv` exists. If it does not, create it with the command for your operating system above.

### Video checks fail

Keep the backend running while checking the video. Video analysis can take longer than image analysis. If it fails, try a shorter supported video and check the backend terminal for an error.

## Privacy

- Media is sent from the browser extension to the backend running on your own computer.
- The backend uses the locally running model to analyze media.
- The model files are downloaded from Hugging Face when needed; this requires an internet connection.
- Do not expose the backend port to the public internet.

## Limitations

AI detection is imperfect. Resizing, compression, editing, new generation methods, and unfamiliar content can affect results. A high score does not prove that media is fake, and a low score does not prove that it is authentic. Use Veri-View as an aid to review, not as the sole basis for important decisions.
