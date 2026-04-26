import * as THREE from "three";
import type { CanvasSettings, Layer, SvgElement } from "../../types";
import { patternRegistry } from "../../patterns";

// ─── SVG element serialiser ───────────────────────────────────────────────────

function attrsToString(attrs: Record<string, string | number>): string {
    return Object.entries(attrs)
        .map(([k, v]) => `${k}="${v}"`)
        .join(" ");
}

function serialiseElement(
    el: SvgElement,
    stroke: string,
    strokeWidth: number,
): string {
    const isColoured = el.attrs.fill === "currentColor";
    const fillAttr = isColoured ? stroke : (el.attrs.fill as string) || "none";
    const strokeAttr = isColoured ? "none" : stroke;
    const swAttr = isColoured ? 0 : strokeWidth;

    const base: Record<string, string | number> = {
        fill: fillAttr,
        stroke: strokeAttr,
        "stroke-width": swAttr,
    };

    switch (el.type) {
        case "circle":
            return `<circle cx="${el.attrs.cx}" cy="${el.attrs.cy}" r="${el.attrs.r}" ${
                attrsToString(base)
            } />`;
        case "line":
            return `<line x1="${el.attrs.x1}" y1="${el.attrs.y1}" x2="${el.attrs.x2}" y2="${el.attrs.y2}" ${
                attrsToString(base)
            } />`;
        case "path":
            return `<path d="${el.attrs.d}" fill="${
                (el.attrs.fill as string) || "none"
            }" ${
                attrsToString({ stroke: strokeAttr, "stroke-width": swAttr })
            } />`;
        case "rect":
            return `<rect x="${el.attrs.x}" y="${el.attrs.y}" width="${el.attrs.width}" height="${el.attrs.height}" ${
                attrsToString(base)
            } />`;
        default:
            return "";
    }
}

// ─── Build SVG string for a single layer (transparent background) ─────────────

export function buildLayerSvgString(
    layer: Layer,
    canvas: CanvasSettings,
): string {
    const { width, height } = canvas;
    const def = patternRegistry[layer.type];
    if (!def) return "";

    const elements: SvgElement[] = def.generate(layer.params, width, height);

    const cx = width / 2;
    const cy = height / 2;
    const transform =
        `translate(${layer.offsetX}, ${layer.offsetY}) rotate(${layer.rotation}, ${cx}, ${cy}) scale(${layer.scale})`;

    const elStrings = elements.map((el) =>
        serialiseElement(el, layer.strokeColor, layer.strokeWidth)
    ).join("\n    ");

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <g opacity="${layer.opacity}" transform="${transform}">
    ${elStrings}
  </g>
</svg>`;
}

// ─── Convert SVG string → THREE.CanvasTexture ─────────────────────────────────

export async function svgStringToCanvasTexture(
    svgString: string,
    width: number,
    height: number,
): Promise<THREE.CanvasTexture> {
    const blob = new Blob([svgString], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
                URL.revokeObjectURL(url);
                reject(new Error("Failed to get 2D context"));
                return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            URL.revokeObjectURL(url);
            const texture = new THREE.CanvasTexture(canvas);
            texture.needsUpdate = true;
            resolve(texture);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Failed to load SVG image"));
        };
        img.src = url;
    });
}
