import type { ParamDef, SvgElement } from "../types";

export const dotGridParamDefs: ParamDef[] = [
    {
        name: "cols",
        label: "Columns",
        min: 5,
        max: 100,
        step: 1,
        defaultValue: 40,
    },
    {
        name: "rows",
        label: "Rows",
        min: 5,
        max: 100,
        step: 1,
        defaultValue: 40,
    },
    {
        name: "dotRadius",
        label: "Dot Radius",
        min: 0.5,
        max: 10,
        step: 0.25,
        defaultValue: 2,
    },
    {
        name: "spacingX",
        label: "Spacing X",
        min: 3,
        max: 40,
        step: 0.5,
        defaultValue: 15,
    },
    {
        name: "spacingY",
        label: "Spacing Y",
        min: 3,
        max: 40,
        step: 0.5,
        defaultValue: 15,
    },
];

export function generateDotGrid(
    params: Record<string, number>,
    width: number,
    height: number,
): SvgElement[] {
    const cols = params.cols ?? 40;
    const rows = params.rows ?? 40;
    const dotRadius = params.dotRadius ?? 2;
    const spacingX = params.spacingX ?? 15;
    const spacingY = params.spacingY ?? 15;

    const totalW = (cols - 1) * spacingX;
    const totalH = (rows - 1) * spacingY;
    const startX = (width - totalW) / 2;
    const startY = (height - totalH) / 2;

    const elements: SvgElement[] = [];
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            elements.push({
                type: "circle",
                attrs: {
                    cx: startX + col * spacingX,
                    cy: startY + row * spacingY,
                    r: dotRadius,
                    fill: "currentColor",
                },
            });
        }
    }
    return elements;
}
