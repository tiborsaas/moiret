import type { ParamDef, SvgElement } from "../types";

export const noiseFieldParamDefs: ParamDef[] = [
    {
        name: "resolution",
        label: "Grid Resolution",
        min: 20,
        max: 120,
        step: 5,
        defaultValue: 60,
    },
    {
        name: "threshold",
        label: "Contour Threshold",
        min: 0,
        max: 1,
        step: 0.05,
        defaultValue: 0.5,
    },
    {
        name: "noiseScale",
        label: "Noise Scale",
        min: 0.5,
        max: 10,
        step: 0.25,
        defaultValue: 3,
    },
    {
        name: "contourCount",
        label: "Contour Levels",
        min: 2,
        max: 20,
        step: 1,
        defaultValue: 8,
    },
    {
        name: "seed",
        label: "Seed",
        min: 0,
        max: 999,
        step: 1,
        defaultValue: 42,
    },
];

// Simple 2D noise implementation (value noise with smoothstep interpolation)
// No external dependency needed — gives organic, non-repeating fields

function hash(x: number, y: number, seed: number): number {
    let h = seed + x * 374761393 + y * 668265263;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = h ^ (h >>> 16);
    return (h & 0x7fffffff) / 0x7fffffff;
}

function smoothstep(t: number): number {
    return t * t * (3 - 2 * t);
}

function noise2d(x: number, y: number, seed: number): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const sx = smoothstep(fx);
    const sy = smoothstep(fy);

    const n00 = hash(ix, iy, seed);
    const n10 = hash(ix + 1, iy, seed);
    const n01 = hash(ix, iy + 1, seed);
    const n11 = hash(ix + 1, iy + 1, seed);

    const nx0 = n00 + sx * (n10 - n00);
    const nx1 = n01 + sx * (n11 - n01);
    return nx0 + sy * (nx1 - nx0);
}

function fbm(x: number, y: number, seed: number, octaves: number = 4): number {
    let value = 0;
    let amp = 1;
    let freq = 1;
    let maxAmp = 0;

    for (let i = 0; i < octaves; i++) {
        value += noise2d(x * freq, y * freq, seed + i * 31) * amp;
        maxAmp += amp;
        amp *= 0.5;
        freq *= 2;
    }
    return value / maxAmp;
}

// Marching squares for iso-contour extraction
interface Segment {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

function marchingSquaresContour(
    field: Float64Array,
    cols: number,
    rows: number,
    threshold: number,
    cellW: number,
    cellH: number,
    offsetX: number,
    offsetY: number,
): Segment[] {
    const segments: Segment[] = [];

    function val(ix: number, iy: number): number {
        return field[iy * cols + ix];
    }

    function lerp(a: number, b: number, va: number, vb: number): number {
        if (Math.abs(vb - va) < 1e-10) return (a + b) / 2;
        return a + (threshold - va) / (vb - va) * (b - a);
    }

    for (let iy = 0; iy < rows - 1; iy++) {
        for (let ix = 0; ix < cols - 1; ix++) {
            const x = offsetX + ix * cellW;
            const y = offsetY + iy * cellH;

            const v0 = val(ix, iy); // top-left
            const v1 = val(ix + 1, iy); // top-right
            const v2 = val(ix + 1, iy + 1); // bottom-right
            const v3 = val(ix, iy + 1); // bottom-left

            let caseIndex = 0;
            if (v0 >= threshold) caseIndex |= 1;
            if (v1 >= threshold) caseIndex |= 2;
            if (v2 >= threshold) caseIndex |= 4;
            if (v3 >= threshold) caseIndex |= 8;

            if (caseIndex === 0 || caseIndex === 15) continue;

            // Edge midpoints (interpolated)
            const top = lerp(x, x + cellW, v0, v1);
            const right = lerp(y, y + cellH, v1, v2);
            const bottom = lerp(x, x + cellW, v3, v2);
            const left = lerp(y, y + cellH, v0, v3);

            const addSeg = (x1: number, y1: number, x2: number, y2: number) =>
                segments.push({ x1, y1, x2, y2 });

            switch (caseIndex) {
                case 1:
                case 14:
                    addSeg(x, left, top, y);
                    break;
                case 2:
                case 13:
                    addSeg(top, y, x + cellW, right);
                    break;
                case 3:
                case 12:
                    addSeg(x, left, x + cellW, right);
                    break;
                case 4:
                case 11:
                    addSeg(x + cellW, right, bottom, y + cellH);
                    break;
                case 5:
                    addSeg(x, left, top, y);
                    addSeg(x + cellW, right, bottom, y + cellH);
                    break;
                case 6:
                case 9:
                    addSeg(top, y, bottom, y + cellH);
                    break;
                case 7:
                case 8:
                    addSeg(x, left, bottom, y + cellH);
                    break;
                case 10:
                    addSeg(x, left, bottom, y + cellH);
                    addSeg(top, y, x + cellW, right);
                    break;
            }
        }
    }
    return segments;
}

export function generateNoiseField(
    params: Record<string, number>,
    width: number,
    height: number,
): SvgElement[] {
    const resolution = params.resolution ?? 60;
    const noiseScale = params.noiseScale ?? 3;
    const contourCount = params.contourCount ?? 8;
    const seed = params.seed ?? 42;

    // Generate noise field
    const cols = resolution;
    const rows = resolution;
    const field = new Float64Array(cols * rows);
    for (let iy = 0; iy < rows; iy++) {
        for (let ix = 0; ix < cols; ix++) {
            const nx = (ix / cols) * noiseScale;
            const ny = (iy / rows) * noiseScale;
            field[iy * cols + ix] = fbm(nx, ny, seed);
        }
    }

    const cellW = width / (cols - 1);
    const cellH = height / (rows - 1);
    const elements: SvgElement[] = [];

    // Extract contour lines at multiple thresholds
    for (let c = 0; c < contourCount; c++) {
        const threshold = (c + 1) / (contourCount + 1);
        const segments = marchingSquaresContour(
            field,
            cols,
            rows,
            threshold,
            cellW,
            cellH,
            0,
            0,
        );

        // Convert segments to path
        for (const seg of segments) {
            elements.push({
                type: "line",
                attrs: {
                    x1: seg.x1,
                    y1: seg.y1,
                    x2: seg.x2,
                    y2: seg.y2,
                },
            });
        }
    }

    return elements;
}
