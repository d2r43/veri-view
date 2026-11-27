// Veri-View Background Script

const API_URL = "http://localhost:5000/check";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "CHECK_IMAGE") {
        handleCheckImage(message.url, sendResponse);
        return true; // Keep channel open for async response
    }

    if (message.type === "OPEN_REPORT") {
        // Save data to storage so Popup can read it
        chrome.storage.local.set({ reportData: message.payload }, () => {
            // For V3 compliance, we might just Badge the icon or open a new tab.
            // We try to open a window, but if it fails (popup blocker), user can click extension.
            chrome.windows.create({
                url: "popup.html",
                type: "popup",
                width: 400,
                height: 600
            });
        });
    }

    if (message.type === "SET_CONTEXT") {
        // Just save state (for when user clicks toolbar icon manually)
        chrome.storage.local.set({ reportData: message.payload });
    }
});

async function handleCheckImage(url, sendResponse) {
    try {
        // Fetch in the extension context, which has the host permissions needed
        // by cross-origin images. Send the already-loaded image bytes only to the
        // local backend; never make the backend fetch an arbitrary page URL.
        const imageResponse = await fetch(url);
        if (!imageResponse.ok) {
            throw new Error(`Image request failed (${imageResponse.status})`);
        }
        if (!imageResponse.body) {
            throw new Error("Image response had no readable body");
        }

        const declaredSize = Number(imageResponse.headers.get("Content-Length"));
        if (declaredSize > MAX_IMAGE_BYTES) {
            throw new Error("Image exceeds the 10 MB analysis limit");
        }
        const reader = imageResponse.body.getReader();
        const chunks = [];
        let imageSize = 0;
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            imageSize += value.byteLength;
            if (imageSize > MAX_IMAGE_BYTES) {
                await reader.cancel();
                throw new Error("Image exceeds the 10 MB analysis limit");
            }
            chunks.push(value);
        }
        const imageBlob = new Blob(chunks, {
            type: imageResponse.headers.get("Content-Type") || ""
        });
        if (imageBlob.type && !imageBlob.type.startsWith("image/")) {
            throw new Error("The selected resource is not an image");
        }
        if (imageBlob.size > MAX_IMAGE_BYTES) {
            throw new Error("Image exceeds the 10 MB analysis limit");
        }

        const formData = new FormData();
        formData.append("image", imageBlob, "image");
        formData.append("source_url", url);
        const response = await fetch(API_URL, {
            method: "POST",
            body: formData
        });
        if (!response.ok) {
            throw new Error(`Analysis request failed (${response.status})`);
        }
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        sendResponse({ success: true, data: data });
    } catch (error) {
        console.error("API Error:", error);
        sendResponse({ success: false, error: error.message });
    }
}
