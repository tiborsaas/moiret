import { useMemo } from 'react';
import type { Layer, CanvasSettings, SvgElement } from '../types';
import { patternRegistry } from '../patterns';

interface SvgRendererProps {
    layers: Layer[];
    canvas: CanvasSettings;
    svgRef?: React.RefObject<SVGSVGElement | null>;
    /** If set, only render this layer (for per-layer export) */
    soloLayerId?: string;
    selectedLayerId?: string | null;
    onSelectLayer?: (id: string) => void;
}

function renderElement(el: SvgElement, idx: number, stroke: string, strokeWidth: number) {
    const key = `${el.type}-${idx}`;
    const commonStyle = {
        stroke: el.attrs.fill === 'currentColor' ? 'none' : stroke,
        strokeWidth: el.attrs.fill === 'currentColor' ? 0 : strokeWidth,
    };

    switch (el.type) {
        case 'circle':
            return (
                <circle
                    key={key}
                    cx={el.attrs.cx as number}
                    cy={el.attrs.cy as number}
                    r={el.attrs.r as number}
                    fill={el.attrs.fill === 'currentColor' ? stroke : (el.attrs.fill as string) || 'none'}
                    {...commonStyle}
                />
            );
        case 'line':
            return (
                <line
                    key={key}
                    x1={el.attrs.x1 as number}
                    y1={el.attrs.y1 as number}
                    x2={el.attrs.x2 as number}
                    y2={el.attrs.y2 as number}
                    {...commonStyle}
                />
            );
        case 'path':
            return (
                <path
                    key={key}
                    d={el.attrs.d as string}
                    fill={(el.attrs.fill as string) || 'none'}
                    {...commonStyle}
                />
            );
        case 'rect':
            return (
                <rect
                    key={key}
                    x={el.attrs.x as number}
                    y={el.attrs.y as number}
                    width={el.attrs.width as number}
                    height={el.attrs.height as number}
                    fill={(el.attrs.fill as string) || 'none'}
                    {...commonStyle}
                />
            );
        default:
            return null;
    }
}

interface LayerGroupProps {
    layer: Layer;
    width: number;
    height: number;
    isSelected?: boolean;
    onSelectLayer?: (id: string) => void;
}

function LayerGroup({ layer, width, height, isSelected, onSelectLayer }: LayerGroupProps) {
    const elements = useMemo(() => {
        const def = patternRegistry[layer.type];
        if (!def) return [];
        return def.generate(layer.params, width, height);
    }, [layer.type, layer.params, width, height]);

    const cx = width / 2;
    const cy = height / 2;

    return (
        <g
            style={{
                opacity: layer.opacity,
                mixBlendMode: layer.blendMode as React.CSSProperties['mixBlendMode'],
            }}
            transform={`translate(${cx + layer.offsetX}, ${cy + layer.offsetY}) rotate(${layer.rotation}) scale(${layer.scale}) translate(${-cx}, ${-cy})`}
            onMouseDown={(e) => {
                if (onSelectLayer && e.button === 0 && !e.altKey) {
                    onSelectLayer(layer.id);
                }
            }}
        >
            {elements.map((el, i) => renderElement(el, i, layer.strokeColor, layer.strokeWidth))}
            {isSelected && (
                <rect
                    x={0}
                    y={0}
                    width={width}
                    height={height}
                    fill="none"
                    stroke="#00f0ff"
                    strokeWidth={1.5 / Math.max(0.001, layer.scale)}
                    strokeDasharray={`${6 / Math.max(0.001, layer.scale)} ${4 / Math.max(0.001, layer.scale)}`}
                    opacity={0.6}
                    pointerEvents="none"
                />
            )}
        </g>
    );
}

export function SvgRenderer({ layers, canvas, svgRef, soloLayerId, selectedLayerId, onSelectLayer }: SvgRendererProps) {
    const visibleLayers = soloLayerId
        ? layers.filter((l) => l.id === soloLayerId)
        : layers.filter((l) => l.visible);

    return (
        <svg
            ref={svgRef}
            xmlns="http://www.w3.org/2000/svg"
            width={canvas.width}
            height={canvas.height}
            viewBox={`0 0 ${canvas.width} ${canvas.height}`}
            style={{ backgroundColor: canvas.backgroundColor }}
        >
            <rect width={canvas.width} height={canvas.height} fill={canvas.backgroundColor} />
            {visibleLayers.map((layer) => (
                <LayerGroup
                    key={layer.id}
                    layer={layer}
                    width={canvas.width}
                    height={canvas.height}
                    isSelected={!soloLayerId && layer.id === selectedLayerId}
                    onSelectLayer={onSelectLayer}
                />
            ))}
        </svg>
    );
}
