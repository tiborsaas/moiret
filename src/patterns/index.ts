import type { PatternDefinition, PatternType } from "../types";
import {
    concentricCirclesParamDefs,
    generateConcentricCircles,
} from "./concentricCircles";
import { generateParallelLines, parallelLinesParamDefs } from "./parallelLines";
import { generateRadialLines, radialLinesParamDefs } from "./radialLines";
import { dotGridParamDefs, generateDotGrid } from "./dotGrid";
import { crosshatchParamDefs, generateCrosshatch } from "./crosshatch";
import { generateWaveLines, waveLinesParamDefs } from "./waveLines";
import { generateSpiral, spiralParamDefs } from "./spiral";
import {
    fresnelZonePlateParamDefs,
    generateFresnelZonePlate,
} from "./fresnelZonePlate";
import { generateRoseCurve, roseCurveParamDefs } from "./roseCurve";
import { chevronParamDefs, generateChevron } from "./chevron";
import { generateNoiseField, noiseFieldParamDefs } from "./noiseField";

export const patternRegistry: Record<PatternType, PatternDefinition> = {
    concentricCircles: {
        label: "Concentric Circles",
        icon: "◎",
        generate: generateConcentricCircles,
        defaultParams: Object.fromEntries(
            concentricCirclesParamDefs.map((p) => [p.name, p.defaultValue]),
        ),
        paramDefs: concentricCirclesParamDefs,
    },
    parallelLines: {
        label: "Parallel Lines",
        icon: "☰",
        generate: generateParallelLines,
        defaultParams: Object.fromEntries(
            parallelLinesParamDefs.map((p) => [p.name, p.defaultValue]),
        ),
        paramDefs: parallelLinesParamDefs,
    },
    radialLines: {
        label: "Radial Lines",
        icon: "✳",
        generate: generateRadialLines,
        defaultParams: Object.fromEntries(
            radialLinesParamDefs.map((p) => [p.name, p.defaultValue]),
        ),
        paramDefs: radialLinesParamDefs,
    },
    dotGrid: {
        label: "Dot Grid",
        icon: "⠿",
        generate: generateDotGrid,
        defaultParams: Object.fromEntries(
            dotGridParamDefs.map((p) => [p.name, p.defaultValue]),
        ),
        paramDefs: dotGridParamDefs,
    },
    crosshatch: {
        label: "Crosshatch",
        icon: "▦",
        generate: generateCrosshatch,
        defaultParams: Object.fromEntries(
            crosshatchParamDefs.map((p) => [p.name, p.defaultValue]),
        ),
        paramDefs: crosshatchParamDefs,
    },
    waveLines: {
        label: "Wave Lines",
        icon: "〰",
        generate: generateWaveLines,
        defaultParams: Object.fromEntries(
            waveLinesParamDefs.map((p) => [p.name, p.defaultValue]),
        ),
        paramDefs: waveLinesParamDefs,
    },
    spiral: {
        label: "Spiral",
        icon: "🌀",
        generate: generateSpiral,
        defaultParams: Object.fromEntries(
            spiralParamDefs.map((p) => [p.name, p.defaultValue]),
        ),
        paramDefs: spiralParamDefs,
    },
    fresnelZonePlate: {
        label: "Fresnel Zone Plate",
        icon: "◉",
        generate: generateFresnelZonePlate,
        defaultParams: Object.fromEntries(
            fresnelZonePlateParamDefs.map((p) => [p.name, p.defaultValue]),
        ),
        paramDefs: fresnelZonePlateParamDefs,
    },
    roseCurve: {
        label: "Rose Curve",
        icon: "✿",
        generate: generateRoseCurve,
        defaultParams: Object.fromEntries(
            roseCurveParamDefs.map((p) => [p.name, p.defaultValue]),
        ),
        paramDefs: roseCurveParamDefs,
    },
    chevron: {
        label: "Chevron",
        icon: "⋙",
        generate: generateChevron,
        defaultParams: Object.fromEntries(
            chevronParamDefs.map((p) => [p.name, p.defaultValue]),
        ),
        paramDefs: chevronParamDefs,
    },
    noiseField: {
        label: "Noise Field",
        icon: "░",
        generate: generateNoiseField,
        defaultParams: Object.fromEntries(
            noiseFieldParamDefs.map((p) => [p.name, p.defaultValue]),
        ),
        paramDefs: noiseFieldParamDefs,
    },
};

export const patternTypeList: PatternType[] = Object.keys(
    patternRegistry,
) as PatternType[];
