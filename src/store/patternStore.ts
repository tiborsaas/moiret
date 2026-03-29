import { create } from "zustand";
import type { CanvasSettings, Layer, PatternType } from "../types";
import { patternRegistry } from "../patterns";

interface PatternStore {
    layers: Layer[];
    canvas: CanvasSettings;
    selectedLayerId: string | null;

    // Layer actions
    addLayer: (type: PatternType) => void;
    removeLayer: (id: string) => void;
    duplicateLayer: (id: string) => void;
    moveLayer: (id: string, direction: "up" | "down") => void;
    updateLayer: (id: string, updates: Partial<Layer>) => void;
    setSelectedLayer: (id: string | null) => void;

    // Canvas actions
    updateCanvas: (updates: Partial<CanvasSettings>) => void;

    // Preset loading
    loadPreset: (layers: Layer[], canvas?: Partial<CanvasSettings>) => void;
}

let nextId = 1;
function genId(): string {
    return `layer_${nextId++}_${Date.now().toString(36)}`;
}

function createLayer(
    type: PatternType,
    name: string,
    params: Record<string, number>,
): Layer {
    return {
        id: genId(),
        name,
        type,
        visible: true,
        opacity: 1,
        rotation: 0,
        scale: 1,
        offsetX: 0,
        offsetY: 0,
        strokeColor: "#ffffff",
        strokeWidth: 0.8,
        fill: "none",
        blendMode: "normal",
        params,
    };
}

// Default state: two concentric circle layers slightly offset → immediate moiré
const defaultLayer1 = createLayer("concentricCircles", "Circles A", {
    count: 60,
    spacing: 6,
    centerX: 0,
    centerY: 0,
});

const defaultLayer2: Layer = {
    ...createLayer("concentricCircles", "Circles B", {
        count: 60,
        spacing: 6,
        centerX: 0,
        centerY: 0,
    }),
    offsetX: 25,
    offsetY: 15,
    strokeColor: "#ffffff",
};

export const usePatternStore = create<PatternStore>((set, get) => ({
    layers: [defaultLayer1, defaultLayer2],
    canvas: {
        width: 800,
        height: 800,
        backgroundColor: "#0a0a0a",
    },
    selectedLayerId: defaultLayer1.id,

    addLayer: (type) => {
        const def = patternRegistry[type];
        const layer = createLayer(type, def.label, { ...def.defaultParams });
        set((s) => ({
            layers: [...s.layers, layer],
            selectedLayerId: layer.id,
        }));
    },

    removeLayer: (id) =>
        set((s) => {
            const layers = s.layers.filter((l) => l.id !== id);
            return {
                layers,
                selectedLayerId: s.selectedLayerId === id
                    ? layers.length > 0 ? layers[layers.length - 1].id : null
                    : s.selectedLayerId,
            };
        }),

    duplicateLayer: (id) =>
        set((s) => {
            const source = s.layers.find((l) => l.id === id);
            if (!source) return s;
            const copy: Layer = {
                ...source,
                id: genId(),
                name: `${source.name} (copy)`,
                params: { ...source.params },
            };
            const idx = s.layers.findIndex((l) => l.id === id);
            const layers = [...s.layers];
            layers.splice(idx + 1, 0, copy);
            return { layers, selectedLayerId: copy.id };
        }),

    moveLayer: (id, direction) =>
        set((s) => {
            const idx = s.layers.findIndex((l) => l.id === id);
            if (idx < 0) return s;
            const newIdx = direction === "up" ? idx - 1 : idx + 1;
            if (newIdx < 0 || newIdx >= s.layers.length) return s;
            const layers = [...s.layers];
            [layers[idx], layers[newIdx]] = [layers[newIdx], layers[idx]];
            return { layers };
        }),

    updateLayer: (id, updates) =>
        set((s) => ({
            layers: s.layers.map((l) =>
                l.id === id
                    ? {
                        ...l,
                        ...updates,
                        // When type changes, replace params entirely; otherwise merge
                        params: updates.type
                            ? (updates.params ?? l.params)
                            : updates.params
                            ? { ...l.params, ...updates.params }
                            : l.params,
                    }
                    : l
            ),
        })),

    setSelectedLayer: (id) => set({ selectedLayerId: id }),

    updateCanvas: (updates) =>
        set((s) => ({ canvas: { ...s.canvas, ...updates } })),

    loadPreset: (layers, canvas) =>
        set((s) => ({
            layers,
            canvas: canvas ? { ...s.canvas, ...canvas } : s.canvas,
            selectedLayerId: layers.length > 0 ? layers[0].id : null,
        })),
}));
