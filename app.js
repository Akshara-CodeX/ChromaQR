/**
 * Image-Colored QR Code Generator - Main Application
 * Features:
 * - Direct pixel color sampling from uploaded or sample images
 * - Texture mask mode (QR code clipped from the picture)
 * - Artistic blended overlay mode
 * - Dynamic contrast & scannability optimizer (HSL-based)
 * - Custom module shapes (circles, rounded, classic, squircle)
 * - Custom finder eye designs
 * - Center logo / avatar badge
 * - Live scannability analyzer
 * - High-Res PNG & Vector SVG export
 */

(function() {
    "use strict";

    // Application State
    const state = {
        url: "https://linkedin.com",
        image: null,
        imageSourceType: "sample", // 'sample' or 'upload'
        sampleId: "cyber-neon",
        renderMode: "sampler", // 'sampler' | 'texture' | 'blend' | 'palette'
        dotShape: "rounded", // 'rounded' | 'circle' | 'square' | 'squircle'
        dotScale: 0.9,
        bgStyle: "white", // 'white' | 'dark' | 'cream' | 'transparent'
        contrastBoost: 35, // 0 to 80
        vibrancy: 20, // -50 to 50
        eyeStyle: "rounded", // 'rounded' | 'square' | 'circle'
        eyeColorMode: "image-accent", // 'image-accent' | 'sampled' | 'contrast'
        centerLogo: true,
        logoType: "auto", // 'auto' (image avatar) | 'linkedin' | 'github' | 'none'
        customLogo: null,
        eccLevel: "H", // L, M, Q, H
        outputSize: 800,
        showUnderImage: true,
        showQrCaption: true,
        qrCaption: "Scan me ✨"
    };

    // DOM Elements
    const elements = {
        urlInput: document.getElementById("urlInput"),
        quickLinks: document.querySelectorAll(".quick-link-btn"),
        fileInput: document.getElementById("fileInput"),
        customLogoInput: document.getElementById("customLogoInput"),
        dropZone: document.getElementById("dropZone"),
        uploadPreview: document.getElementById("uploadPreview"),
        samplePicker: document.getElementById("samplePicker"),
        renderModeInputs: document.querySelectorAll("input[name='renderMode']"),
        dotShapeInputs: document.querySelectorAll("input[name='dotShape']"),
        bgStyleInputs: document.querySelectorAll("input[name='bgStyle']"),
        dotScaleSlider: document.getElementById("dotScale"),
        dotScaleVal: document.getElementById("dotScaleVal"),
        contrastSlider: document.getElementById("contrastBoost"),
        contrastVal: document.getElementById("contrastVal"),
        vibrancySlider: document.getElementById("vibrancy"),
        vibrancyVal: document.getElementById("vibrancyVal"),
        eyeStyleSelect: document.getElementById("eyeStyle"),
        eyeColorSelect: document.getElementById("eyeColorMode"),
        centerLogoCheck: document.getElementById("centerLogoCheck"),
        logoTypeSelect: document.getElementById("logoType"),
        qrCanvas: document.getElementById("qrCanvas"),
        scannabilityBadge: document.getElementById("scannabilityBadge"),
        contrastRatioText: document.getElementById("contrastRatioText"),
        qrVersionText: document.getElementById("qrVersionText"),
        qrModulesText: document.getElementById("qrModulesText"),
        downloadPngBtn: document.getElementById("downloadPngBtn"),
        downloadSvgBtn: document.getElementById("downloadSvgBtn"),
        copyClipboardBtn: document.getElementById("copyClipboardBtn"),
        resolutionSelect: document.getElementById("resolutionSelect"),
        greetingText: document.getElementById("greetingText"),
        dateTimeText: document.getElementById("dateTimeText"),
        showUnderImage: document.getElementById("showUnderImage"),
        showQrCaption: document.getElementById("showQrCaption"),
        qrUnderImage: document.getElementById("qrUnderImage"),
        underQrImage: document.getElementById("underQrImage"),
        underQrCaption: document.getElementById("underQrCaption"),
        qrCaptionInput: document.getElementById("qrCaptionInput")
    };

    // Cached QR Code Model and Offscreen Canvases
    let currentQr = null;
    let dominantColors = [];
    const offscreenImgCanvas = document.createElement("canvas");
    const offscreenImgCtx = offscreenImgCanvas.getContext("2d");

    /**
     * Color Utility Functions
     */
    function rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0; // achromatic
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return [h * 360, s * 100, l * 100];
    }

    function hslToRgb(h, s, l) {
        h = ((h % 360) + 360) % 360 / 360;
        s = Math.max(0, Math.min(100, s)) / 100;
        l = Math.max(0, Math.min(100, l)) / 100;

        let r, g, b;
        if (s === 0) {
            r = g = b = l; // achromatic
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }
        return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    }

    function rgbToHex(r, g, b) {
        return "#" + [r, g, b].map(x => x.toString(16).padStart(2, "0")).join("");
    }

    function getLuminance(r, g, b) {
        return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    }

    /**
     * Extract dominant colors from image
     */
    function extractDominantColors(img, count = 5) {
        const w = 64, h = 64;
        offscreenImgCanvas.width = w;
        offscreenImgCanvas.height = h;
        offscreenImgCtx.drawImage(img, 0, 0, w, h);
        const data = offscreenImgCtx.getImageData(0, 0, w, h).data;

        const colorMap = [];
        for (let i = 0; i < data.length; i += 16) {
            const r = data[i], g = data[i+1], b = data[i+2];
            const [hVal, sVal, lVal] = rgbToHsl(r, g, b);
            if (sVal > 15 && lVal > 15 && lVal < 85) {
                colorMap.push({ r, g, b, h: hVal, s: sVal, l: lVal });
            }
        }
        if (colorMap.length === 0) {
            return [{ r: 40, g: 80, b: 200, hex: "#2850c8" }, { r: 200, g: 40, b: 120, hex: "#c82878" }];
        }
        // Sort by saturation & return diverse hues
        colorMap.sort((a, b) => b.s - a.s);
        const results = [];
        for (const c of colorMap) {
            if (results.length >= count) break;
            const isDistinct = results.every(res => Math.abs(res.h - c.h) > 30 || Math.abs(res.l - c.l) > 35);
            if (isDistinct || results.length === 0) {
                results.push({ ...c, hex: rgbToHex(c.r, c.g, c.b) });
            }
        }
        return results.length > 0 ? results : [{ r: 30, g: 30, b: 80, hex: "#1e1e50" }];
    }

    /**
     * Check if a module is part of the 3 corner finder patterns
     */
    function getFinderPattern(x, y, size) {
        // Top-left
        if (x < 7 && y < 7) return { pattern: "tl", rx: x, ry: y };
        // Top-right
        if (x >= size - 7 && y < 7) return { pattern: "tr", rx: x - (size - 7), ry: y };
        // Bottom-left
        if (x < 7 && y >= size - 7) return { pattern: "bl", rx: x, ry: y - (size - 7) };
        return null;
    }

    /**
     * Check if a cell is in the separator quiet border around finder patterns
     */
    function isFinderSeparator(x, y, size) {
        if (x <= 7 && y <= 7) return true;
        if (x >= size - 8 && y <= 7) return true;
        if (x <= 7 && y >= size - 8) return true;
        return false;
    }

    /**
     * Check if module is in center logo zone (approx center 22% of QR)
     */
    function isCenterLogoArea(x, y, size) {
        if (!state.centerLogo || state.logoType === "none") return false;
        const center = Math.floor(size / 2);
        const radius = Math.floor(size * 0.13); // around 26% diameter
        return Math.abs(x - center) <= radius && Math.abs(y - center) <= radius;
    }

    /**
     * Load image from URL / DataURI
     */
    function loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(img);
            img.onerror = (e) => reject(e);
            img.src = src;
        });
    }
    /**
 * Load image from URL / DataURI
 */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (src.startsWith("http")) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

    /**
     * Process Sample Image
     */
    async function loadSample(sampleId) {
        state.sampleId = sampleId;
        const dataUrl = getSampleImageDataUrl(sampleId);
        const img = await loadImage(dataUrl);
        state.image = img;
        dominantColors = extractDominantColors(img, 4);
        updateUnderQrImage();
        render();
    }

    function updateWelcomeClock() {
        const now = new Date();
        const hour = now.getHours();
        const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : hour < 21 ? "Good evening" : "Hello, night owl";
        if (elements.greetingText) elements.greetingText.textContent = `${greeting} ✨`;
        if (elements.dateTimeText) elements.dateTimeText.textContent = now.toLocaleString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    }

    function updateUnderQrImage() {
        if (!elements.qrUnderImage || !elements.underQrImage) return;
        const visible = state.showUnderImage && !!state.image;
        elements.qrUnderImage.hidden = !visible;
        if (visible) {
            elements.underQrImage.src = state.image.src;
            elements.underQrCaption.textContent = state.qrCaption || "Scan me ✨";
            elements.underQrCaption.hidden = !state.showQrCaption;
        }
    }

    /**
     * Initialize Sample Picker UI
     */
    function initSamplePicker() {
        elements.samplePicker.innerHTML = "";
        SampleImages.forEach(sample => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = `sample-thumb ${sample.id === state.sampleId ? "active" : ""}`;
            btn.title = `${sample.name}: ${sample.desc}`;
            btn.innerHTML = `
                <div class="thumb-img-wrapper"></div>
                <span class="thumb-title">${sample.name}</span>
            `;
            const wrapper = btn.querySelector(".thumb-img-wrapper");
            renderSampleThumbnail(sample.id, wrapper);

            btn.addEventListener("click", () => {
                document.querySelectorAll(".sample-thumb").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                state.imageSourceType = "sample";
                loadSample(sample.id);
            });
            elements.samplePicker.appendChild(btn);
        });
    }

    /**
     * Sample Color for a specific module from the uploaded image
     */
    function sampleColorFromImage(imgData, imgW, imgH, modX, modY, modCount) {
        // Map module coordinate to image pixel coordinate
        const cx = Math.floor(((modX + 0.5) / modCount) * imgW);
        const cy = Math.floor(((modY + 0.5) / modCount) * imgH);
        const step = Math.max(1, Math.floor((1 / modCount) * imgW / 3));

        let totalR = 0, totalG = 0, totalB = 0, count = 0;
        for (let dy = -step; dy <= step; dy += Math.max(1, Math.floor(step / 2))) {
            for (let dx = -step; dx <= step; dx += Math.max(1, Math.floor(step / 2))) {
                const px = Math.min(imgW - 1, Math.max(0, cx + dx));
                const py = Math.min(imgH - 1, Math.max(0, cy + dy));
                const idx = (py * imgW + px) * 4;
                totalR += imgData[idx];
                totalG += imgData[idx + 1];
                totalB += imgData[idx + 2];
                count++;
            }
        }
        if (count === 0) return { r: 30, g: 30, b: 30, hex: "#1e1e1e" };
        const rawR = Math.round(totalR / count);
        const rawG = Math.round(totalG / count);
        const rawB = Math.round(totalB / count);

        // Adjust contrast based on background style
        let [h, s, l] = rgbToHsl(rawR, rawG, rawB);
        s = Math.min(100, Math.max(0, s + state.vibrancy));

        const isLightBg = state.bgStyle === "white" || state.bgStyle === "cream";
        const boost = state.contrastBoost / 100; // 0.0 to 0.8

        if (isLightBg) {
            // Dark modules need low luminance to be scannable on white
            // Target luminance <= 35-40%
            const maxL = 45 * (1 - boost * 0.7);
            if (l > maxL) {
                l = maxL - (l - maxL) * 0.3;
            }
            l = Math.max(8, l * (1 - boost * 0.6));
        } else {
            // Dark background: Light modules need high luminance
            const minL = 55 + boost * 35;
            if (l < minL) {
                l = minL + (minL - l) * 0.3;
            }
            l = Math.min(95, l);
        }

        const [adjR, adjG, adjB] = hslToRgb(h, s, l);
        return {
            r: adjR,
            g: adjG,
            b: adjB,
            hex: rgbToHex(adjR, adjG, adjB),
            rawR, rawG, rawB
        };
    }

    /**
     * Draw shape helper
     */
    function drawModuleShape(ctx, x, y, size, shape, scale) {
        const offset = (size * (1 - scale)) / 2;
        const drawX = x + offset;
        const drawY = y + offset;
        const drawSize = size * scale;

        ctx.beginPath();
        switch (shape) {
            case "circle": {
                const r = drawSize / 2;
                ctx.arc(drawX + r, drawY + r, r, 0, Math.PI * 2);
                break;
            }
            case "rounded": {
                const radius = Math.min(drawSize / 2.8, 8);
                if (ctx.roundRect) {
                    ctx.roundRect(drawX, drawY, drawSize, drawSize, radius);
                } else {
                    ctx.arc(drawX + drawSize/2, drawY + drawSize/2, drawSize/2, 0, Math.PI * 2);
                }
                break;
            }
            case "squircle": {
                const radius = drawSize * 0.42;
                if (ctx.roundRect) {
                    ctx.roundRect(drawX, drawY, drawSize, drawSize, radius);
                } else {
                    ctx.arc(drawX + drawSize/2, drawY + drawSize/2, drawSize/2, 0, Math.PI * 2);
                }
                break;
            }
            case "diamond": {
                const cx = drawX + drawSize / 2;
                const cy = drawY + drawSize / 2;
                ctx.moveTo(cx, drawY);
                ctx.lineTo(drawX + drawSize, cy);
                ctx.lineTo(cx, drawY + drawSize);
                ctx.lineTo(drawX, cy);
                ctx.closePath();
                break;
            }
            case "square":
            default: {
                ctx.rect(drawX, drawY, drawSize, drawSize);
                break;
            }
        }
        ctx.fill();
    }

    /**
     * Draw Finder Pattern (Corner Eyes)
     */
    function drawFinderEye(ctx, originX, originY, cellSize, shape, outerColor, innerColor, bgColor) {
        const fullSize = cellSize * 7;
        const cx = originX + fullSize / 2;
        const cy = originY + fullSize / 2;

        // Background under eye
        ctx.fillStyle = bgColor;
        ctx.fillRect(originX, originY, fullSize, fullSize);

        // Outer 7x7 ring
        ctx.fillStyle = outerColor;
        ctx.beginPath();
        if (shape === "circle") {
            ctx.arc(cx, cy, fullSize / 2, 0, Math.PI * 2);
            ctx.fill();
            // Inner hollow 5x5
            ctx.fillStyle = bgColor;
            ctx.beginPath();
            ctx.arc(cx, cy, (cellSize * 5) / 2, 0, Math.PI * 2);
            ctx.fill();
        } else if (shape === "rounded") {
            const radOuter = cellSize * 2.2;
            const radInner = cellSize * 1.4;
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(originX, originY, fullSize, fullSize, radOuter);
            } else {
                ctx.rect(originX, originY, fullSize, fullSize);
            }
            ctx.fill();

            // Inner hollow 5x5
            ctx.fillStyle = bgColor;
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(originX + cellSize, originY + cellSize, cellSize * 5, cellSize * 5, radInner);
            } else {
                ctx.rect(originX + cellSize, originY + cellSize, cellSize * 5, cellSize * 5);
            }
            ctx.fill();
        } else {
            // Square
            ctx.fillRect(originX, originY, fullSize, fullSize);
            ctx.fillStyle = bgColor;
            ctx.fillRect(originX + cellSize, originY + cellSize, cellSize * 5, cellSize * 5);
        }

        // Center 3x3 pupil
        ctx.fillStyle = innerColor;
        const pupilOriginX = originX + cellSize * 2;
        const pupilOriginY = originY + cellSize * 2;
        const pupilSize = cellSize * 3;

        ctx.beginPath();
        if (shape === "circle") {
            ctx.arc(cx, cy, pupilSize / 2, 0, Math.PI * 2);
        } else if (shape === "rounded") {
            const radPupil = cellSize * 1.0;
            if (ctx.roundRect) {
                ctx.roundRect(pupilOriginX, pupilOriginY, pupilSize, pupilSize, radPupil);
            } else {
                ctx.arc(cx, cy, pupilSize / 2, 0, Math.PI * 2);
            }
        } else {
            ctx.rect(pupilOriginX, pupilOriginY, pupilSize, pupilSize);
        }
        ctx.fill();
    }

    /**
     * Draw Center Logo / Avatar Badge
     */
    function drawCenterBadge(ctx, center, radius, bgColor, accentColor) {
        if (!state.centerLogo || state.logoType === "none") return;

        ctx.save();
        // Outer protective ring
        ctx.shadowColor = "rgba(0,0,0,0.25)";
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 4;

        ctx.fillStyle = bgColor;
        ctx.beginPath();
        ctx.arc(center, center, radius + 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowColor = "transparent";
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 3;
        ctx.stroke();

        // Inner clipping for image/logo
        ctx.beginPath();
        ctx.arc(center, center, radius, 0, Math.PI * 2);
        ctx.clip();

        if (state.logoType === "linkedin") {
            // LinkedIn branding
            ctx.fillStyle = "#0a66c2";
            ctx.fillRect(center - radius, center - radius, radius * 2, radius * 2);
            ctx.fillStyle = "#ffffff";
            ctx.font = `bold ${Math.round(radius * 1.2)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("in", center, center + radius * 0.05);
        } else if (state.logoType === "github") {
            ctx.fillStyle = "#181717";
            ctx.fillRect(center - radius, center - radius, radius * 2, radius * 2);
            ctx.fillStyle = "#ffffff";
            ctx.font = `bold ${Math.round(radius * 0.75)}px sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("GH", center, center);
        } else if (state.logoType === "instagram") {
            const g = ctx.createLinearGradient(center-radius, center+radius, center+radius, center-radius);
            g.addColorStop(0, "#feda75"); g.addColorStop(0.5, "#d62976"); g.addColorStop(1, "#4f5bd5");
            ctx.fillStyle = g; ctx.fillRect(center-radius, center-radius, radius*2, radius*2);
            ctx.strokeStyle = "#fff"; ctx.lineWidth = Math.max(3, radius*0.12);
            ctx.beginPath(); ctx.roundRect(center-radius*0.55, center-radius*0.55, radius*1.1, radius*1.1, radius*0.28); ctx.stroke();
            ctx.beginPath(); ctx.arc(center, center, radius*0.25, 0, Math.PI*2); ctx.stroke();
            ctx.beginPath(); ctx.arc(center+radius*0.32, center-radius*0.32, radius*0.07, 0, Math.PI*2); ctx.fillStyle="#fff"; ctx.fill();
        } else if (state.logoType === "x") {
            ctx.fillStyle = "#000000"; ctx.fillRect(center-radius, center-radius, radius*2, radius*2);
            ctx.fillStyle = "#ffffff"; ctx.font = `bold ${Math.round(radius*1.05)}px sans-serif`; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText("X", center, center);
        } else if (state.logoType === "custom" && state.customLogoImage) {
      ctx.drawImage(state.customLogoImage, center - radius, center - radius, radius * 2, radius * 2);
        } else if (state.image) {
            // Draw thumbnail of the uploaded/sample image!
            ctx.drawImage(state.image, center - radius, center - radius, radius * 2, radius * 2);
        }
        ctx.restore();
    }

    /**
     * Compute Background Color
     */
    function getBackgroundColor() {
        switch (state.bgStyle) {
            case "dark": return "#0f1117";
            case "cream": return "#fbf9f5";
            case "transparent": return "rgba(255,255,255,0)";
            case "white":
            default:
                return "#ffffff";
        }
    }

    /**
     * Main Render Function
     */
    function render(targetCanvas, renderWidth) {
        const canvas = targetCanvas || elements.qrCanvas;
        const width = renderWidth || state.outputSize;
        canvas.width = width;
        canvas.height = width;
        const ctx = canvas.getContext("2d");

        const text = state.url.trim() || "https://linkedin.com";

        // Generate QR code matrix with High Error Correction
        try {
            currentQr = QrEngine.QrCode.encodeText(text, QrEngine.Ecc.HIGH);
        } catch (e) {
            console.error("QR Code Generation failed:", e);
            return;
        }

        const size = currentQr.size;
        const marginModules = 3;
        const totalModules = size + marginModules * 2;
        const cellSize = width / totalModules;
        const marginPx = marginModules * cellSize;

        // Background color
        const bgColor = getBackgroundColor();
        ctx.clearRect(0, 0, width, width);
        if (state.bgStyle !== "transparent") {
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, width, width);
        }

        if (!state.image) return;

        // Draw image onto offscreen canvas for fast pixel sampling
        const imgW = state.image.naturalWidth || state.image.width || 600;
        const imgH = state.image.naturalHeight || state.image.height || 600;
        offscreenImgCanvas.width = imgW;
        offscreenImgCanvas.height = imgH;
        offscreenImgCtx.drawImage(state.image, 0, 0, imgW, imgH);
        const imgData = offscreenImgCtx.getImageData(0, 0, imgW, imgH).data;

        // Determine Eye Colors
        const primaryAccent = dominantColors.length > 0 ? dominantColors[0].hex : "#2563eb";
        let eyeOuterColor = primaryAccent;
        let eyeInnerColor = dominantColors.length > 1 ? dominantColors[1].hex : primaryAccent;

        const isLightBg = state.bgStyle === "white" || state.bgStyle === "cream";
        if (state.eyeColorMode === "contrast") {
            eyeOuterColor = isLightBg ? "#0f172a" : "#f8fafc";
            eyeInnerColor = eyeOuterColor;
        } else if (state.eyeColorMode === "image-accent") {
            eyeOuterColor = primaryAccent;
            eyeInnerColor = dominantColors.length > 1 ? dominantColors[1].hex : primaryAccent;
        }

        // Total contrast accumulator for Scannability score
        let totalSampledLum = 0;
        let moduleCount = 0;

        // MODE: TEXTURE MASK
        if (state.renderMode === "texture") {
            // 1. Build clip path for all QR modules
            ctx.save();
            ctx.beginPath();
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    if (getFinderPattern(x, y, size)) continue;
                    if (isCenterLogoArea(x, y, size)) continue;
                    if (currentQr.getModule(x, y)) {
                        const px = marginPx + x * cellSize;
                        const py = marginPx + y * cellSize;
                        const offset = (cellSize * (1 - state.dotScale)) / 2;
                        const dSize = cellSize * state.dotScale;
                        const rad = state.dotShape === "circle" ? dSize / 2 : (state.dotShape === "rounded" ? dSize / 3 : 0);
                        if (rad > 0 && ctx.roundRect) {
                            ctx.roundRect(px + offset, py + offset, dSize, dSize, rad);
                        } else {
                            ctx.rect(px + offset, py + offset, dSize, dSize);
                        }
                    }
                }
            }
            ctx.clip();

            // 2. Draw uploaded image inside the clipped QR shape
            ctx.drawImage(state.image, marginPx, marginPx, size * cellSize, size * cellSize);

            // 3. Contrast overlay inside the texture if needed
            if (state.contrastBoost > 0) {
                ctx.fillStyle = isLightBg
                    ? `rgba(0, 0, 0, ${state.contrastBoost / 130})`
                    : `rgba(255, 255, 255, ${state.contrastBoost / 140})`;
                ctx.fillRect(marginPx, marginPx, size * cellSize, size * cellSize);
            }
            ctx.restore();
        }
        // MODE: ARTISTIC BLEND
        else if (state.renderMode === "blend") {
            // Draw background image with slight translucency
            ctx.save();
            ctx.globalAlpha = isLightBg ? 0.25 : 0.35;
            ctx.drawImage(state.image, 0, 0, width, width);
            ctx.restore();

            // Draw modules with high contrast sampled colors
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    if (getFinderPattern(x, y, size)) continue;
                    if (isCenterLogoArea(x, y, size)) continue;
                    if (currentQr.getModule(x, y)) {
                        const sample = sampleColorFromImage(imgData, imgW, imgH, x, y, size);
                        ctx.fillStyle = sample.hex;
                        const px = marginPx + x * cellSize;
                        const py = marginPx + y * cellSize;
                        drawModuleShape(ctx, px, py, cellSize, state.dotShape, state.dotScale);
                        totalSampledLum += getLuminance(sample.r, sample.g, sample.b);
                        moduleCount++;
                    }
                }
            }
        }
        // MODE: PALETTE GRADIENT
        else if (state.renderMode === "palette") {
            const grad = ctx.createLinearGradient(marginPx, marginPx, width - marginPx, width - marginPx);
            if (dominantColors.length >= 2) {
                dominantColors.forEach((c, idx) => {
                    grad.addColorStop(idx / (dominantColors.length - 1), c.hex);
                });
            } else {
                grad.addColorStop(0, primaryAccent);
                grad.addColorStop(1, "#9333ea");
            }
            ctx.fillStyle = grad;

            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    if (getFinderPattern(x, y, size)) continue;
                    if (isCenterLogoArea(x, y, size)) continue;
                    if (currentQr.getModule(x, y)) {
                        const px = marginPx + x * cellSize;
                        const py = marginPx + y * cellSize;
                        drawModuleShape(ctx, px, py, cellSize, state.dotShape, state.dotScale);
                        moduleCount++;
                    }
                }
            }
        }
        // MODE: DIRECT PIXEL SAMPLER (Default & Primary User Request)
        else {
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    if (getFinderPattern(x, y, size)) continue;
                    if (isCenterLogoArea(x, y, size)) continue;
                    if (currentQr.getModule(x, y)) {
                        const sample = sampleColorFromImage(imgData, imgW, imgH, x, y, size);
                        ctx.fillStyle = sample.hex;
                        const px = marginPx + x * cellSize;
                        const py = marginPx + y * cellSize;
                        drawModuleShape(ctx, px, py, cellSize, state.dotShape, state.dotScale);
                        totalSampledLum += getLuminance(sample.r, sample.g, sample.b);
                        moduleCount++;
                    }
                }
            }
        }

        // Draw Finder Patterns (Corner Eyes)
        const eyeBgColor = state.bgStyle === "transparent" ? "#ffffff" : bgColor;
        // Top-left
        drawFinderEye(ctx, marginPx, marginPx, cellSize, state.eyeStyle, eyeOuterColor, eyeInnerColor, eyeBgColor);
        // Top-right
        drawFinderEye(ctx, marginPx + (size - 7) * cellSize, marginPx, cellSize, state.eyeStyle, eyeOuterColor, eyeInnerColor, eyeBgColor);
        // Bottom-left
        drawFinderEye(ctx, marginPx, marginPx + (size - 7) * cellSize, cellSize, state.eyeStyle, eyeOuterColor, eyeInnerColor, eyeBgColor);

        // Draw Center Logo / Avatar Badge
        if (state.centerLogo && state.logoType !== "none") {
            const center = width / 2;
            const logoRadius = (size * 0.12) * cellSize;
            drawCenterBadge(ctx, center, logoRadius, eyeBgColor, primaryAccent);
        }

        // Update Live Status & Scannability Metrics
        updateScannabilityMetrics(moduleCount > 0 ? totalSampledLum / moduleCount : 0.25, isLightBg);
        updateUnderQrImage();
    }

    /**
     * Compute and display live scannability indicator
     */
    function updateScannabilityMetrics(avgModuleLum, isLightBg) {
        if (!elements.scannabilityBadge || !elements.contrastRatioText) return;

        const bgLum = isLightBg ? 1.0 : 0.05;
        const l1 = Math.max(bgLum, avgModuleLum);
        const l2 = Math.min(bgLum, avgModuleLum);
        const contrastRatio = ((l1 + 0.05) / (l2 + 0.05)).toFixed(1);

        elements.contrastRatioText.textContent = `${contrastRatio}:1`;
        if (currentQr) {
            elements.qrVersionText.textContent = `v${currentQr.version}`;
            elements.qrModulesText.textContent = `${currentQr.size}x${currentQr.size}`;
        }

        const badge = elements.scannabilityBadge;
        badge.className = "scannability-badge";

        if (contrastRatio >= 4.5) {
            badge.classList.add("scan-excellent");
            badge.innerHTML = `<span class="scan-dot"></span> Excellent (100% Scannable)`;
        } else if (contrastRatio >= 3.0) {
            badge.classList.add("scan-good");
            badge.innerHTML = `<span class="scan-dot"></span> Good Scannability`;
        } else {
            badge.classList.add("scan-warning");
            badge.innerHTML = `<span class="scan-dot"></span> Low Contrast (Increase Slider)`;
        }
    }

    /**
     * Generate pure Vector SVG format for download
     */
    function generateSvgString() {
        if (!currentQr) return "";
        const size = currentQr.size;
        const marginModules = 3;
        const totalModules = size + marginModules * 2;
        const viewBoxSize = 1000;
        const cellSize = viewBoxSize / totalModules;
        const marginPx = marginModules * cellSize;
        const bgColor = getBackgroundColor();

        // Sample colors from offscreen canvas
        const imgW = offscreenImgCanvas.width || 600;
        const imgH = offscreenImgCanvas.height || 600;
        const imgData = offscreenImgCtx.getImageData(0, 0, imgW, imgH).data;

        let svgModules = "";
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                if (getFinderPattern(x, y, size)) continue;
                if (isCenterLogoArea(x, y, size)) continue;
                if (currentQr.getModule(x, y)) {
                    const sample = sampleColorFromImage(imgData, imgW, imgH, x, y, size);
                    const px = marginPx + x * cellSize;
                    const py = marginPx + y * cellSize;
                    const offset = (cellSize * (1 - state.dotScale)) / 2;
                    const dSize = cellSize * state.dotScale;
                    const rad = state.dotShape === "circle" ? dSize / 2 : (state.dotShape === "rounded" ? dSize / 3 : 0);
                    svgModules += `<rect x="${px + offset}" y="${py + offset}" width="${dSize}" height="${dSize}" rx="${rad}" fill="${sample.hex}"/>\n`;
                }
            }
        }

        const primaryAccent = dominantColors[0] ? dominantColors[0].hex : "#2563eb";
        const eyeColor = state.eyeColorMode === "contrast"
            ? (state.bgStyle === "white" ? "#0f172a" : "#f8fafc")
            : primaryAccent;

        // SVG string
        return `<?xml version="1.0" encoding="utf-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBoxSize} ${viewBoxSize}" width="100%" height="100%">
    <rect width="${viewBoxSize}" height="${viewBoxSize}" fill="${bgColor}"/>
    <g id="qr-modules">
        ${svgModules}
    </g>
    <!-- Top-Left Finder -->
    <rect x="${marginPx}" y="${marginPx}" width="${cellSize * 7}" height="${cellSize * 7}" rx="${cellSize * 1.5}" fill="${eyeColor}"/>
    <rect x="${marginPx + cellSize}" y="${marginPx + cellSize}" width="${cellSize * 5}" height="${cellSize * 5}" rx="${cellSize}" fill="${bgColor}"/>
    <rect x="${marginPx + cellSize * 2}" y="${marginPx + cellSize * 2}" width="${cellSize * 3}" height="${cellSize * 3}" rx="${cellSize * 0.7}" fill="${eyeColor}"/>
    <!-- Top-Right Finder -->
    <rect x="${marginPx + (size - 7) * cellSize}" y="${marginPx}" width="${cellSize * 7}" height="${cellSize * 7}" rx="${cellSize * 1.5}" fill="${eyeColor}"/>
    <rect x="${marginPx + (size - 6) * cellSize}" y="${marginPx + cellSize}" width="${cellSize * 5}" height="${cellSize * 5}" rx="${cellSize}" fill="${bgColor}"/>
    <rect x="${marginPx + (size - 5) * cellSize}" y="${marginPx + cellSize * 2}" width="${cellSize * 3}" height="${cellSize * 3}" rx="${cellSize * 0.7}" fill="${eyeColor}"/>
    <!-- Bottom-Left Finder -->
    <rect x="${marginPx}" y="${marginPx + (size - 7) * cellSize}" width="${cellSize * 7}" height="${cellSize * 7}" rx="${cellSize * 1.5}" fill="${eyeColor}"/>
    <rect x="${marginPx + cellSize}" y="${marginPx + (size - 6) * cellSize}" width="${cellSize * 5}" height="${cellSize * 5}" rx="${cellSize}" fill="${bgColor}"/>
    <rect x="${marginPx + cellSize * 2}" y="${marginPx + (size - 5) * cellSize}" width="${cellSize * 3}" height="${cellSize * 3}" rx="${cellSize * 0.7}" fill="${eyeColor}"/>
</svg>`;
    }

    /**
     * Download File Helpers
     */
    // function downloadBlob(blob, filename) {
    //     const link = document.createElement("a");
    //     link.href = URL.createObjectURL(blob);
    //     link.download = filename;
    //     document.body.appendChild(link);
    //     link.click();
    //     document.body.removeChild(link);
    //     URL.revokeObjectURL(link.href);
    // }









    function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 1000);
}










    function exportHighResPng() {
        const targetRes = parseInt(elements.resolutionSelect.value, 10) || 1024;
        const qrCanvas = document.createElement("canvas");
        render(qrCanvas, targetRes);
        const includeImage = state.showUnderImage && !!state.image;
        const includeCaption = includeImage && state.showQrCaption && !!state.qrCaption;
        const footerHeight = includeImage ? Math.round(targetRes * (includeCaption ? 0.19 : 0.15)) : 0;
        const exportCanvas = document.createElement("canvas");
        exportCanvas.width = targetRes;
        exportCanvas.height = targetRes + footerHeight;
        const out = exportCanvas.getContext("2d");
        out.fillStyle = getBackgroundColor();
        out.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
        out.drawImage(qrCanvas, 0, 0);
        if (includeImage) {
            const imageSize = Math.round(targetRes * 0.105);
            const imageY = targetRes + Math.round(targetRes * 0.018);
            out.save();
            out.beginPath();
            out.roundRect((targetRes-imageSize)/2, imageY, imageSize, imageSize, Math.round(imageSize*0.2));
            out.clip();
            out.drawImage(state.image, (targetRes-imageSize)/2, imageY, imageSize, imageSize);
            out.restore();
            if (includeCaption) {
                out.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--text-primary").trim() || "#ffffff";
                out.textAlign = "center";
                out.textBaseline = "middle";
                out.font = `600 ${Math.round(targetRes*0.025)}px sans-serif`;
                out.fillText(state.qrCaption.slice(0, 48), targetRes/2, targetRes + imageSize + Math.round(targetRes*0.055));
            }
        }
        exportCanvas.toBlob(blob => {
            if (blob) downloadBlob(blob, `chromaqr-${Date.now()}.png`);
        }, "image/png");
    }

    function exportSvg() {
        const svgStr = generateSvgString();
        const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
        downloadBlob(blob, `colored-qr-${Date.now()}.svg`);
    }

    async function copyToClipboard() {
        const exportCanvas = document.createElement("canvas");
        render(exportCanvas, 1024);
        exportCanvas.toBlob(async blob => {
            if (!blob) return;
            try {
                await navigator.clipboard.write([
                    new ClipboardItem({ "image/png": blob })
                ]);
                const originalText = elements.copyClipboardBtn.innerHTML;
                elements.copyClipboardBtn.innerHTML = `✓ Copied Image!`;
                elements.copyClipboardBtn.classList.add("btn-copied");
                setTimeout(() => {
                    elements.copyClipboardBtn.innerHTML = originalText;
                    elements.copyClipboardBtn.classList.remove("btn-copied");
                }, 2000);
            } catch (err) {
                console.error("Clipboard copy failed:", err);
                alert("Clipboard copy requires user permission or HTTPS. Please use 'Download PNG'.");
            }
        });
    }

    /**
     * Handle Image File Upload (File input or Drag & Drop)
     */
    function handleFile(file) {
        if (!file || !file.type.startsWith("image/")) {
            alert("Please select a valid image file (PNG, JPG, WebP, SVG).");
            return;
        }
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const img = await loadImage(e.target.result);
                state.image = img;
                state.imageSourceType = "upload";
                dominantColors = extractDominantColors(img, 4);
                updateUnderQrImage();

                // Update UI preview
                elements.uploadPreview.innerHTML = `
                    <div class="user-img-card">
                        <img src="${e.target.result}" alt="Uploaded Preview" class="user-img-thumb"/>
                        <div class="user-img-meta">
                            <span class="user-img-name">${file.name}</span>
                            <span class="user-img-dim">${img.naturalWidth} x ${img.naturalHeight}px</span>
                        </div>
                    </div>
                `;
                document.querySelectorAll(".sample-thumb").forEach(b => b.classList.remove("active"));
                render();
            } catch (err) {
                console.error("Failed to load uploaded image:", err);
            }
        };
        reader.readAsDataURL(file);
    }

    /**
     * Bind Event Listeners
     */
    let eventsBound = false;
function bindEvents() {
  if (eventsBound) return;
  eventsBound = true;
  // URL text input
        // URL text input
        elements.urlInput?.addEventListener("input", (e) => {
            state.url = e.target.value;
            render();
        });

        // Quick Link preset chips
        elements.quickLinks.forEach(btn => {
            btn.addEventListener("click", () => {
                const url = btn.getAttribute("data-url");
                elements.urlInput.value = url;
                state.url = url;
                elements.quickLinks.forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                render();
            });
        });

        // File upload
        elements.fileInput.addEventListener("change", (e) => {
            if (e.target.files && e.target.files[0]) {
                handleFile(e.target.files[0]);
            }
        });

        // Drag & drop
        elements.dropZone.addEventListener("dragover", (e) => {
            e.preventDefault();
            elements.dropZone.classList.add("drag-over");
        });
        elements.dropZone.addEventListener("dragleave", () => {
            elements.dropZone.classList.remove("drag-over");
        });
        elements.dropZone.addEventListener("drop", (e) => {
            e.preventDefault();
            elements.dropZone.classList.remove("drag-over");
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFile(e.dataTransfer.files[0]);
            }
        });

        // Render Mode Radio buttons
        elements.renderModeInputs.forEach(input => {
            input.addEventListener("change", (e) => {
                state.renderMode = e.target.value;
                render();
            });
        });

        // Dot Shape Radio buttons
        elements.dotShapeInputs.forEach(input => {
            input.addEventListener("change", (e) => {
                state.dotShape = e.target.value;
                render();
            });
        });

        // Background Style Radio buttons
        elements.bgStyleInputs.forEach(input => {
            input.addEventListener("change", (e) => {
                state.bgStyle = e.target.value;
                render();
            });
        });

        // Dot Scale Slider
        elements.dotScaleSlider.addEventListener("input", (e) => {
            state.dotScale = parseFloat(e.target.value);
            elements.dotScaleVal.textContent = Math.round(state.dotScale * 100) + "%";
            render();
        });

        // Contrast Slider
        elements.contrastSlider.addEventListener("input", (e) => {
            state.contrastBoost = parseInt(e.target.value, 10);
            elements.contrastVal.textContent = state.contrastBoost + "%";
            render();
        });

        // Vibrancy Slider
        elements.vibrancySlider.addEventListener("input", (e) => {
            state.vibrancy = parseInt(e.target.value, 10);
            elements.vibrancyVal.textContent = (state.vibrancy > 0 ? "+" : "") + state.vibrancy + "%";
            render();
        });

        // Eye Style
        elements.eyeStyleSelect.addEventListener("change", (e) => {
            state.eyeStyle = e.target.value;
            render();
        });

        // Eye Color Mode
        elements.eyeColorSelect.addEventListener("change", (e) => {
            state.eyeColorMode = e.target.value;
            render();
        });

        // Center Logo Toggle
        elements.centerLogoCheck.addEventListener("change", (e) => {
            state.centerLogo = e.target.checked;
            elements.logoTypeSelect.disabled = !state.centerLogo;
            render();
        });

        // Logo Type Select
        // elements.logoTypeSelect.addEventListener("change", (e) => {
        //     state.logoType = e.target.value;
        //     render();
        // });

        let previousLogoType = state.logoType;

  elements.logoTypeSelect?.addEventListener("change", (e) => {
    if (e.target.value === "custom") {
      elements.customLogoInput?.click();
    } else {
      previousLogoType = e.target.value;
      state.logoType = e.target.value;
      renderQR(); // <-- Match your existing function name
    }
  });

  elements.customLogoInput?.addEventListener("change", (e) => {
    const file = e.target.files;
    if (!file) {
      elements.logoTypeSelect.value = previousLogoType;
      return;
    }
    const reader = new FileReader();
    reader.onload = async (event) => {
      state.customLogoImage = await loadImage(event.target.result);
      state.logoType = "custom";
      previousLogoType = "custom";
      state.centerLogo = true;
      elements.centerLogoCheck.checked = true;
      e.target.value = "";
      renderQR(); // <-- Match your existing function name
    };
    reader.readAsDataURL(file);
  });

        // Export Buttons
        elements.downloadPngBtn.addEventListener("click", exportHighResPng);
        elements.downloadSvgBtn.addEventListener("click", exportSvg);
        elements.copyClipboardBtn.addEventListener("click", copyToClipboard);
        if (elements.showUnderImage) elements.showUnderImage.addEventListener("change", e => { state.showUnderImage = e.target.checked; updateUnderQrImage(); });
        if (elements.showQrCaption) elements.showQrCaption.addEventListener("change", e => { state.showQrCaption = e.target.checked; updateUnderQrImage(); });
        if (elements.qrCaptionInput) elements.qrCaptionInput.addEventListener("input", e => { state.qrCaption = e.target.value; updateUnderQrImage(); });
        updateWelcomeClock();
        setInterval(updateWelcomeClock, 1000);
    }

    /**
     * Theme Manager
     */
    function initThemes() {
        const themePills = document.querySelectorAll(".theme-pill");
        if (!themePills || themePills.length === 0) return;
        const savedTheme = localStorage.getItem("chroma_theme") || "default";

        function applyTheme(themeId) {
            if (themeId === "default") {
                document.documentElement.removeAttribute("data-theme");
            } else {
                document.documentElement.setAttribute("data-theme", themeId);
            }
            themePills.forEach(pill => {
                if (pill.getAttribute("data-theme") === themeId) {
                    pill.classList.add("active");
                } else {
                    pill.classList.remove("active");
                }
            });
            localStorage.setItem("chroma_theme", themeId);
        }

        applyTheme(savedTheme);

        themePills.forEach(pill => {
            pill.addEventListener("click", () => {
                const theme = pill.getAttribute("data-theme");
                applyTheme(theme);
            });
        });
    }

    /**
     * Initialization
     */
    async function init() {
        initThemes();
        updateWelcomeClock();
        initSamplePicker();
        bindEvents();
        // Load default sample image
        await loadSample("cyber-neon");
    }

    // Run on DOM Ready
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
