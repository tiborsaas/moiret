import type { ParamDef, SvgElement } from "../types";

export const crosshatchParamDefs: ParamDef[] = [
    {
        name: "spacingX",
        label: "Horizontal Spacing",
        min: 3,
        max: 40,
        step: 0.5,
        defaultValue: 10,
    },
    {
        name: "spacingY",
        label: "Vertical Spacing",
        min: 3,
        max: 40,
        step: 0.5,
        defaultValue: 10,
    },
    {
        name: "countX",
        label: "Horizontal Lines",
        min: 5,
        max: 200,
        step: 1,
        defaultValue: 80,
    },
    {
        name: "countY",
        label: "Vertical Lines",
        min: 5,
        max: 200,
        step: 1,
        defaultValue: 80,
    },
];

export function generateCrosshatch(
    params: Record<string, number>,
    width: number,
    height: number,
): SvgElement[] {
    const spacingX = params.spacingX ?? 10;
    const spacingY = params.spacingY ?? 10;
    const countX = params.countX ?? 80;
    const countY = params.countY ?? 80;

    const elements: SvgElement[] = [];
    const totalH = (countX - 1) * spacingY;
    const totalW = (countY - 1) * spacingX;
    const startY = (height - totalH) / 2;
    const startX = (width - totalW) / 2;

    // Horizontal lines
    for (let i = 0; i < countX; i++) {
        const y = startY + i * spacingY;
        elements.push({
            type: "line",
            attrs: { x1: -100, y1: y, x2: width + 100, y2: y },
        });
    }
    // Vertical lines
    for (let i = 0; i < countY; i++) {
        const x = startX + i * spacingX;
        elements.push({
            type: "line",
            attrs: { x1: x, y1: -100, x2: x, y2: height + 100 },
        });
    }
    return elements;
}
