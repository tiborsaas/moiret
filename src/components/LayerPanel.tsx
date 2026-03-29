import { useState, useRef } from 'react';
import { usePatternStore } from '../store/patternStore';
import { patternRegistry, patternTypeList } from '../patterns';
import type { PatternType } from '../types';
import './LayerPanel.css';

export function LayerPanel() {
    const layers = usePatternStore((s) => s.layers);
    const selectedLayerId = usePatternStore((s) => s.selectedLayerId);
    const addLayer = usePatternStore((s) => s.addLayer);
    const removeLayer = usePatternStore((s) => s.removeLayer);
    const duplicateLayer = usePatternStore((s) => s.duplicateLayer);
    const moveLayer = usePatternStore((s) => s.moveLayer);
    const updateLayer = usePatternStore((s) => s.updateLayer);
    const setSelectedLayer = usePatternStore((s) => s.setSelectedLayer);

    const [showAddMenu, setShowAddMenu] = useState(false);
    const dragItem = useRef<string | null>(null);
    const dragOverItem = useRef<string | null>(null);

    const handleDragStart = (id: string) => {
        dragItem.current = id;
    };

    const handleDragOver = (e: React.DragEvent, id: string) => {
        e.preventDefault();
        dragOverItem.current = id;
    };

    const handleDrop = () => {
        if (!dragItem.current || !dragOverItem.current) return;
        if (dragItem.current === dragOverItem.current) return;
        const dragIdx = layers.findIndex((l) => l.id === dragItem.current);
        const overIdx = layers.findIndex((l) => l.id === dragOverItem.current);
        if (dragIdx < overIdx) {
            for (let i = dragIdx; i < overIdx; i++) moveLayer(dragItem.current, 'down');
        } else {
            for (let i = dragIdx; i > overIdx; i--) moveLayer(dragItem.current, 'up');
        }
        dragItem.current = null;
        dragOverItem.current = null;
    };

    return (
        <div className="layer-panel">
            <div className="layer-panel__header">
                <h3>Layers</h3>
                <div className="layer-panel__actions">
                    <button
                        className="layer-panel__btn"
                        onClick={() => setShowAddMenu(!showAddMenu)}
                        title="Add layer"
                    >
                        +
                    </button>
                </div>
            </div>

            {showAddMenu && (
                <div className="layer-panel__add-menu">
                    {patternTypeList.map((type: PatternType) => {
                        const def = patternRegistry[type];
                        return (
                            <button
                                key={type}
                                className="layer-panel__add-item"
                                onClick={() => {
                                    addLayer(type);
                                    setShowAddMenu(false);
                                }}
                            >
                                <span className="layer-panel__add-icon">{def.icon}</span>
                                {def.label}
                            </button>
                        );
                    })}
                </div>
            )}

            <div className="layer-panel__list">
                {layers.map((layer) => (
                    <div
                        key={layer.id}
                        className={`layer-panel__item ${selectedLayerId === layer.id ? 'selected' : ''}`}
                        onClick={() => setSelectedLayer(layer.id)}
                        draggable
                        onDragStart={() => handleDragStart(layer.id)}
                        onDragOver={(e) => handleDragOver(e, layer.id)}
                        onDrop={handleDrop}
                    >
                        <button
                            className={`layer-panel__visibility ${layer.visible ? '' : 'hidden'}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                updateLayer(layer.id, { visible: !layer.visible });
                            }}
                            title={layer.visible ? 'Hide' : 'Show'}
                        >
                            {layer.visible ? '◉' : '○'}
                        </button>
                        <span className="layer-panel__icon">{patternRegistry[layer.type].icon}</span>
                        <span className="layer-panel__name">{layer.name}</span>
                        <div className="layer-panel__item-actions">
                            <button
                                className="layer-panel__item-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    duplicateLayer(layer.id);
                                }}
                                title="Duplicate"
                            >
                                ⧉
                            </button>
                            <button
                                className="layer-panel__item-btn danger"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removeLayer(layer.id);
                                }}
                                title="Remove"
                            >
                                ×
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {layers.length === 0 && (
                <div className="layer-panel__empty">
                    No layers yet. Click + to add one.
                </div>
            )}
        </div>
    );
}
