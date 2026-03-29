import type { CanvasSettings, Layer } from "../types";
import { patternRegistry } from "../patterns";
import { downloadBlob } from "./svgExport";

function buildLayerSvgString(layer: Layer, canvas: CanvasSettings): string {
    const def = patternRegistry[layer.type];
    if (!def) return "";

    const elements = def.generate(layer.params, canvas.width, canvas.height);
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    let innerSvg = "";
    for (const el of elements) {
        const fill = el.attrs.fill === "currentColor"
            ? layer.strokeColor
            : (el.attrs.fill as string) || "none";
        const stroke = el.attrs.fill === "currentColor"
            ? "none"
            : layer.strokeColor;
        const sw = el.attrs.fill === "currentColor" ? 0 : layer.strokeWidth;

        switch (el.type) {
            case "circle":
                innerSvg +=
                    `<circle cx="${el.attrs.cx}" cy="${el.attrs.cy}" r="${el.attrs.r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />\n`;
                break;
            case "line":
                innerSvg +=
                    `<line x1="${el.attrs.x1}" y1="${el.attrs.y1}" x2="${el.attrs.x2}" y2="${el.attrs.y2}" stroke="${stroke}" stroke-width="${sw}" />\n`;
                break;
            case "path":
                innerSvg +=
                    `<path d="${el.attrs.d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />\n`;
                break;
            case "rect":
                innerSvg +=
                    `<rect x="${el.attrs.x}" y="${el.attrs.y}" width="${el.attrs.width}" height="${el.attrs.height}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />\n`;
                break;
        }
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}">
  <rect width="${canvas.width}" height="${canvas.height}" fill="${canvas.backgroundColor}" />
  <g opacity="${layer.opacity}" transform="translate(${layer.offsetX}, ${layer.offsetY}) rotate(${layer.rotation}, ${cx}, ${cy}) scale(${layer.scale})">
${innerSvg}  </g>
</svg>`;
}

function buildLayerPng(
    layer: Layer,
    canvas: CanvasSettings,
    scale: number,
): Promise<Blob | null> {
    return new Promise((resolve) => {
        const svgString = buildLayerSvgString(layer, canvas);
        const width = canvas.width * scale;
        const height = canvas.height * scale;

        const cvs = document.createElement("canvas");
        cvs.width = width;
        cvs.height = height;
        const ctx = cvs.getContext("2d");
        if (!ctx) {
            resolve(null);
            return;
        }

        const img = new Image();
        const blob = new Blob([svgString], {
            type: "image/svg+xml;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);

        img.onload = () => {
            ctx.drawImage(img, 0, 0, width, height);
            URL.revokeObjectURL(url);
            cvs.toBlob((b) => resolve(b), "image/png");
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(null);
        };
        img.src = url;
    });
}

export async function exportLayersSvg(layers: Layer[], canvas: CanvasSettings) {
    for (let i = 0; i < layers.length; i++) {
        const layer = layers[i];
        const svgString = buildLayerSvgString(layer, canvas);
        const blob = new Blob([svgString], {
            type: "image/svg+xml;charset=utf-8",
        });
        const safeName = layer.name.replace(/[^a-zA-Z0-9_-]/g, "_");
        downloadBlob(blob, `${safeName}_${i}.svg`);
        // Small delay between downloads to avoid browser throttling
        await new Promise((r) => setTimeout(r, 200));
    }
}

export async function exportLayersPng(
    layers: Layer[],
    canvas: CanvasSettings,
    scale: number = 2,
) {
    for (let i = 0; i < layers.length; i++) {
        const layer = layers[i];
        const blob = await buildLayerPng(layer, canvas, scale);
        if (blob) {
            const safeName = layer.name.replace(/[^a-zA-Z0-9_-]/g, "_");
            downloadBlob(blob, `${safeName}_${i}.png`);
            await new Promise((r) => setTimeout(r, 200));
        }
    }
}
