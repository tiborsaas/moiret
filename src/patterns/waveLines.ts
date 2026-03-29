import type { ParamDef, SvgElement } from "../types";

export const waveLinesParamDefs: ParamDef[] = [
    {
        name: "count",
        label: "Wave Count",
        min: 5,
        max: 150,
        step: 1,
        defaultValue: 50,
    },
    {
        name: "amplitude",
        label: "Amplitude",
        min: 1,
        max: 100,
        step: 1,
        defaultValue: 20,
    },
    {
        name: "frequency",
        label: "Frequency",
        min: 0.5,
        max: 20,
        step: 0.1,
        defaultValue: 3,
    },
    {
        name: "phase",
        label: "Phase",
        min: 0,
        max: 360,
        step: 1,
        defaultValue: 0,
    },
    {
        name: "spacing",
        label: "Spacing",
        min: 2,
        max: 30,
        step: 0.5,
        defaultValue: 8,
    },
];

export function generateWaveLines(
    params: Record<string, number>,
    width: number,
    height: number,
): SvgElement[] {
    const count = params.count ?? 50;
    const amplitude = params.amplitude ?? 20;
    const frequency = params.frequency ?? 3;
    const phase = ((params.phase ?? 0) * Math.PI) / 180;
    const spacing = params.spacing ?? 8;

    const elements: SvgElement[] = [];
    const totalHeight = (count - 1) * spacing;
    const startY = (height - totalHeight) / 2;
    const resolution = 200; // path points

    for (let i = 0; i < count; i++) {
        const baseY = startY + i * spacing;
        const points: string[] = [];

        for (let j = 0; j <= resolution; j++) {
            const x = (j / resolution) * (width + 40) - 20;
            const t = (x / width) * Math.PI * 2 * frequency + phase;
            const y = baseY + Math.sin(t) * amplitude;

            if (j === 0) {
                points.push(`M ${x} ${y}`);
            } else {
                points.push(`L ${x} ${y}`);
            }
        }

        elements.push({
            type: "path",
            attrs: { d: points.join(" "), fill: "none" },
        });
    }
    return elements;
}
