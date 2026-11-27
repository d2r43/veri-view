// Veri-View Content Script

console.log("Veri-View: Active");

let globalWidget = null;

function scanImages() {
    if (!globalWidget) createGlobalWidget();

    const images = document.querySelectorAll('img');
    images.forEach(img => {
        if (img.dataset.veriViewProcessed === "true" || img.dataset.veriViewProcessed === "scanning") return;
        if (Number(img.dataset.veriViewRetryAfter || 0) > Date.now()) return;

        // Filter small images (icons, etc)
        if (img.width < 100 || img.height < 100) return;

        img.dataset.veriViewProcessed = "scanning";

        // Mark as scanning
        img.classList.add('veri-view-scanning');

        // Send to Background
        chrome.runtime.sendMessage({
            type: "CHECK_IMAGE",
            url: img.currentSrc || img.src
        }, (response) => {
            img.classList.remove('veri-view-scanning');

            if (response && response.success) {
                img.dataset.veriViewProcessed = "true";
                applyVerdict(img, { ...response.data, url: img.currentSrc || img.src });
            } else {
                delete img.dataset.veriViewProcessed;
                img.dataset.veriViewRetryAfter = String(Date.now() + 15000);
                console.error("Analysis failed for", img.src, response);
                // Backend startup and transient image-host errors should not
                // permanently exclude an image from analysis.
                setTimeout(scanImages, 15000);
            }
        });
    });
}

function scanVideos() {
    document.querySelectorAll('video').forEach(video => {
        if (video.dataset.veriViewVideoBound === "true" || video.dataset.veriViewVideoBound === "waiting") return;
        const host = location.hostname.toLowerCase();
        if ((host === "youtube.com" || host.endsWith(".youtube.com")) && location.pathname !== "/watch") return;
        if ((video.clientWidth || video.videoWidth) < 100 || (video.clientHeight || video.videoHeight) < 100) {
            if (!video.videoWidth || !video.videoHeight) {
                video.dataset.veriViewVideoBound = "waiting";
                video.addEventListener('loadedmetadata', () => {
                    delete video.dataset.veriViewVideoBound;
                    scanVideos();
                }, { once: true });
            }
            return;
        }

        video.dataset.veriViewVideoBound = "true";
        video.addEventListener('mouseenter', () => {
            if (!globalWidget) createGlobalWidget();
            globalWidget.className = 'veri-view-widget expanded warning';
            globalWidget.querySelector('#vv-title').innerText = 'Analyze this video';
            globalWidget.querySelector('#vv-desc').innerText = 'Click to sample video frames locally';
            globalWidget.onclick = () => analyzeVideo(video);
        });
    });
}

async function analyzeVideo(video) {
    if (video.dataset.veriViewVideoProcessed === "scanning") return;
    const videoUrl = video.currentSrc || video.src;
    video.dataset.veriViewVideoProcessed = "scanning";
    globalWidget.querySelector('#vv-title').innerText = 'Analyzing video…';
    const directVideo = isDirectVideoUrl(videoUrl);
    globalWidget.querySelector('#vv-desc').innerText = directVideo
        ? 'Sampling up to 8 frames locally'
        : 'Capturing up to 8 visible frames locally';

    try {
        let response;
        if (directVideo) {
            response = await sendExtensionMessage({ type: "CHECK_VIDEO", url: videoUrl });
        } else {
            const frames = await captureRenderedVideoFrames(video);
            response = await sendExtensionMessage({
                type: "CHECK_VIDEO_FRAMES",
                frames,
                sourceUrl: location.href
            });
        }

        if (response && response.success) {
            video.dataset.veriViewVideoProcessed = "true";
            const data = {
                ...response.data,
                url: directVideo ? videoUrl : location.href,
                preview_url: directVideo ? videoUrl : "",
                media_type: "video"
            };
            const type = data.verdict === "FAKE" ? "fake" : (data.verdict === "REAL" ? "safe" : "warning");
            video.classList.add(`veri-view-${type}`);
            updateWidget(data, type);
        } else {
            showVideoError(response?.error || "Video analysis failed. Try again.");
        }
    } catch (error) {
        showVideoError(error.message || "Video analysis failed. Try again.");
    } finally {
        if (video.dataset.veriViewVideoProcessed === "scanning") delete video.dataset.veriViewVideoProcessed;
    }
}

function isDirectVideoUrl(url) {
    if (!url) return false;
    try {
        return /\.(mp4|webm)$/i.test(new URL(url, location.href).pathname);
    } catch (_) {
        return false;
    }
}

function sendExtensionMessage(message) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, response => {
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
            else resolve(response);
        });
    });
}

function wait(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function seekVideo(video, timeSeconds) {
    return new Promise((resolve, reject) => {
        if (Math.abs(video.currentTime - timeSeconds) < 0.15) {
            resolve();
            return;
        }
        const timeout = setTimeout(() => {
            cleanup();
            reject(new Error("The player could not seek to a sample frame"));
        }, 10000);
        const cleanup = () => {
            clearTimeout(timeout);
            video.removeEventListener("seeked", onSeeked);
            video.removeEventListener("error", onError);
        };
        const onSeeked = () => { cleanup(); resolve(); };
        const onError = () => { cleanup(); reject(new Error("The player could not decode a sample frame")); };
        video.addEventListener("seeked", onSeeked, { once: true });
        video.addEventListener("error", onError, { once: true });
        try {
            video.currentTime = timeSeconds;
        } catch (_) {
            cleanup();
            reject(new Error("This video player does not support frame seeking"));
        }
    });
}

async function captureRenderedVideoFrames(video) {
    if (!Number.isFinite(video.duration) || video.duration < 2 || video.seekable.length === 0) {
        throw new Error("Open a seekable video page (not a live stream or thumbnail preview) and try again.");
    }
    const rect = video.getBoundingClientRect();
    if (rect.width < 100 || rect.height < 100 || rect.bottom <= 0 || rect.right <= 0 || rect.top >= innerHeight || rect.left >= innerWidth) {
        throw new Error("Keep the video player visible and at least 100 pixels wide and tall.");
    }

    const wasPaused = video.paused;
    const originalTime = video.currentTime;
    const originalVisibility = globalWidget?.style.visibility || "";
    const frames = [];
    video.pause();
    try {
        const sampleCount = 8;
        for (let index = 0; index < sampleCount; index++) {
            const target = video.duration * (index + 0.5) / sampleCount;
            await seekVideo(video, target);
            await wait(180);
            if (globalWidget) globalWidget.style.visibility = "hidden";
            await new Promise(requestAnimationFrame);
            await new Promise(requestAnimationFrame);
            const capture = await sendExtensionMessage({ type: "CAPTURE_VISIBLE_TAB" });
            if (!capture?.success) throw new Error(capture?.error || "Could not capture the video player");
            frames.push(await cropCapturedVideoFrame(capture.dataUrl, video.getBoundingClientRect()));
            if (globalWidget) globalWidget.style.visibility = originalVisibility;
            if (index < sampleCount - 1) await wait(550);
        }
    } finally {
        if (globalWidget) globalWidget.style.visibility = originalVisibility;
        try { await seekVideo(video, originalTime); } catch (_) { /* keep the playback error visible */ }
        if (!wasPaused) video.play().catch(() => {});
    }
    return frames;
}

function cropCapturedVideoFrame(dataUrl, rect) {
    return new Promise((resolve, reject) => {
        const screenshot = new Image();
        screenshot.onload = () => {
            const scaleX = screenshot.naturalWidth / window.innerWidth;
            const scaleY = screenshot.naturalHeight / window.innerHeight;
            const left = Math.max(0, rect.left * scaleX);
            const top = Math.max(0, rect.top * scaleY);
            const right = Math.min(screenshot.naturalWidth, rect.right * scaleX);
            const bottom = Math.min(screenshot.naturalHeight, rect.bottom * scaleY);
            const cropWidth = right - left;
            const cropHeight = bottom - top;
            if (cropWidth < 100 || cropHeight < 100) {
                reject(new Error("The video is not fully visible in the browser tab"));
                return;
            }
            const resize = Math.min(1, 640 / cropWidth);
            const canvas = document.createElement("canvas");
            canvas.width = Math.round(cropWidth * resize);
            canvas.height = Math.round(cropHeight * resize);
            const context = canvas.getContext("2d");
            context.drawImage(screenshot, left, top, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL("image/jpeg", 0.82));
        };
        screenshot.onerror = () => reject(new Error("Could not crop a captured video frame"));
        screenshot.src = dataUrl;
    });
}

function showVideoError(message) {
    if (!globalWidget) createGlobalWidget();
    globalWidget.className = 'veri-view-widget expanded warning';
    globalWidget.querySelector('#vv-title').innerText = 'Video not analyzed';
    globalWidget.querySelector('#vv-desc').innerText = message;
}

function applyVerdict(img, data) {
    // Validation: Check for backend errors or missing fields
    if (data.error || !data.verdict) {
        console.warn("Veri-View Analysis Issue:", data);
        data.verdict = "ERROR";
        data.score = null;
    }

    let type = "safe";
    if (data.verdict === "FAKE") type = "fake";
    if (data.verdict === "WARNING") type = "warning";

    // NEW: Handle Undecisive/Error as Warning (Yellow), not Safe (Green)
    if (data.verdict === "ERROR" || data.verdict === "SKIPPED" || data.verdict === "UNDECISIVE") {
        type = "warning";
        data.verdict = "UNDECISIVE"; // Rename for better UX
    }

    // visual border
    img.classList.add(`veri-view-${type}`);

    // Interaction Logic
    img.style.cursor = "pointer";

    // On Hover: Select Image & Update Widget
    img.onmouseenter = () => updateWidget(data, type);

    // On Click: Open Sidebar/Report
    img.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        updateWidget(data, type); // Ensure it's active
    };

    // Calculate Display Confidence
    const displayScore = data.score == null ? null : Math.round(data.score);

    // Add Visible Badge (Per-Image)
    const badgeText = displayScore == null
        ? "ANALYSIS UNAVAILABLE"
        : `${data.verdict === "WARNING" || data.verdict === "UNDECISIVE" ? "REVIEW" : data.verdict} · AI ${displayScore}%`;
    addBadge(img, badgeText, type, () => {
        updateWidget(data, type);
    });
}

// Global Widget Logic
function createGlobalWidget() {
    globalWidget = document.createElement('div');
    globalWidget.className = 'veri-view-widget';
    globalWidget.innerHTML = `
        <div class="veri-view-widget-icon">🛡️</div>
        <div class="veri-view-widget-content">
            <div id="vv-title" style="font-weight:bold;">Veri-View Active</div>
            <div id="vv-desc" style="font-size:11px;">Hover an image</div>
        </div>
    `;

    // Append to body (or html if body issue)
    if (document.body) {
        document.body.appendChild(globalWidget);
        console.log("Veri-View: Widget created and appended to body.");
    } else {
        document.documentElement.appendChild(globalWidget);
        console.log("Veri-View: Widget appended to documentElement.");
    }

    // Dragging Logic
    let isDragging = false;
    let offset = { x: 0, y: 0 };

    globalWidget.addEventListener('mousedown', (e) => {
        isDragging = true;
        offset.x = e.clientX - globalWidget.getBoundingClientRect().left;
        offset.y = e.clientY - globalWidget.getBoundingClientRect().top;
        globalWidget.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        globalWidget.style.top = `${e.clientY - offset.y}px`;
        globalWidget.style.left = `${e.clientX - offset.x}px`;
        globalWidget.style.bottom = 'auto';
        globalWidget.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        globalWidget.style.cursor = 'grab';
    });

    // Default Click Action (Open Welcome Screen / Project 1)
    globalWidget.onclick = (e) => {
        // Prevent click if it was a drag operation
        if (Math.abs(e.clientX - offset.x - globalWidget.getBoundingClientRect().left) > 5) return;

        // Open Popup (Background will handle checking if context data exists)
        chrome.runtime.sendMessage({
            type: "OPEN_REPORT",
            payload: {} // Empty payload = Open Welcome/Empty State
        });
    };
}

function updateWidget(data, type) {
    if (!globalWidget) createGlobalWidget();

    // Style
    globalWidget.className = `veri-view-widget expanded ${type}`;

    // Content
    const icon = type === 'fake' ? '⚠️' : (type === 'safe' ? '✅' : '🛡️');
    const title = data.media_type === "video"
        ? (type === 'fake' ? 'Deepfake signal likely' : (type === 'safe' ? 'Low deepfake signal' : 'Video analysis inconclusive'))
        : (type === 'fake' ? 'High AI-generation score' : (type === 'safe' ? 'Low AI-generation score' : 'Image analysis inconclusive'));
    const displayScore = data.score == null ? "Unavailable" : `${Math.round(data.score)}%`;

    globalWidget.querySelector('.veri-view-widget-icon').innerText = icon;
    globalWidget.querySelector('#vv-title').innerText = title;
    const scoreLabel = data.media_type === "video" ? "Mean deepfake frame score" : "AI-generation model score";
    globalWidget.querySelector('#vv-desc').innerText = `${scoreLabel}: ${displayScore} - Click for report`;

    // AUTO-UPDATE CONTEXT: Save this image as the "active" one for the popup
    // IMPORTANT: Pass ALL backend data (hash, metadata, latency, etc.)
    const payload = {
        url: data.url || "",
        score: data.score,
        verdict: data.verdict,
        hash: data.hash,
        metadata: data.metadata,
        latency: data.latency,
        trust_idx: data.trust_idx,
        media_type: data.media_type || "image",
        model: data.model,
        frame_count: data.frame_count,
        preview_url: data.preview_url || ""
    };

    chrome.runtime.sendMessage({
        type: "SET_CONTEXT",
        payload: payload
    });

    // Click to Open Report
    globalWidget.onclick = (e) => {
        // Prevent click if dragging (simple heuristic)
        // offset is defined in createGlobalWidget scope, can't access here directly if separate.
        // But functions are in same scope.
        // Wait, offset is local to createGlobalWidget. I need to make isDragging global or ignore check here.
        // For simplicity, just send message.
        chrome.runtime.sendMessage({
            type: "OPEN_REPORT",
            payload: payload
        });
    };
}

function addBadge(img, text, type, onClickHandler) {
    // Attempt to wrap image to position badge safely
    // 1. Create wrapper if not exists (or use parent if suitable)
    const parent = img.parentElement;

    // Check if we already badged it
    if (parent.classList.contains('veri-view-container')) {
        return;
    }

    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.classList.add('veri-view-container');

    // Insert wrapper before img
    parent.insertBefore(wrapper, img);
    // Move img into wrapper
    wrapper.appendChild(img);

    // Create Badge
    const badge = document.createElement('div');
    badge.className = `veri-view-badge ${type}`;
    badge.innerText = text;
    badge.title = "Click to view details";
    badge.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (onClickHandler) onClickHandler();
    };

    wrapper.appendChild(badge);
}

// Initial Scan
scanImages();
scanVideos();

// Observe for new images
const observer = new MutationObserver((mutations) => {
    scanImages();
    scanVideos();
});
observer.observe(document.documentElement, { childList: true, subtree: true });
