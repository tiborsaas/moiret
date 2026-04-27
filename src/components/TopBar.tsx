import { useState, useRef, useEffect } from 'react';
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
    const viewMode = usePatternStore((s) => s.viewMode);
    const setViewMode = usePatternStore((s) => s.setViewMode);
    const render3DMode = usePatternStore((s) => s.render3DMode);
    const setRender3DMode = usePatternStore((s) => s.setRender3DMode);
    const userPresets = usePatternStore((s) => s.userPresets);
    const saveUserPreset = usePatternStore((s) => s.saveUserPreset);
    const deleteUserPreset = usePatternStore((s) => s.deleteUserPreset);

    const [showExportMenu, setShowExportMenu] = useState(false);
    const [pngScale, setPngScale] = useState(2);
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [savePresetName, setSavePresetName] = useState('');
    const [selectedUserPreset, setSelectedUserPreset] = useState('');
    const saveInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (showSaveDialog) {
            saveInputRef.current?.focus();
        }
    }, [showSaveDialog]);

    // Keep selectedUserPreset in sync (if deleted externally)
    useEffect(() => {
        if (selectedUserPreset && !userPresets.find((p) => p.name === selectedUserPreset)) {
            setSelectedUserPreset('');
        }
    }, [userPresets, selectedUserPreset]);

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

    const handleExportPresetsJson = () => {
        const json = JSON.stringify(userPresets, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'moiret-presets.json';
        a.click();
        URL.revokeObjectURL(url);
        setShowExportMenu(false);
    };

    const handleSavePreset = () => {
        if (!savePresetName.trim()) return;
        saveUserPreset(savePresetName);
        setSelectedUserPreset(savePresetName.trim());
        setSavePresetName('');
        setShowSaveDialog(false);
    };

    const handleLoadUserPreset = (name: string) => {
        const preset = userPresets.find((p) => p.name === name);
        if (preset) {
            loadPreset(preset.layers, preset.canvas);
            setSelectedUserPreset(name);
        }
    };

    const handleDeleteUserPreset = () => {
        if (!selectedUserPreset) return;
        deleteUserPreset(selectedUserPreset);
        setSelectedUserPreset('');
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

            <div className="top-bar__section top-bar__section--user-presets">
                <label className="top-bar__label">My Presets</label>
                <select
                    className="top-bar__preset-select"
                    value={selectedUserPreset}
                    onChange={(e) => handleLoadUserPreset(e.target.value)}
                    disabled={userPresets.length === 0}
                >
                    <option value="" disabled>
                        {userPresets.length === 0 ? 'No presets saved' : 'Load preset…'}
                    </option>
                    {userPresets.map((p) => (
                        <option key={p.name} value={p.name}>
                            {p.name}
                        </option>
                    ))}
                </select>
                <button
                    className="top-bar__user-preset-btn top-bar__user-preset-btn--delete"
                    onClick={handleDeleteUserPreset}
                    disabled={!selectedUserPreset}
                    title="Delete selected preset"
                >
                    ✕
                </button>
                {showSaveDialog ? (
                    <div className="top-bar__save-dialog">
                        <input
                            ref={saveInputRef}
                            className="top-bar__save-input"
                            type="text"
                            value={savePresetName}
                            placeholder="Preset name…"
                            onChange={(e) => setSavePresetName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSavePreset();
                                if (e.key === 'Escape') setShowSaveDialog(false);
                            }}
                        />
                        <button
                            className="top-bar__user-preset-btn top-bar__user-preset-btn--confirm"
                            onClick={handleSavePreset}
                            disabled={!savePresetName.trim()}
                        >
                            Save
                        </button>
                        <button
                            className="top-bar__user-preset-btn"
                            onClick={() => setShowSaveDialog(false)}
                        >
                            Cancel
                        </button>
                    </div>
                ) : (
                    <button
                        className="top-bar__user-preset-btn top-bar__user-preset-btn--save"
                        onClick={() => setShowSaveDialog(true)}
                        title="Save current state as preset"
                    >
                        + Save
                    </button>
                )}
            </div>

            <div className="top-bar__section top-bar__section--right">
                <div className="top-bar__view-toggle">
                    <button
                        className={`top-bar__view-btn${viewMode === '2d' ? ' top-bar__view-btn--active' : ''}`}
                        onClick={() => setViewMode('2d')}
                    >2D</button>
                    <button
                        className={`top-bar__view-btn${viewMode === '3d' && render3DMode === 'printed' ? ' top-bar__view-btn--active' : ''}`}
                        onClick={() => {
                            setRender3DMode('printed');
                            setViewMode('3d');
                        }}
                    >3D foil</button>
                    <button
                        className={`top-bar__view-btn${viewMode === '3d' && render3DMode === 'etched' ? ' top-bar__view-btn--active' : ''}`}
                        onClick={() => {
                            setRender3DMode('etched');
                            setViewMode('3d');
                        }}
                    >3D etched</button>
                </div>
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
                            <hr />
                            <button
                                onClick={handleExportPresetsJson}
                                disabled={userPresets.length === 0}
                                title={userPresets.length === 0 ? 'No user presets to export' : undefined}
                            >
                                Export My Presets (JSON)
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
