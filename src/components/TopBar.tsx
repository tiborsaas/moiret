import { useState } from 'react';
import { usePatternStore } from '../store/patternStore';
import { exportSvg } from '../export/svgExport';
import { exportPng } from '../export/pngExport';
import { exportLayersSvg, exportLayersPng } from '../export/layerExport';
import { presets } from '../presets';
import { ColorField } from './fields/ColorField';
import './TopBar.css';

export function TopBar() {
    const canvas = usePatternStore((s) => s.canvas);
    const layers = usePatternStore((s) => s.layers);
    const updateCanvas = usePatternStore((s) => s.updateCanvas);
    const loadPreset = usePatternStore((s) => s.loadPreset);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [pngScale, setPngScale] = useState(2);

    const getSvgElement = (): SVGSVGElement | null => {
        const ref = (window as unknown as Record<string, unknown>).__moiretSvgRef as
            | React.RefObject<SVGSVGElement>
            | undefined;
        return ref?.current ?? null;
    };

    const handleExportSvg = () => {
        const svg = getSvgElement();
        if (svg) exportSvg(svg);
        setShowExportMenu(false);
    };

    const handleExportPng = () => {
        const svg = getSvgElement();
        if (svg) exportPng(svg, 'moire-pattern.png', pngScale);
        setShowExportMenu(false);
    };

    const handleExportLayersSvg = () => {
        exportLayersSvg(layers, canvas);
        setShowExportMenu(false);
    };

    const handleExportLayersPng = () => {
        exportLayersPng(layers, canvas, pngScale);
        setShowExportMenu(false);
    };

    return (
        <div className="top-bar">
            <div className="top-bar__section">
                <span className="top-bar__title">moiré</span>
            </div>

            <div className="top-bar__section">
                <label className="top-bar__label">Canvas</label>
                <input
                    className="top-bar__size-input"
                    type="number"
                    value={canvas.width}
                    min={100}
                    max={4096}
                    step={50}
                    onChange={(e) => updateCanvas({ width: parseInt(e.target.value) || 800 })}
                />
                <span className="top-bar__x">×</span>
                <input
                    className="top-bar__size-input"
                    type="number"
                    value={canvas.height}
                    min={100}
                    max={4096}
                    step={50}
                    onChange={(e) => updateCanvas({ height: parseInt(e.target.value) || 800 })}
                />
                <ColorField
                    label="BG"
                    value={canvas.backgroundColor}
                    onChange={(v) => updateCanvas({ backgroundColor: v })}
                />
            </div>

            <div className="top-bar__section">
                <label className="top-bar__label">Presets</label>
                <select
                    className="top-bar__preset-select"
                    value=""
                    onChange={(e) => {
                        const preset = presets.find((p) => p.name === e.target.value);
                        if (preset) loadPreset(preset.layers, preset.canvas);
                    }}
                >
                    <option value="" disabled>
                        Load preset…
                    </option>
                    {presets.map((p) => (
                        <option key={p.name} value={p.name}>
                            {p.name}
                        </option>
                    ))}
                </select>
            </div>

            <div className="top-bar__section top-bar__section--right">
                <div className="top-bar__export-wrapper">
                    <button
                        className="top-bar__export-btn"
                        onClick={() => setShowExportMenu(!showExportMenu)}
                    >
                        Export ▾
                    </button>
                    {showExportMenu && (
                        <div className="top-bar__export-menu">
                            <div className="top-bar__export-scale">
                                <label>PNG Scale:</label>
                                <select value={pngScale} onChange={(e) => setPngScale(Number(e.target.value))}>
                                    <option value={1}>1×</option>
                                    <option value={2}>2×</option>
                                    <option value={4}>4×</option>
                                </select>
                            </div>
                            <button onClick={handleExportSvg}>Export SVG</button>
                            <button onClick={handleExportPng}>Export PNG ({pngScale}×)</button>
                            <hr />
                            <button onClick={handleExportLayersSvg}>Export Layers (SVG)</button>
                            <button onClick={handleExportLayersPng}>Export Layers (PNG)</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
