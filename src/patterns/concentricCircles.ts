import type { ParamDef, SvgElement } from "../types";

export const concentricCirclesParamDefs: ParamDef[] = [
    {
        name: "count",
        label: "Ring Count",
        min: 5,
        max: 200,
        step: 1,
        defaultValue: 60,
    },
    {
        name: "spacing",
        label: "Spacing",
        min: 1,
        max: 30,
        step: 0.5,
        defaultValue: 6,
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

export function generateConcentricCircles(
    params: Record<string, number>,
    width: number,
    height: number,
): SvgElement[] {
    const count = params.count ?? 60;
    const spacing = params.spacing ?? 6;
    const cx = width / 2 + (params.centerX ?? 0);
    const cy = height / 2 + (params.centerY ?? 0);

    const elements: SvgElement[] = [];
    for (let i = 1; i <= count; i++) {
        elements.push({
            type: "circle",
            attrs: {
                cx,
                cy,
                r: i * spacing,
                fill: "none",
            },
        });
    }
    return elements;
}
