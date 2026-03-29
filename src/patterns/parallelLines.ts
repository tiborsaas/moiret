import type { ParamDef, SvgElement } from "../types";

export const parallelLinesParamDefs: ParamDef[] = [
    {
        name: "count",
        label: "Line Count",
        min: 5,
        max: 300,
        step: 1,
        defaultValue: 80,
    },
    {
        name: "spacing",
        label: "Spacing",
        min: 1,
        max: 30,
        step: 0.5,
        defaultValue: 5,
    },
    {
        name: "angle",
        label: "Line Angle",
        min: 0,
        max: 180,
        step: 0.1,
        defaultValue: 0,
    },
];

export function generateParallelLines(
    params: Record<string, number>,
    width: number,
    height: number,
): SvgElement[] {
    const count = params.count ?? 80;
    const spacing = params.spacing ?? 5;
    const angle = ((params.angle ?? 0) * Math.PI) / 180;

    const elements: SvgElement[] = [];
    const diagonal = Math.sqrt(width * width + height * height);
    const cx = width / 2;
    const cy = height / 2;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const totalWidth = count * spacing;
    const startOffset = -totalWidth / 2;

    for (let i = 0; i < count; i++) {
        const offset = startOffset + i * spacing;
        // Line perpendicular to angle direction, offset along the angle normal
        const nx = -sinA; // normal direction
        const ny = cosA;
        const px = cx + nx * offset;
        const py = cy + ny * offset;
        // Line extends along the angle direction
        const x1 = px - cosA * diagonal;
        const y1 = py - sinA * diagonal;
        const x2 = px + cosA * diagonal;
        const y2 = py + sinA * diagonal;

        elements.push({
            type: "line",
            attrs: { x1, y1, x2, y2 },
        });
    }
    return elements;
}
