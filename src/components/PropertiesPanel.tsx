import { usePatternStore } from '../store/patternStore';
import { patternRegistry, patternTypeList } from '../patterns';
import { SliderField } from './fields/SliderField';
import { ColorField } from './fields/ColorField';
import { SelectField } from './fields/SelectField';
import type { BlendMode, PatternType } from '../types';
import './PropertiesPanel.css';

const BLEND_MODE_OPTIONS = [
    { value: 'normal', label: 'Normal' },
    { value: 'multiply', label: 'Multiply' },
    { value: 'screen', label: 'Screen' },
    { value: 'overlay', label: 'Overlay' },
    { value: 'darken', label: 'Darken' },
    { value: 'lighten', label: 'Lighten' },
    { value: 'difference', label: 'Difference' },
    { value: 'exclusion', label: 'Exclusion' },
];

export function PropertiesPanel() {
    const layers = usePatternStore((s) => s.layers);
    const selectedLayerId = usePatternStore((s) => s.selectedLayerId);
    const updateLayer = usePatternStore((s) => s.updateLayer);
    const canvas = usePatternStore((s) => s.canvas);

    const layer = layers.find((l) => l.id === selectedLayerId);
    if (!layer) {
        return (
            <div className="properties-panel">
                <div className="properties-panel__empty">Select a layer to edit its properties</div>
            </div>
        );
    }

    const patternDef = patternRegistry[layer.type];

    return (
        <div className="properties-panel">
            <div className="properties-panel__header">
                <span className="properties-panel__icon">{patternDef.icon}</span>
                <input
                    className="properties-panel__name-input"
                    value={layer.name}
                    onChange={(e) => updateLayer(layer.id, { name: e.target.value })}
                />
            </div>

            <div className="properties-panel__section">
                <div className="properties-panel__section-title">Pattern Type</div>
                <SelectField
                    label=""
                    value={layer.type}
                    options={patternTypeList.map((t: PatternType) => ({
                        value: t,
                        label: `${patternRegistry[t].icon} ${patternRegistry[t].label}`,
                    }))}
                    onChange={(v) => {
                        const newType = v as PatternType;
                        const newDef = patternRegistry[newType];
                        updateLayer(layer.id, {
                            type: newType,
                            params: { ...newDef.defaultParams },
                        });
                    }}
                />
            </div>

            <div className="properties-panel__section">
                <div className="properties-panel__section-title">Transform</div>
                <SliderField
                    label="Rotation (°)"
                    value={layer.rotation}
                    min={-180}
                    max={180}
                    step={0.01}
                    onChange={(v) => updateLayer(layer.id, { rotation: v })}
                />
                <SliderField
                    label="Scale"
                    value={layer.scale}
                    min={0.1}
                    max={5}
                    step={0.01}
                    onChange={(v) => updateLayer(layer.id, { scale: v })}
                />
                <SliderField
                    label="Offset X"
                    value={layer.offsetX}
                    min={-canvas.width}
                    max={canvas.width}
                    step={1}
                    onChange={(v) => updateLayer(layer.id, { offsetX: v })}
                />
                <SliderField
                    label="Offset Y"
                    value={layer.offsetY}
                    min={-canvas.height}
                    max={canvas.height}
                    step={1}
                    onChange={(v) => updateLayer(layer.id, { offsetY: v })}
                />
            </div>

            <div className="properties-panel__section">
                <div className="properties-panel__section-title">Appearance</div>
                <ColorField
                    label="Stroke"
                    value={layer.strokeColor}
                    onChange={(v) => updateLayer(layer.id, { strokeColor: v })}
                />
                <SliderField
                    label="Stroke Width"
                    value={layer.strokeWidth}
                    min={0.1}
                    max={10}
                    step={0.1}
                    onChange={(v) => updateLayer(layer.id, { strokeWidth: v })}
                />
                <ColorField
                    label="Fill"
                    value={layer.fill}
                    onChange={(v) => updateLayer(layer.id, { fill: v })}
                    allowNone
                />
                <SliderField
                    label="Opacity"
                    value={layer.opacity}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(v) => updateLayer(layer.id, { opacity: v })}
                />
                <SelectField
                    label="Blend Mode"
                    value={layer.blendMode}
                    options={BLEND_MODE_OPTIONS}
                    onChange={(v) => updateLayer(layer.id, { blendMode: v as BlendMode })}
                />
            </div>

            <div className="properties-panel__section">
                <div className="properties-panel__section-title">Pattern Parameters</div>
                {patternDef.paramDefs.map((paramDef) => (
                    <SliderField
                        key={paramDef.name}
                        label={paramDef.label}
                        value={layer.params[paramDef.name] ?? paramDef.defaultValue}
                        min={paramDef.min}
                        max={paramDef.max}
                        step={paramDef.step}
                        onChange={(v) => {
                            updateLayer(layer.id, {
                                params: { ...layer.params, [paramDef.name]: v },
                            });
                        }}
                    />
                ))}
            </div>

            <div className="properties-panel__section">
                <button
                    className="properties-panel__reset-btn"
                    onClick={() => {
                        updateLayer(layer.id, {
                            rotation: 0,
                            scale: 1,
                            offsetX: 0,
                            offsetY: 0,
                            opacity: 1,
                            strokeColor: '#ffffff',
                            strokeWidth: 0.8,
                            fill: 'none',
                            blendMode: 'normal',
                            params: { ...patternDef.defaultParams },
                        });
                    }}
                >
                    Reset Layer
                </button>
            </div>
        </div>
    );
}
