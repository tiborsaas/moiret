import type { ParamDef, SvgElement } from "../types";

export const fresnelZonePlateParamDefs: ParamDef[] = [
    {
        name: "zoneCount",
        label: "Zone Count",
        min: 10,
        max: 200,
        step: 1,
        defaultValue: 80,
    },
    {
        name: "maxRadius",
        label: "Max Radius",
        min: 100,
        max: 800,
        step: 10,
        defaultValue: 400,
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

export function generateFresnelZonePlate(
    params: Record<string, number>,
    width: number,
    height: number,
): SvgElement[] {
    const zoneCount = params.zoneCount ?? 80;
    const maxRadius = params.maxRadius ?? 400;
    const cx = width / 2 + (params.centerX ?? 0);
    const cy = height / 2 + (params.centerY ?? 0);

    const elements: SvgElement[] = [];

    // Fresnel zone plate: radius of nth zone boundary = sqrt(n) * scale
    // Scale factor so the outermost zone reaches maxRadius
    const scale = maxRadius / Math.sqrt(zoneCount);

    for (let n = 1; n <= zoneCount; n++) {
        const r = Math.sqrt(n) * scale;
        elements.push({
            type: "circle",
            attrs: {
                cx,
                cy,
                r,
                fill: "none",
            },
        });
    }

    return elements;
}
