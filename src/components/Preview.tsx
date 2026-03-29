import { useRef, useState, useCallback, useEffect } from 'react';
import { usePatternStore } from '../store/patternStore';
import { SvgRenderer } from './SvgRenderer';
import './Preview.css';

export function Preview() {
    const layers = usePatternStore((s) => s.layers);
    const canvas = usePatternStore((s) => s.canvas);
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const panStart = useRef({ x: 0, y: 0, px: 0, py: 0 });

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
        }
    }, [pan]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isPanning) return;
        setPan({
            x: panStart.current.px + (e.clientX - panStart.current.x),
            y: panStart.current.py + (e.clientY - panStart.current.y),
        });
    }, [isPanning]);

    const handleMouseUp = useCallback(() => {
        setIsPanning(false);
    }, []);

    const fitToView = useCallback(() => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const scaleX = (rect.width - 40) / canvas.width;
        const scaleY = (rect.height - 40) / canvas.height;
        setZoom(Math.min(scaleX, scaleY, 1));
        setPan({ x: 0, y: 0 });
    }, [canvas.width, canvas.height]);

    // Auto-fit on mount
    useEffect(() => {
        fitToView();
    }, [fitToView]);

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
                    style={{
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        cursor: isPanning ? 'grabbing' : 'default',
                    }}
                >
                    <SvgRenderer layers={layers} canvas={canvas} svgRef={svgRef} />
                </div>
            </div>
        </div>
    );
}
