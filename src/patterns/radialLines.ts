import type { ParamDef, SvgElement } from "../types";

export const radialLinesParamDefs: ParamDef[] = [
    {
        name: "count",
        label: "Line Count",
        min: 6,
        max: 360,
        step: 1,
        defaultValue: 72,
    },
    {
        name: "length",
        label: "Length",
        min: 50,
        max: 1000,
        step: 10,
        defaultValue: 500,
    },
    {
        name: "centerX",
        label: "Center X Offset",
        min: -400,
        max: 400,
        step: 1,
        defaultValue: 0,
    },
    {
        name: "centerY",
        label: "Center Y Offset",
        min: -400,
        max: 400,
        step: 1,
        defaultValue: 0,
    },
];

export function generateRadialLines(
    params: Record<string, number>,
    width: number,
    height: number,
): SvgElement[] {
    const count = params.count ?? 72;
    const length = params.length ?? 500;
    const cx = width / 2 + (params.centerX ?? 0);
    const cy = height / 2 + (params.centerY ?? 0);

    const elements: SvgElement[] = [];
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        elements.push({
            type: "line",
            attrs: {
                x1: cx,
                y1: cy,
                x2: cx + Math.cos(angle) * length,
                y2: cy + Math.sin(angle) * length,
            },
        });
    }
    return elements;
}
