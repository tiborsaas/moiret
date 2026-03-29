export type PatternType =
    | "concentricCircles"
    | "parallelLines"
    | "radialLines"
    | "dotGrid"
    | "crosshatch"
    | "waveLines"
    | "spiral"
    | "fresnelZonePlate"
    | "roseCurve"
    | "chevron"
    | "noiseField";

export type BlendMode =
    | "normal"
    | "multiply"
    | "screen"
    | "overlay"
    | "darken"
    | "lighten"
    | "difference"
    | "exclusion";

export interface Layer {
    id: string;
    name: string;
    type: PatternType;
    visible: boolean;
    opacity: number;
    rotation: number; // degrees, 0.01° precision — critical for moiré
    scale: number;
    offsetX: number;
    offsetY: number;
    strokeColor: string;
    strokeWidth: number;
    fill: string;
    blendMode: BlendMode;
    params: Record<string, number>;
}

export interface CanvasSettings {
    width: number;
    height: number;
    backgroundColor: string;
}

export interface ParamDef {
    name: string;
    label: string;
    min: number;
    max: number;
    step: number;
    defaultValue: number;
}

export interface SvgElement {
    type: "circle" | "line" | "path" | "rect";
    attrs: Record<string, string | number>;
}

export interface PatternDefinition {
    label: string;
    icon: string;
    generate: (
        params: Record<string, number>,
        width: number,
        height: number,
    ) => SvgElement[];
    defaultParams: Record<string, number>;
    paramDefs: ParamDef[];
}
