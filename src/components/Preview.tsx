import { useRef, useState, useCallback, useEffect } from 'react';
import { usePatternStore } from '../store/patternStore';
import { SvgRenderer } from './SvgRenderer';
import './Preview.css';

export function Preview() {
    const layers = usePatternStore((s) => s.layers);
    const canvas = usePatternStore((s) => s.canvas);
    const selectedLayerId = usePatternStore((s) => s.selectedLayerId);
    const setSelectedLayer = usePatternStore((s) => s.setSelectedLayer);
    const updateLayer = usePatternStore((s) => s.updateLayer);

    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const svgWrapperRef = useRef<HTMLDivElement>(null);

    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [isDraggingLayer, setIsDraggingLayer] = useState(false);

    const panStart = useRef({ x: 0, y: 0, px: 0, py: 0 });
    const dragStart = useRef({ mouseX: 0, mouseY: 0, layerX: 0, layerY: 0 });

    // Expose svgRef globally for export system
    useEffect(() => {
        (window as unknown as Record<string, unknown>).__moiretSvgRef = svgRef;
    }, []);

    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setZoom((z) => Math.max(0.1, Math.min(10, z * delta)));
    }, []);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button === 1 || (e.button === 0 && e.altKey)) {
            setIsPanning(true);
            panStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
            return;
        }

        if (e.button === 0) {
            const isInsideSvgCanvas = svgWrapperRef.current?.contains(e.target as Node);

            if (!isInsideSvgCanvas) {
                // Clicked outside canvas in checkerboard area -> deselect active layers
                setSelectedLayer(null);
                return;
            }

            // Clicked inside SVG canvas area:
            // Get latest selected layer ID from store (updated by layer group's onMouseDown if a specific layer was clicked)
            const currentSelectedId = usePatternStore.getState().selectedLayerId;
            const currentLayers = usePatternStore.getState().layers;

            if (currentSelectedId) {
                const selectedLayer = currentLayers.find((l) => l.id === currentSelectedId);
                if (selectedLayer) {
                    setIsDraggingLayer(true);
                    dragStart.current = {
                        mouseX: e.clientX,
                        mouseY: e.clientY,
                        layerX: selectedLayer.offsetX,
                        layerY: selectedLayer.offsetY,
                    };
                }
            } else {
                // If no layer is currently selected, select top visible layer
                const visibleLayers = currentLayers.filter((l) => l.visible);
                if (visibleLayers.length > 0) {
                    const topLayer = visibleLayers[visibleLayers.length - 1];
                    setSelectedLayer(topLayer.id);
                    setIsDraggingLayer(true);
                    dragStart.current = {
                        mouseX: e.clientX,
                        mouseY: e.clientY,
                        layerX: topLayer.offsetX,
                        layerY: topLayer.offsetY,
                    };
                }
            }
        }
    }, [pan, setSelectedLayer]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (isPanning) {
            setPan({
                x: panStart.current.px + (e.clientX - panStart.current.x),
                y: panStart.current.py + (e.clientY - panStart.current.y),
            });
            return;
        }

        if (isDraggingLayer) {
            const currentSelectedId = usePatternStore.getState().selectedLayerId;
            if (currentSelectedId) {
                const dx = (e.clientX - dragStart.current.mouseX) / zoom;
                const dy = (e.clientY - dragStart.current.mouseY) / zoom;
                const newOffsetX = Math.round((dragStart.current.layerX + dx) * 10) / 10;
                const newOffsetY = Math.round((dragStart.current.layerY + dy) * 10) / 10;

                updateLayer(currentSelectedId, {
                    offsetX: newOffsetX,
                    offsetY: newOffsetY,
                });
            }
        }
    }, [isPanning, isDraggingLayer, zoom, updateLayer]);

    const handleMouseUp = useCallback(() => {
        setIsPanning(false);
        setIsDraggingLayer(false);
    }, []);

    const fitToView = useCallback(() => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        const scaleX = (rect.width - 40) / canvas.width;
        const scaleY = (rect.height - 40) / canvas.height;
        setZoom(Math.min(scaleX, scaleY, 1));
        setPan({ x: 0, y: 0 });
    }, [canvas.width, canvas.height]);

    // Auto-fit on mount
    useEffect(() => {
        fitToView();
    }, [fitToView]);

    const cursorStyle = isPanning
        ? 'grabbing'
        : isDraggingLayer
        ? 'grabbing'
        : selectedLayerId
        ? 'grab'
        : 'default';

    return (
        <div className="preview" ref={containerRef}>
            <div className="preview__controls">
                <button className="preview__btn" onClick={fitToView} title="Fit to view">⊡</button>
                <button className="preview__btn" onClick={() => setZoom(1)} title="100%">1:1</button>
                <span className="preview__zoom">{Math.round(zoom * 100)}%</span>
            </div>
            <div
                className="preview__canvas-area"
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                <div
                    className="preview__svg-wrapper"
                    ref={svgWrapperRef}
                    style={{
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        cursor: cursorStyle,
                    }}
                >
                    <SvgRenderer
                        layers={layers}
                        canvas={canvas}
                        svgRef={svgRef}
                        selectedLayerId={selectedLayerId}
                        onSelectLayer={setSelectedLayer}
                    />
                </div>
            </div>
        </div>
    );
}
