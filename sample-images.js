/**
 * Built-in Sample Images for instant preview
 * Procedurally generated Canvas & SVG graphics (100% offline, cross-origin safe)
 */
const SampleImages = [
    {
        id: "cyber-neon",
        name: "Cyber Neon",
        desc: "Vibrant Cyan, Purple & Magenta",
        createCanvas: function(ctx, w, h) {
            const grad = ctx.createLinearGradient(0, 0, w, h);
            grad.addColorStop(0, "#00f2fe");
            grad.addColorStop(0.35, "#4facfe");
            grad.addColorStop(0.7, "#7000ff");
            grad.addColorStop(1, "#ff007f");
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);

            // Glowing spheres
            const rgrad1 = ctx.createRadialGradient(w * 0.7, h * 0.3, 10, w * 0.7, h * 0.3, w * 0.5);
            rgrad1.addColorStop(0, "rgba(0, 255, 204, 0.75)");
            rgrad1.addColorStop(0.7, "rgba(121, 40, 202, 0.2)");
            rgrad1.addColorStop(1, "rgba(15, 12, 27, 0.8)");
            ctx.fillStyle = rgrad1;
            ctx.fillRect(0, 0, w, h);

            ctx.fillStyle = "rgba(0, 242, 254, 0.4)";
            ctx.beginPath();
            ctx.arc(w * 0.3, h * 0.33, w * 0.2, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = "rgba(255, 0, 127, 0.45)";
            ctx.beginPath();
            ctx.arc(w * 0.7, h * 0.65, w * 0.22, 0, Math.PI * 2);
            ctx.fill();
        }
    },
    {
        id: "sunset-glow",
        name: "Sunset Glow",
        desc: "Warm Amber, Coral & Deep Indigo",
        createCanvas: function(ctx, w, h) {
            const grad = ctx.createLinearGradient(0, h, w, 0);
            grad.addColorStop(0, "#2c003e");
            grad.addColorStop(0.3, "#801336");
            grad.addColorStop(0.6, "#c72c41");
            grad.addColorStop(0.85, "#ee4540");
            grad.addColorStop(1, "#f8b500");
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);

            // Sun glow
            const rgrad = ctx.createRadialGradient(w * 0.75, h * 0.25, 20, w * 0.75, h * 0.25, w * 0.4);
            rgrad.addColorStop(0, "rgba(255, 230, 109, 0.85)");
            rgrad.addColorStop(0.5, "rgba(238, 69, 64, 0.4)");
            rgrad.addColorStop(1, "rgba(44, 0, 62, 0)");
            ctx.fillStyle = rgrad;
            ctx.beginPath();
            ctx.arc(w * 0.75, h * 0.25, w * 0.4, 0, Math.PI * 2);
            ctx.fill();
        }
    },
    {
        id: "emerald-forest",
        name: "Emerald Forest",
        desc: "Lush Teals, Jade & Lime",
        createCanvas: function(ctx, w, h) {
            const grad = ctx.createLinearGradient(0, 0, w, h);
            grad.addColorStop(0, "#0575e6");
            grad.addColorStop(0.35, "#00b4db");
            grad.addColorStop(0.7, "#00f260");
            grad.addColorStop(1, "#0575e6");
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);

            ctx.fillStyle = "rgba(0, 242, 96, 0.4)";
            ctx.beginPath();
            ctx.arc(w * 0.35, h * 0.65, w * 0.25, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = "rgba(0, 180, 219, 0.5)";
            ctx.beginPath();
            ctx.arc(w * 0.68, h * 0.32, w * 0.22, 0, Math.PI * 2);
            ctx.fill();
        }
    },
    {
        id: "cosmic-violet",
        name: "Cosmic Nebula",
        desc: "Deep Purple, Electric Blue & Pink",
        createCanvas: function(ctx, w, h) {
            const rgrad = ctx.createRadialGradient(w * 0.5, h * 0.5, 30, w * 0.5, h * 0.5, w * 0.6);
            rgrad.addColorStop(0, "#f72585");
            rgrad.addColorStop(0.45, "#7209b7");
            rgrad.addColorStop(0.75, "#3a0ca3");
            rgrad.addColorStop(1, "#4361ee");
            ctx.fillStyle = rgrad;
            ctx.fillRect(0, 0, w, h);

            ctx.fillStyle = "rgba(76, 201, 240, 0.55)";
            ctx.beginPath();
            ctx.arc(w * 0.28, h * 0.3, w * 0.16, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = "rgba(247, 37, 133, 0.45)";
            ctx.beginPath();
            ctx.arc(w * 0.72, h * 0.7, w * 0.19, 0, Math.PI * 2);
            ctx.fill();
        }
    }
];

function getSampleImageDataUrl(sampleId) {
    const sample = SampleImages.find(s => s.id === sampleId) || SampleImages[0];
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 600;
    const ctx = canvas.getContext("2d");
    sample.createCanvas(ctx, 600, 600);
    return canvas.toDataURL("image/png");
}

function renderSampleThumbnail(sampleId, container) {
    const sample = SampleImages.find(s => s.id === sampleId) || SampleImages[0];
    const canvas = document.createElement("canvas");
    canvas.width = 120;
    canvas.height = 120;
    const ctx = canvas.getContext("2d");
    sample.createCanvas(ctx, 120, 120);
    container.innerHTML = "";
    container.appendChild(canvas);
}
