import type { ParamDef, SvgElement } from "../types";

export const spiralParamDefs: ParamDef[] = [
    {
        name: "turns",
        label: "Turns",
        min: 3,
        max: 60,
        step: 1,
        defaultValue: 20,
    },
    {
        name: "spacing",
        label: "Spacing",
        min: 2,
        max: 20,
        step: 0.5,
        defaultValue: 6,
    },
    {
        name: "direction",
        label: "Direction (1=CW, -1=CCW)",
        min: -1,
        max: 1,
        step: 2,
        defaultValue: 1,
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

export function generateSpiral(
    params: Record<string, number>,
    width: number,
    height: number,
): SvgElement[] {
    const turns = params.turns ?? 20;
    const spacing = params.spacing ?? 6;
    const direction = params.direction ?? 1;
    const cx = width / 2 + (params.centerX ?? 0);
    const cy = height / 2 + (params.centerY ?? 0);

    const pointsPerTurn = 120;
    const totalPoints = turns * pointsPerTurn;
    const points: string[] = [];

    // Archimedean spiral: r = a + b*θ
    const b = spacing / (2 * Math.PI);

    for (let i = 0; i <= totalPoints; i++) {
        const theta = (i / pointsPerTurn) * 2 * Math.PI * direction;
        const r = b * Math.abs(theta);
        const x = cx + r * Math.cos(theta);
        const y = cy + r * Math.sin(theta);

        if (i === 0) {
            points.push(`M ${x} ${y}`);
        } else {
            points.push(`L ${x} ${y}`);
        }
    }

    return [
        {
            type: "path",
            attrs: { d: points.join(" "), fill: "none" },
        },
    ];
}
