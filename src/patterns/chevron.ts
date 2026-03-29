import type { ParamDef, SvgElement } from "../types";

export const chevronParamDefs: ParamDef[] = [
    {
        name: "count",
        label: "Row Count",
        min: 5,
        max: 150,
        step: 1,
        defaultValue: 50,
    },
    {
        name: "angle",
        label: "Chevron Angle",
        min: 10,
        max: 80,
        step: 1,
        defaultValue: 45,
    },
    {
        name: "spacing",
        label: "Spacing",
        min: 3,
        max: 30,
        step: 0.5,
        defaultValue: 10,
    },
    {
        name: "width",
        label: "Chevron Width",
        min: 20,
        max: 200,
        step: 5,
        defaultValue: 60,
    },
];

export function generateChevron(
    params: Record<string, number>,
    canvasW: number,
    canvasH: number,
): SvgElement[] {
    const count = params.count ?? 50;
    const angle = ((params.angle ?? 45) * Math.PI) / 180;
    const spacing = params.spacing ?? 10;
    const chevronWidth = params.width ?? 60;

    const elements: SvgElement[] = [];
    const totalHeight = (count - 1) * spacing;
    const startY = (canvasH - totalHeight) / 2;
    const peakHeight = Math.tan(angle) * (chevronWidth / 2);

    // Repeating zigzag rows across the canvas
    const repeats = Math.ceil(canvasW / chevronWidth) + 2;
    const startX = -chevronWidth;

    for (let row = 0; row < count; row++) {
        const baseY = startY + row * spacing;
        const points: string[] = [];

        for (let j = 0; j < repeats; j++) {
            const x = startX + j * chevronWidth;
            if (j === 0) {
                points.push(`M ${x} ${baseY}`);
            }
            // Peak (up)
            points.push(`L ${x + chevronWidth / 2} ${baseY - peakHeight}`);
            // Valley (back to base)
            points.push(`L ${x + chevronWidth} ${baseY}`);
        }

        elements.push({
            type: "path",
            attrs: { d: points.join(" "), fill: "none" },
        });
    }

    return elements;
}
