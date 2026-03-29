import type { ParamDef, SvgElement } from "../types";

export const roseCurveParamDefs: ParamDef[] = [
    {
        name: "n",
        label: "Petal Numerator (n)",
        min: 1,
        max: 12,
        step: 1,
        defaultValue: 5,
    },
    {
        name: "d",
        label: "Petal Denominator (d)",
        min: 1,
        max: 12,
        step: 1,
        defaultValue: 3,
    },
    {
        name: "size",
        label: "Size",
        min: 50,
        max: 500,
        step: 10,
        defaultValue: 300,
    },
    {
        name: "resolution",
        label: "Resolution",
        min: 200,
        max: 2000,
        step: 50,
        defaultValue: 800,
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

export function generateRoseCurve(
    params: Record<string, number>,
    width: number,
    height: number,
): SvgElement[] {
    const n = params.n ?? 5;
    const d = params.d ?? 3;
    const size = params.size ?? 300;
    const resolution = params.resolution ?? 800;
    const cx = width / 2 + (params.centerX ?? 0);
    const cy = height / 2 + (params.centerY ?? 0);

    const k = n / d;
    // For rational k = n/d, curve closes after d*π (if n*d is odd) or 2*d*π (if n*d is even)
    const maxTheta = (n * d) % 2 === 0 ? 2 * d * Math.PI : d * Math.PI;

    const points: string[] = [];
    for (let i = 0; i <= resolution; i++) {
        const theta = (i / resolution) * maxTheta;
        const r = size * Math.cos(k * theta);
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
