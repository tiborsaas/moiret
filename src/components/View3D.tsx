import { useEffect, useRef, useCallback, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { usePatternStore } from '../store/patternStore';
import { buildLayerSvgString, svgStringToCanvasTexture } from './view3d/layerTexture';
import {
    buildCompositeEtchCanvas,
    buildCrystalPlate,
    buildHeadLamp,
    disposeHeadLamp,
    disposeCrystalMesh,
    getEtchShaderMat,
    type EtchShaderParams,
    type HeadLamp,
    DEFAULT_ETCH_SHADER_PARAMS,
} from './view3d/crystalScene';
import './View3D.css';

// ─── Procedural walnut wood texture ──────────────────────────────────────────

const _P: number[] = [];
(function () {
    const base = Array.from({ length: 256 }, (_, i) => i);
    let seed = 42;
    const rng = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; };
    for (let i = 255; i > 0; i--) { const j = Math.floor(rng() * (i + 1));[base[i], base[j]] = [base[j], base[i]]; }
    for (let i = 0; i < 512; i++) _P[i] = base[i & 255];
})();

const _fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const _lerp = (a: number, b: number, t: number) => a + t * (b - a);
const _grad = (h: number, x: number, y: number) => {
    const u = (h & 2) ? y : x;
    const v = (h & 2) ? x : y;
    return ((h & 1) ? -u : u) + ((h & 4) ? -v : v);
};

function _noise2(x: number, y: number): number {
    const xi = Math.floor(x) & 255, yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x), yf = y - Math.floor(y);
    const u = _fade(xf), v = _fade(yf);
    const aa = _P[_P[xi] + yi], ab = _P[_P[xi] + yi + 1];
    const ba = _P[_P[xi + 1] + yi], bb = _P[_P[xi + 1] + yi + 1];
    return _lerp(
        _lerp(_grad(aa, xf, yf), _grad(ba, xf - 1, yf), u),
        _lerp(_grad(ab, xf, yf - 1), _grad(bb, xf - 1, yf - 1), u),
        v
    );
}

function _fbm(x: number, y: number, oct: number, lac = 2.0, gain = 0.5): number {
    let val = 0, amp = 1.0, freq = 1.0, norm = 0;
    for (let i = 0; i < oct; i++) {
        val += amp * _noise2(x * freq, y * freq);
        norm += amp;
        amp *= gain;
        freq *= lac;
    }
    return val / norm;
}

const _WALNUT: readonly [number, number, number][] = [
    [0x06, 0x03, 0x01],  // near-black heartwood
    [0x0e, 0x07, 0x02],  // very dark espresso
    [0x18, 0x0c, 0x04],  // dark walnut
    [0x24, 0x12, 0x06],  // mid-dark walnut
    [0x30, 0x19, 0x08],  // lighter grain highlight
    [0x1a, 0x0d, 0x04],  // back to dark
];

function _walnutColor(t: number): [number, number, number] {
    const s = Math.max(0, Math.min(0.9999, t)) * (_WALNUT.length - 1);
    const i = Math.floor(s), f = s - i;
    const a = _WALNUT[i], b = _WALNUT[Math.min(i + 1, _WALNUT.length - 1)];
    return [
        Math.round(_lerp(a[0], b[0], f)),
        Math.round(_lerp(a[1], b[1], f)),
        Math.round(_lerp(a[2], b[2], f)),
    ];
}

// ─── Wood texture / material parameters ────────────────────────────────────
export interface WoodTextureParams {
    nPlanks: number; // planks across the floor
    groove: number; // groove fraction (0–0.05)
    ringFreq: number; // ring periods per plank
    grainFreq: number; // grain periods along U
    ringWarp: number; // lateral warp amplitude
    grainWarp: number; // longitudinal warp amplitude
    ringWeight: number; // ring contribution to height
    grainWeight: number; // grain fibre contribution
    poreFreqU: number; // pore noise U frequency
    poreFreqV: number; // pore noise V frequency
    poreAmt: number; // pore noise amplitude
    normalKernel: number; // central-diff kernel radius (px)
    normalStrU: number; // normal strength along grain
    normalStrV: number; // normal strength across grain
    roughMin: number; // roughness for smooth early-wood
    roughMax: number; // roughness for rough late-wood
}

export interface WoodMaterialParams {
    normalScaleU: number;
    normalScaleV: number;
    clearcoat: number;
    clearcoatRoughness: number;
    ccNormalScaleU: number;
    ccNormalScaleV: number;
    metalness: number;
}

const DEFAULT_WOOD_TEXTURE_PARAMS: WoodTextureParams = {
    nPlanks: 8, groove: 0.050,
    ringFreq: 68, grainFreq: 3,
    ringWarp: 1.05, grainWarp: 0.085,
    ringWeight: 0.35, grainWeight: 0.56,
    poreFreqU: 22, poreFreqV: 29, poreAmt: 0.026,
    normalKernel: 1, normalStrU: 0.8, normalStrV: 0.8,
    roughMin: 0.14, roughMax: 0.89,
};

const DEFAULT_WOOD_MATERIAL_PARAMS: WoodMaterialParams = {
    normalScaleU: 0.25, normalScaleV: 1.55,
    clearcoat: 0.02, clearcoatRoughness: 0.24,
    ccNormalScaleU: 1.65, ccNormalScaleV: 5.35,
    metalness: 0.11,
};

// W=2048 (grain/U axis), H=512 (cross-grain/V axis), parametric, no tiling
// Returns diffuse + normal map + roughness map for PBR floor material
function generateWoodTexture(tp: WoodTextureParams): { diffuse: THREE.CanvasTexture; normalMap: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture } {
    const W = 2048, H = 512;
    const N_PLANKS = tp.nPlanks;
    const GROOVE = tp.groove;

    // ── Pass 1: compute height field ─────────────────────────────────────────
    const heights = new Float32Array(W * H);
    for (let py = 0; py < H; py++) {
        const ny = py / H;
        const pF = ny * N_PLANKS;
        const pIdx = Math.min(Math.floor(pF), N_PLANKS - 1);
        const pLoc = pF - pIdx;

        const grooveDark = pLoc < GROOVE ? (1 - pLoc / GROOVE) * 0.9 : 0;
        const sx = pIdx * 17.3 + 2.9;
        const sy = pIdx * 11.7 + 1.3;
        const pBright = 1.0 + (_noise2(pIdx * 5.1 + 0.5, 3.7) * 0.06);

        for (let px = 0; px < W; px++) {
            const nx = px / W;
            const gx = nx * tp.grainFreq;
            const gy = pLoc * tp.ringFreq;

            const wx = _fbm(gx + sx, gy * 0.06 + sy, 3, 2.0, 0.5) * tp.grainWarp;
            const wy = _fbm(gx * 0.18 + sx + 4.5, pLoc * 1.8 + sy + 3.2, 4, 2.0, 0.5) * tp.ringWarp;

            // Annual rings: sine bands running along U axis
            const ringCoord = gy + wy;
            const rings = Math.sin(ringCoord * Math.PI);
            const ringRaw = (rings + 1) * 0.5;
            // Bias toward dark late-wood bands (non-linear mapping)
            const ringVal = ringRaw < 0.35
                ? ringRaw * 0.65
                : 0.228 + (ringRaw - 0.35) * 0.57;

            // Fine grain fibres: very elongated along U, barely vary in V
            const fgx = gx * 4.0 + wx + sx;
            const fgy = gy * 0.04 + wy * 0.02 + sy;   // almost no V variation → long straight streaks
            const grain = (_fbm(fgx, fgy, 6, 2.1, 0.48) + 1) * 0.5;

            const pore = _fbm(nx * tp.poreFreqU + sx, pLoc * tp.poreFreqV + sy, 2) * tp.poreAmt;

            let t = ringVal * tp.ringWeight + grain * tp.grainWeight + pore;
            t = Math.max(0, Math.min(1, t * pBright));
            t = Math.max(0, t * (1 - grooveDark));
            heights[py * W + px] = t;
        }
    }

    // ── Pass 2: diffuse + nearly-flat normal map + roughness map ─────────────
    const diffCvs = document.createElement('canvas');
    diffCvs.width = W; diffCvs.height = H;
    const diffCtx = diffCvs.getContext('2d')!;
    const diffImg = diffCtx.createImageData(W, H);
    const dd = diffImg.data;

    const normCvs = document.createElement('canvas');
    normCvs.width = W; normCvs.height = H;
    const normCtx = normCvs.getContext('2d')!;
    const normImg = normCtx.createImageData(W, H);
    const nd = normImg.data;

    // Roughness map: early wood (light rings, high t) → smooth → dark pixel → low roughness
    //                late wood  (dark rings, low t)  → rough  → light pixel → high roughness
    const roughCvs = document.createElement('canvas');
    roughCvs.width = W; roughCvs.height = H;
    const roughCtx = roughCvs.getContext('2d')!;
    const roughImg = roughCtx.createImageData(W, H);
    const rd = roughImg.data;

    for (let py = 0; py < H; py++) {
        for (let px = 0; px < W; px++) {
            const i = py * W + px;
            const t = heights[i];

            // Diffuse colour
            const [r, g, b] = _walnutColor(t);
            dd[i * 4] = r;
            dd[i * 4 + 1] = g;
            dd[i * 4 + 2] = b;
            dd[i * 4 + 3] = 255;

            const _k = Math.max(1, Math.round(tp.normalKernel));
            const tL = heights[py * W + Math.max(px - _k, 0)];
            const tR = heights[py * W + Math.min(px + _k, W - 1)];
            const tU = heights[Math.max(py - _k, 0) * W + px];
            const tD = heights[Math.min(py + _k, H - 1) * W + px];
            const dX = (tR - tL) * tp.normalStrU;
            const dY = (tD - tU) * tp.normalStrV;
            const inv = 1.0 / Math.sqrt(dX * dX + dY * dY + 1.0);
            nd[i * 4] = Math.round((-dX * inv * 0.5 + 0.5) * 255);
            nd[i * 4 + 1] = Math.round((-dY * inv * 0.5 + 0.5) * 255);
            nd[i * 4 + 2] = Math.round((inv * 0.5 + 0.5) * 255);
            nd[i * 4 + 3] = 255;

            // Roughness map:
            //   light early-wood (high t) → polished → roughness ~0.20
            //   dark late-wood  (low t)  → matte    → roughness ~0.78
            // THREE reads this as a linear grayscale value [0,1]
            const rough = _lerp(tp.roughMin, tp.roughMax, 1.0 - t);
            const roughByte = Math.round(rough * 255);
            rd[i * 4] = roughByte;
            rd[i * 4 + 1] = roughByte;
            rd[i * 4 + 2] = roughByte;
            rd[i * 4 + 3] = 255;
        }
    }

    diffCtx.putImageData(diffImg, 0, 0);
    normCtx.putImageData(normImg, 0, 0);
    roughCtx.putImageData(roughImg, 0, 0);

    const mkTex = (cvs: HTMLCanvasElement) => {
        const tex = new THREE.CanvasTexture(cvs);
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.anisotropy = 16;
        tex.needsUpdate = true;
        return tex;
    };

    return { diffuse: mkTex(diffCvs), normalMap: mkTex(normCvs), roughnessMap: mkTex(roughCvs) };
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SceneRefs {
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    plexiGroup: THREE.Group;
    crystalGroup: THREE.Group;
    headLamp: HeadLamp | null;
    sceneLights: THREE.Light[];
    rafId: number;
    floor: THREE.Mesh;
    floorMat: THREE.MeshPhysicalMaterial;
    woodTextures: { diffuse: THREE.CanvasTexture; normalMap: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture };
    refractionTarget: THREE.WebGLRenderTarget;
    etchShaderMats: THREE.ShaderMaterial[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FLOOR_Y_OFFSET = -60;   // below the sheet stack
const CAMERA_MIN_DISTANCE = 100;
const CAMERA_MAX_DISTANCE = 2000;
const CAMERA_DEFAULT_DISTANCE = CAMERA_MAX_DISTANCE * 0.8;
const PLEXI_BASEPLATE_NAME = 'plexiBaseplate';
const CRYSTAL_BASEPLATE_NAME = 'crystalBaseplate';
const PLEXI_BASEPLATE_HEIGHT = 12;
const PLEXI_BASEPLATE_Y_GAP = 8;
const PLEXI_BASEPLATE_WIDTH_PADDING = 28;
const PLEXI_BASEPLATE_DEPTH_PADDING = 40;

function getStackDepth(sheetCount: number, spacing: number): number {
    return Math.max(0, (sheetCount - 1) * spacing);
}

function getBaseplateDepth(sheetCount: number, spacing: number): number {
    return Math.max(24, getStackDepth(sheetCount, spacing) + PLEXI_BASEPLATE_DEPTH_PADDING);
}

function buildStackBaseplate(
    name: string,
    W: number,
    H: number,
    sheetCount: number,
    spacing: number,
): THREE.Mesh {
    const stackDepth = getStackDepth(sheetCount, spacing);
    const baseGeo = new THREE.BoxGeometry(W + PLEXI_BASEPLATE_WIDTH_PADDING, PLEXI_BASEPLATE_HEIGHT, 1);
    const baseMat = new THREE.MeshStandardMaterial({
        color: 0x050505,
        roughness: 0.82,
        metalness: 0.06,
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.name = name;
    baseMesh.position.set(
        0,
        (-H / 2 - PLEXI_BASEPLATE_Y_GAP - PLEXI_BASEPLATE_HEIGHT / 2) - 15,
        -stackDepth / 2,
    );
    baseMesh.scale.y = 5;
    baseMesh.scale.z = getBaseplateDepth(sheetCount, spacing);
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    return baseMesh;
}

// ─── Dev panel slider row ─────────────────────────────────────────────────────

function DevRow({ label, value, min, max, step, onChange }: {
    label: string; value: number; min: number; max: number; step: number;
    onChange: (v: number) => void;
}) {
    const decimals = step < 0.01 ? 3 : step < 0.1 ? 2 : step < 1 ? 1 : 0;
    return (
        <div className="view3d__devrow">
            <span className="view3d__devrow-label">{label}</span>
            <input
                type="range" min={min} max={max} step={step} value={value}
                className="view3d__devrow-slider"
                onChange={(e) => onChange(Number(e.target.value))}
            />
            <span className="view3d__devrow-value">{value.toFixed(decimals)}</span>
        </div>
    );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function View3D() {
    const layers = usePatternStore((s) => s.layers);
    const canvas = usePatternStore((s) => s.canvas);
    const plexiSpacing = usePatternStore((s) => s.plexiSpacing);
    const setPlexiSpacing = usePatternStore((s) => s.setPlexiSpacing);
    const render3DMode = usePatternStore((s) => s.render3DMode);

    const [showDevPanel, setShowDevPanel] = useState(false);
    const [showEtchPanel, setShowEtchPanel] = useState(false);
    const [woodTexParams, setWoodTexParams] = useState<WoodTextureParams>(DEFAULT_WOOD_TEXTURE_PARAMS);
    const [woodMatParams, setWoodMatParams] = useState<WoodMaterialParams>(DEFAULT_WOOD_MATERIAL_PARAMS);
    const [etchParams, setEtchParams] = useState<EtchShaderParams>(DEFAULT_ETCH_SHADER_PARAMS);
    const woodTexParamsRef = useRef(woodTexParams);
    const woodMatParamsRef = useRef(woodMatParams);
    const etchParamsRef = useRef(etchParams);

    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const sceneRefs = useRef<SceneRefs | null>(null);
    // Keep a ref to the latest plexiSpacing for the RAF loop without causing re-renders
    const spacingRef = useRef(plexiSpacing);
    const buildTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const crystalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const woodRegenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isFirstWoodRegen = useRef(true);

    useEffect(() => {
        woodTexParamsRef.current = woodTexParams;
    }, [woodTexParams]);

    useEffect(() => {
        woodMatParamsRef.current = woodMatParams;
    }, [woodMatParams]);

    useEffect(() => {
        spacingRef.current = plexiSpacing;
    }, [plexiSpacing]);

    useEffect(() => {
        etchParamsRef.current = etchParams;
    }, [etchParams]);

    const applyEtchParamsToMaterial = useCallback((mat: THREE.ShaderMaterial, params: EtchShaderParams) => {
        mat.uniforms.uRefractionStrength.value = params.refractionStrength;
        mat.uniforms.uFrostBlend.value = params.frostBlend;
        mat.uniforms.uFrostFresnelAdd.value = params.frostFresnelAdd;
        mat.uniforms.uSpecularStrength.value = params.specularStrength;
        mat.uniforms.uFresnelPower.value = params.fresnelPower;
        mat.uniforms.uBaseAlpha.value = params.baseAlpha;
        mat.uniforms.uFresnelAlphaAdd.value = params.fresnelAlphaAdd;
        mat.uniforms.uLampFalloffStrength.value = params.lampFalloffStrength;
        mat.uniforms.uLampMinLight.value = params.lampMinLight;
        mat.uniforms.uLampWrap.value = params.lampWrap;
        mat.uniforms.uLampVerticalBias.value = params.lampVerticalBias;
    }, []);

    // ── Initialise Three.js scene (once on mount) ─────────────────────────────
    useEffect(() => {
        if (!containerRef.current || !canvasRef.current) return;

        const container = containerRef.current;
        const w = container.clientWidth;
        const h = container.clientHeight;

        // Renderer
        const renderer = new THREE.WebGLRenderer({
            canvas: canvasRef.current,
            antialias: true,
            alpha: false,
        });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(w, h);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.1;

        // Scene
        const scene = new THREE.Scene();

        // Camera
        const camera = new THREE.PerspectiveCamera(50, w / h, 1, 5000);
        camera.position.set(0, 60, CAMERA_DEFAULT_DISTANCE);
        camera.lookAt(0, 0, 0);

        // Controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.06;
        controls.minDistance = CAMERA_MIN_DISTANCE;
        controls.maxDistance = CAMERA_MAX_DISTANCE;
        controls.target.set(0, 0, 0);

        // ── Lighting ──────────────────────────────────────────────────────────
        const ambient = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambient);

        const keyLight = new THREE.DirectionalLight(0xfff8f0, 1.4);
        keyLight.position.set(300, 400, 200);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.set(1024, 1024);
        scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight(0x8899ff, 0.4);
        fillLight.position.set(-300, 100, 100);
        scene.add(fillLight);

        const rimLight = new THREE.DirectionalLight(0xffffff, 0.3);
        rimLight.position.set(0, -200, -300);
        scene.add(rimLight);

        // Kept together so the mode-toggle effect can hide them all at once
        const sceneLights: THREE.Light[] = [ambient, keyLight, fillLight, rimLight];

        // ── Studio floor ──────────────────────────────────────────────────────
        const initWoodTextures = generateWoodTexture(woodTexParamsRef.current);
        const { diffuse: woodTex, normalMap: woodNorm, roughnessMap: woodRough } = initWoodTextures;
        const floorGeo = new THREE.PlaneGeometry(4000, 4000);
        const iMat = woodMatParamsRef.current;
        const floorMat = new THREE.MeshPhysicalMaterial({
            map: woodTex,
            normalMap: woodNorm,
            normalScale: new THREE.Vector2(iMat.normalScaleU, iMat.normalScaleV),
            roughnessMap: woodRough,
            roughness: 1.0,
            metalness: iMat.metalness,
            clearcoat: iMat.clearcoat,
            clearcoatRoughness: iMat.clearcoatRoughness,
            clearcoatNormalMap: woodNorm,
            clearcoatNormalScale: new THREE.Vector2(iMat.ccNormalScaleU, iMat.ccNormalScaleV),
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = FLOOR_Y_OFFSET - canvas.height / 2;
        floor.receiveShadow = true;
        scene.add(floor);

        // Background colour matching the CSS gradient centre
        scene.background = new THREE.Color(0x000000);

        // ── Plexi group (sheets rebuilt when layers/spacing changes) ──────────
        const plexiGroup = new THREE.Group();
        scene.add(plexiGroup);

        // ── Crystal group (hidden until crystal mode is active) ───────────────
        const crystalGroup = new THREE.Group();
        crystalGroup.visible = false;
        scene.add(crystalGroup);

        // ── Head lamp (hidden until etched mode is active) ──────────────────────
        // Built lazily when canvas dimensions are known; null until first build.
        // We create a placeholder here; it is replaced in buildCrystal().
        const headLamp: HeadLamp | null = null;

        // ── Screen-space refraction render target ─────────────────────────────
        const drawSize = renderer.getDrawingBufferSize(new THREE.Vector2());
        const refractionTarget = new THREE.WebGLRenderTarget(drawSize.x, drawSize.y, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
        });

        // ── Animation loop ────────────────────────────────────────────────────
        let rafId = 0;
        const fallbackLampPos = new THREE.Vector3(0, 200, 0);
        const fallbackLampNormal = new THREE.Vector3(0, -1, 0);
        const lampPos = new THREE.Vector3();
        const lampNormal = new THREE.Vector3();
        const lampQuat = new THREE.Quaternion();
        function animate() {
            rafId = requestAnimationFrame(animate);
            controls.update();

            // Live lamp uniforms + two-pass render for screen-space refraction.
            const refs = sceneRefs.current;
            if (refs && refs.etchShaderMats.length > 0) {
                const lamp = refs.headLamp;
                if (lamp) {
                    lamp.light.getWorldPosition(lampPos);
                    lamp.light.getWorldQuaternion(lampQuat);
                    // RectAreaLight emits along local -Z; rotate it to world space.
                    lampNormal.set(0, 0, -1).applyQuaternion(lampQuat).normalize();
                } else {
                    lampPos.copy(fallbackLampPos);
                    lampNormal.copy(fallbackLampNormal);
                }
                const lampIntensity = lamp && lamp.light.visible ? lamp.light.intensity : 0.0;

                refs.etchShaderMats.forEach((mat) => {
                    mat.uniforms.uLampWorldPos.value.copy(lampPos);
                    mat.uniforms.uLampNormal.value.copy(lampNormal);
                    mat.uniforms.uLampIntensity.value = lampIntensity;
                });

                if (crystalGroup.visible) {
                    // Pass 1: render scene without crystal plates → refraction target
                    crystalGroup.visible = false;
                    renderer.setRenderTarget(refractionTarget);
                    renderer.render(scene, camera);
                    renderer.setRenderTarget(null);
                    crystalGroup.visible = true;

                    // Feed captured texture into every etch shader
                    const tex = refractionTarget.texture;
                    refs.etchShaderMats.forEach((mat) => {
                        mat.uniforms.uSceneTex.value = tex;
                    });
                }
            }

            renderer.render(scene, camera);
        }
        animate();

        sceneRefs.current = { renderer, scene, camera, controls, plexiGroup, crystalGroup, headLamp, sceneLights, rafId, floor, floorMat, woodTextures: initWoodTextures, refractionTarget, etchShaderMats: [] };

        // ── Resize observer ───────────────────────────────────────────────────
        const ro = new ResizeObserver(() => {
            if (!containerRef.current) return;
            const w2 = containerRef.current.clientWidth;
            const h2 = containerRef.current.clientHeight;
            camera.aspect = w2 / h2;
            camera.updateProjectionMatrix();
            renderer.setSize(w2, h2);
            const ds = renderer.getDrawingBufferSize(new THREE.Vector2());
            refractionTarget.setSize(ds.x, ds.y);
        });
        ro.observe(container);

        return () => {
            cancelAnimationFrame(rafId);
            ro.disconnect();
            controls.dispose();
            if (sceneRefs.current) {
                sceneRefs.current.woodTextures.diffuse.dispose();
                sceneRefs.current.woodTextures.normalMap.dispose();
                sceneRefs.current.woodTextures.roughnessMap.dispose();
                sceneRefs.current.refractionTarget.dispose();
                if (sceneRefs.current.headLamp) disposeHeadLamp(sceneRefs.current.headLamp);
                sceneRefs.current.crystalGroup.traverse((obj) => {
                    if (obj instanceof THREE.Mesh) disposeCrystalMesh(obj as THREE.Mesh);
                });
            }
            renderer.dispose();
            sceneRefs.current = null;
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Rebuild sheets when layers or canvas changes ──────────────────────────
    const buildSheets = useCallback(async () => {
        const refs = sceneRefs.current;
        if (!refs) return;
        const { plexiGroup } = refs;

        const visibleLayers = layers.filter((l) => l.visible);
        const W = canvas.width;
        const H = canvas.height;
        const spacing = spacingRef.current;
        const stackDepth = getStackDepth(visibleLayers.length, spacing);

        // Build all objects into a staged array first — no clearing yet
        const staged: THREE.Object3D[] = [];

        for (let i = 0; i < visibleLayers.length; i++) {
            const layer = visibleLayers[i];
            const z = -i * spacing;

            // ── Plexi base plane ─────────────────────────────────────────────
            const plexiGeo = new THREE.PlaneGeometry(W, H);
            const plexiMat = new THREE.MeshStandardMaterial({
                color: 0x99ccdd,
                transparent: true,
                opacity: 0.06,
                roughness: 0.05,
                metalness: 0.1,
                side: THREE.DoubleSide,
                depthWrite: false,
            });
            const plexiMesh = new THREE.Mesh(plexiGeo, plexiMat);
            plexiMesh.position.z = z;
            plexiMesh.renderOrder = i * 3;
            staged.push(plexiMesh);

            // ── Thin edge lines ──────────────────────────────────────────────
            const edgeGeo = new THREE.EdgesGeometry(plexiGeo);
            const edgeMat = new THREE.LineBasicMaterial({
                color: 0x88ccee,
                transparent: true,
                opacity: 0.55,
            });
            const edges = new THREE.LineSegments(edgeGeo, edgeMat);
            edges.position.z = z + 0.2;
            edges.renderOrder = i * 3 + 1;
            staged.push(edges);

            // ── Pattern texture plane ────────────────────────────────────────
            try {
                const svgStr = buildLayerSvgString(layer, canvas);
                const texture = await svgStringToCanvasTexture(svgStr, W, H);

                const patGeo = new THREE.PlaneGeometry(W, H);
                const patMat = new THREE.MeshBasicMaterial({
                    map: texture,
                    transparent: true,
                    alphaTest: 0.005,
                    side: THREE.DoubleSide,
                    depthWrite: false,
                });
                const patMesh = new THREE.Mesh(patGeo, patMat);
                patMesh.position.z = z + 0.5;
                patMesh.renderOrder = i * 3 + 2;
                staged.push(patMesh);
            } catch (err) {
                console.warn('[View3D] Failed to build texture for layer', layer.id, err);
                // Push placeholder so spacing useEffect index math stays correct
                staged.push(new THREE.Object3D());
            }
        }

        if (visibleLayers.length > 0) {
            const baseMesh = buildStackBaseplate(PLEXI_BASEPLATE_NAME, W, H, visibleLayers.length, spacing);
            baseMesh.castShadow = true;
            baseMesh.receiveShadow = true;
            baseMesh.renderOrder = visibleLayers.length * 3 + 10;
            staged.push(baseMesh);
        }

        // Atomic swap: dispose old, clear, add new — all in one synchronous block
        plexiGroup.traverse((obj) => {
            if (obj instanceof THREE.Mesh) {
                obj.geometry.dispose();
                if (Array.isArray(obj.material)) {
                    obj.material.forEach((m) => m.dispose());
                } else {
                    obj.material.dispose();
                }
            }
        });
        plexiGroup.clear();
        staged.forEach((obj) => plexiGroup.add(obj));

        // Centre the whole stack on Z
        plexiGroup.position.z = stackDepth / 2;
    }, [layers, canvas]);

    // Debounced build: wait 150 ms after the last change before rebuilding (printed mode only)
    useEffect(() => {
        if (render3DMode !== 'printed') return;
        if (buildTimerRef.current) clearTimeout(buildTimerRef.current);
        buildTimerRef.current = setTimeout(() => { buildSheets(); }, 150);
        return () => { if (buildTimerRef.current) clearTimeout(buildTimerRef.current); };
    }, [buildSheets, render3DMode]);

    // ── Etched mode: one thin glass plate per visible layer, stacked like printed ─
    const buildCrystal = useCallback(async () => {
        const refs = sceneRefs.current;
        if (!refs) return;
        const { crystalGroup } = refs;
        const W = canvas.width;
        const H = canvas.height;
        const spacing = spacingRef.current;
        const visibleLayers = layers.filter((l) => l.visible);
        const stackDepth = getStackDepth(visibleLayers.length, spacing);

        // Dispose existing crystal slabs before rebuilding
        crystalGroup.traverse((obj) => {
            if (obj instanceof THREE.Mesh) disposeCrystalMesh(obj as THREE.Mesh);
        });
        crystalGroup.clear();

        const staged: THREE.Object3D[] = [];

        for (let i = 0; i < visibleLayers.length; i++) {
            try {
                // Each layer gets its own thin etched plate
                const etchCanvas = await buildCompositeEtchCanvas([visibleLayers[i]], canvas);
                const plate = buildCrystalPlate(W, H, etchCanvas);
                plate.position.z = -i * spacing;
                staged.push(plate);
            } catch (err) {
                console.warn('[View3D] Failed to build etched slab for layer', visibleLayers[i].id, err);
            }
        }

        if (visibleLayers.length > 0) {
            const baseMesh = buildStackBaseplate(CRYSTAL_BASEPLATE_NAME, W, H, visibleLayers.length, spacing);
            baseMesh.renderOrder = visibleLayers.length * 3 + 10;
            staged.push(baseMesh);
        }

        staged.forEach((m) => crystalGroup.add(m));

        // Register etch shader materials for the two-pass refraction render loop
        const currentEtchParams = etchParamsRef.current;
        refs.etchShaderMats = [];
        staged.forEach((obj) => {
            if (!(obj instanceof THREE.Group)) return;
            const mat = getEtchShaderMat(obj);
            if (!mat) return;
            mat.uniforms.uSceneTex.value = refs.refractionTarget.texture;
            applyEtchParamsToMaterial(mat, currentEtchParams);
            refs.etchShaderMats.push(mat);
        });

        crystalGroup.position.z = stackDepth / 2;

        // ── Build / replace the hanging head lamp ─────────────────────────────
        if (refs.headLamp) {
            disposeHeadLamp(refs.headLamp);
            refs.scene.remove(refs.headLamp.light, refs.headLamp.mesh);
        }
        const lamp = buildHeadLamp(W, H);
        lamp.light.visible = true;
        lamp.mesh.visible = true;
        refs.scene.add(lamp.light, lamp.mesh);
        refs.headLamp = lamp;
    }, [layers, canvas, applyEtchParamsToMaterial]);

    // ── Toggle scene elements when render mode changes ────────────────────────
    useEffect(() => {
        const refs = sceneRefs.current;
        if (!refs) return;
        const isEtched = render3DMode === 'etched';
        refs.plexiGroup.visible = !isEtched;
        refs.crystalGroup.visible = isEtched;
        // In etched mode only the headlamp provides light; hide all scene lights
        refs.sceneLights.forEach((l) => { l.visible = !isEtched; });
        if (refs.headLamp) {
            refs.headLamp.light.visible = isEtched;
            refs.headLamp.mesh.visible = isEtched;
        }
    }, [render3DMode]);

    // ── Rebuild etched plates when layers/canvas change or mode switches to etched ─
    useEffect(() => {
        if (render3DMode !== 'etched') return;
        if (crystalTimerRef.current) clearTimeout(crystalTimerRef.current);
        crystalTimerRef.current = setTimeout(() => { buildCrystal(); }, 150);
        return () => { if (crystalTimerRef.current) clearTimeout(crystalTimerRef.current); };
    }, [buildCrystal, render3DMode]);
    // ── Rebuild wood textures when procedural params change (debounced, CPU heavy) ───
    const rebuildWoodTextures = useCallback(() => {
        const refs = sceneRefs.current;
        if (!refs) return;
        const { floorMat, woodTextures } = refs;
        woodTextures.diffuse.dispose();
        woodTextures.normalMap.dispose();
        woodTextures.roughnessMap.dispose();
        const next = generateWoodTexture(woodTexParamsRef.current);
        floorMat.map = next.diffuse;
        floorMat.normalMap = next.normalMap;
        floorMat.roughnessMap = next.roughnessMap;
        floorMat.clearcoatNormalMap = next.normalMap;
        floorMat.needsUpdate = true;
        refs.woodTextures = next;
    }, []);

    useEffect(() => {
        if (isFirstWoodRegen.current) { isFirstWoodRegen.current = false; return; }
        if (woodRegenTimerRef.current) clearTimeout(woodRegenTimerRef.current);
        woodRegenTimerRef.current = setTimeout(rebuildWoodTextures, 300);
        return () => { if (woodRegenTimerRef.current) clearTimeout(woodRegenTimerRef.current); };
    }, [woodTexParams, rebuildWoodTextures]);
    // ── Live-update etch shader uniforms when params change ─────────────────────
    useEffect(() => {
        const refs = sceneRefs.current;
        if (!refs) return;
        refs.etchShaderMats.forEach((mat) => {
            applyEtchParamsToMaterial(mat, etchParams);
        });
    }, [etchParams, applyEtchParamsToMaterial]);
    // ── Live-update material properties (no texture regen needed) ───────────────
    useEffect(() => {
        const refs = sceneRefs.current;
        if (!refs) return;
        const mat = refs.floorMat;
        const mp = woodMatParams;
        mat.normalScale.set(mp.normalScaleU, mp.normalScaleV);
        mat.clearcoat = mp.clearcoat;
        mat.clearcoatRoughness = mp.clearcoatRoughness;
        mat.clearcoatNormalScale.set(mp.ccNormalScaleU, mp.ccNormalScaleV);
        mat.metalness = mp.metalness;
        mat.needsUpdate = true;
    }, [woodMatParams]);
    // ── Update Z positions only when plexiSpacing changes ────────────────────
    useEffect(() => {
        const refs = sceneRefs.current;
        if (!refs) return;
        const { plexiGroup, crystalGroup } = refs;

        // Printed mode: 3-object groups (plexiMesh + edges + patMesh per layer)
        const children = [...plexiGroup.children];
        const groupSize = 3; // plexiMesh + edges + patMesh per layer
        const numSheets = Math.floor(children.length / groupSize);

        for (let i = 0; i < numSheets; i++) {
            const z = -i * plexiSpacing;
            const plexiMesh = children[i * groupSize];
            const edgeMesh = children[i * groupSize + 1];
            const patMesh = children[i * groupSize + 2];
            if (plexiMesh) { plexiMesh.position.z = z; plexiMesh.renderOrder = i * 3; }
            if (edgeMesh) { edgeMesh.position.z = z + 0.2; edgeMesh.renderOrder = i * 3 + 1; }
            if (patMesh) { patMesh.position.z = z + 0.5; patMesh.renderOrder = i * 3 + 2; }
        }

        const totalDepth = getStackDepth(numSheets, plexiSpacing);
        plexiGroup.position.z = totalDepth / 2;

        const baseplate = plexiGroup.getObjectByName(PLEXI_BASEPLATE_NAME);
        if (baseplate instanceof THREE.Mesh) {
            baseplate.position.z = -totalDepth / 2;
            baseplate.scale.z = getBaseplateDepth(numSheets, plexiSpacing);
            baseplate.renderOrder = numSheets * 3 + 10;
        }

        // Etched mode: one slab per layer — just reposition without rebuilding textures
        const crystalChildren = [...crystalGroup.children];
        const crystalPlates = crystalChildren.filter((obj) => obj.name !== CRYSTAL_BASEPLATE_NAME);
        crystalPlates.forEach((obj, i) => { obj.position.z = -i * plexiSpacing; });
        const totalCrystalDepth = getStackDepth(crystalPlates.length, plexiSpacing);
        crystalGroup.position.z = totalCrystalDepth / 2;

        const crystalBaseplate = crystalGroup.getObjectByName(CRYSTAL_BASEPLATE_NAME);
        if (crystalBaseplate instanceof THREE.Mesh) {
            crystalBaseplate.position.z = -totalCrystalDepth / 2;
            crystalBaseplate.scale.z = getBaseplateDepth(crystalPlates.length, plexiSpacing);
            crystalBaseplate.renderOrder = crystalPlates.length * 3 + 10;
        }
    }, [plexiSpacing]);

    return (
        <div className="view3d" ref={containerRef}>
            <canvas ref={canvasRef} className="view3d__canvas" />

            {/* Studio gradient background (CSS, behind canvas) */}
            <div className="view3d__bg" />

            {/* Bottom controls bar: spacing slider */}
            <div className="view3d__controls">
                {/* Sheet spacing — shared by both 3D modes */}
                <label className="view3d__label">Sheet spacing</label>
                <input
                    className="view3d__slider"
                    type="range"
                    min={20}
                    max={300}
                    step={5}
                    value={plexiSpacing}
                    onChange={(e) => setPlexiSpacing(Number(e.target.value))}
                />
                <span className="view3d__value">{plexiSpacing}px</span>
            </div>

            {/* Wood dev panel toggle */}
            <button
                className={`view3d__devtoggle${showDevPanel ? ' view3d__devtoggle--active' : ''}`}
                onClick={() => setShowDevPanel((v) => !v)}
                title="Toggle wood texture dev panel"
            >⚙ Wood</button>

            {/* Etch shader panel toggle (only relevant in etched mode) */}
            <button
                className={`view3d__devtoggle view3d__devtoggle--etch${showEtchPanel ? ' view3d__devtoggle--active' : ''}`}
                onClick={() => setShowEtchPanel((v) => !v)}
                title="Toggle etch shader panel"
            >⚙ Etch</button>

            {showEtchPanel && (() => {
                const setP = (patch: Partial<EtchShaderParams>) => setEtchParams((p) => ({ ...p, ...patch }));
                return (
                    <div className="view3d__devpanel view3d__devpanel--etch">
                        <div className="view3d__devpanel-title">Etch Shader</div>

                        <div className="view3d__devsection">
                            <div className="view3d__devsection-label">Refraction <span className="view3d__live-tag">live</span></div>
                            <DevRow label="Strength" value={etchParams.refractionStrength} min={0} max={0.12} step={0.001} onChange={(v) => setP({ refractionStrength: v })} />
                        </div>

                        <div className="view3d__devsection">
                            <div className="view3d__devsection-label">Lamp Response <span className="view3d__live-tag">live</span></div>
                            <DevRow label="Falloff" value={etchParams.lampFalloffStrength} min={0} max={0.05} step={0.001} onChange={(v) => setP({ lampFalloffStrength: v })} />
                            <DevRow label="Min light" value={etchParams.lampMinLight} min={0} max={1} step={0.01} onChange={(v) => setP({ lampMinLight: v })} />
                            <DevRow label="Wrap" value={etchParams.lampWrap} min={0} max={1} step={0.01} onChange={(v) => setP({ lampWrap: v })} />
                            <DevRow label="Vertical bias" value={etchParams.lampVerticalBias} min={0} max={1} step={0.01} onChange={(v) => setP({ lampVerticalBias: v })} />
                        </div>

                        <div className="view3d__devsection">
                            <div className="view3d__devsection-label">Frost <span className="view3d__live-tag">live</span></div>
                            <DevRow label="Base blend" value={etchParams.frostBlend} min={0} max={1} step={0.01} onChange={(v) => setP({ frostBlend: v })} />
                            <DevRow label="Fresnel add" value={etchParams.frostFresnelAdd} min={0} max={1} step={0.01} onChange={(v) => setP({ frostFresnelAdd: v })} />
                        </div>

                        <div className="view3d__devsection">
                            <div className="view3d__devsection-label">Fresnel <span className="view3d__live-tag">live</span></div>
                            <DevRow label="Power" value={etchParams.fresnelPower} min={0.5} max={8} step={0.1} onChange={(v) => setP({ fresnelPower: v })} />
                        </div>

                        <div className="view3d__devsection">
                            <div className="view3d__devsection-label">Specular Edge <span className="view3d__live-tag">live</span></div>
                            <DevRow label="Strength" value={etchParams.specularStrength} min={0} max={5} step={0.05} onChange={(v) => setP({ specularStrength: v })} />
                        </div>

                        <div className="view3d__devsection">
                            <div className="view3d__devsection-label">Opacity <span className="view3d__live-tag">live</span></div>
                            <DevRow label="Base alpha" value={etchParams.baseAlpha} min={0} max={1} step={0.01} onChange={(v) => setP({ baseAlpha: v })} />
                            <DevRow label="Fresnel add" value={etchParams.fresnelAlphaAdd} min={0} max={1} step={0.01} onChange={(v) => setP({ fresnelAlphaAdd: v })} />
                        </div>

                        <button
                            className="view3d__devreset"
                            onClick={() => setEtchParams(DEFAULT_ETCH_SHADER_PARAMS)}
                        >Reset to defaults</button>
                    </div>
                );
            })()}

            {showDevPanel && (() => {
                const setTP = (patch: Partial<WoodTextureParams>) => setWoodTexParams((p) => ({ ...p, ...patch }));
                const setMP = (patch: Partial<WoodMaterialParams>) => setWoodMatParams((p) => ({ ...p, ...patch }));
                return (
                    <div className="view3d__devpanel">
                        <div className="view3d__devpanel-title">Wood Texture Dev Panel</div>

                        <div className="view3d__devsection">
                            <div className="view3d__devsection-label">Geometry <span className="view3d__regen-tag">regen</span></div>
                            <DevRow label="Planks" value={woodTexParams.nPlanks} min={1} max={12} step={1} onChange={(v) => setTP({ nPlanks: v })} />
                            <DevRow label="Groove" value={woodTexParams.groove} min={0} max={0.05} step={0.001} onChange={(v) => setTP({ groove: v })} />
                        </div>

                        <div className="view3d__devsection">
                            <div className="view3d__devsection-label">Rings & Grain <span className="view3d__regen-tag">regen</span></div>
                            <DevRow label="Ring freq" value={woodTexParams.ringFreq} min={4} max={80} step={1} onChange={(v) => setTP({ ringFreq: v })} />
                            <DevRow label="Grain freq" value={woodTexParams.grainFreq} min={2} max={60} step={1} onChange={(v) => setTP({ grainFreq: v })} />
                            <DevRow label="Ring warp" value={woodTexParams.ringWarp} min={0} max={1.5} step={0.01} onChange={(v) => setTP({ ringWarp: v })} />
                            <DevRow label="Grain warp" value={woodTexParams.grainWarp} min={0} max={0.3} step={0.005} onChange={(v) => setTP({ grainWarp: v })} />
                        </div>

                        <div className="view3d__devsection">
                            <div className="view3d__devsection-label">Weights & Pore <span className="view3d__regen-tag">regen</span></div>
                            <DevRow label="Ring weight" value={woodTexParams.ringWeight} min={0} max={1} step={0.01} onChange={(v) => setTP({ ringWeight: v })} />
                            <DevRow label="Grain weight" value={woodTexParams.grainWeight} min={0} max={1} step={0.01} onChange={(v) => setTP({ grainWeight: v })} />
                            <DevRow label="Pore freq U" value={woodTexParams.poreFreqU} min={2} max={120} step={1} onChange={(v) => setTP({ poreFreqU: v })} />
                            <DevRow label="Pore freq V" value={woodTexParams.poreFreqV} min={1} max={40} step={1} onChange={(v) => setTP({ poreFreqV: v })} />
                            <DevRow label="Pore amount" value={woodTexParams.poreAmt} min={0} max={0.15} step={0.001} onChange={(v) => setTP({ poreAmt: v })} />
                        </div>

                        <div className="view3d__devsection">
                            <div className="view3d__devsection-label">Normal Map <span className="view3d__regen-tag">regen</span></div>
                            <DevRow label="Kernel px" value={woodTexParams.normalKernel} min={1} max={6} step={1} onChange={(v) => setTP({ normalKernel: v })} />
                            <DevRow label="Str U" value={woodTexParams.normalStrU} min={0} max={8} step={0.1} onChange={(v) => setTP({ normalStrU: v })} />
                            <DevRow label="Str V" value={woodTexParams.normalStrV} min={0} max={16} step={0.1} onChange={(v) => setTP({ normalStrV: v })} />
                        </div>

                        <div className="view3d__devsection">
                            <div className="view3d__devsection-label">Roughness Range <span className="view3d__regen-tag">regen</span></div>
                            <DevRow label="Rough min" value={woodTexParams.roughMin} min={0} max={1} step={0.01} onChange={(v) => setTP({ roughMin: v })} />
                            <DevRow label="Rough max" value={woodTexParams.roughMax} min={0} max={1} step={0.01} onChange={(v) => setTP({ roughMax: v })} />
                        </div>

                        <div className="view3d__devsection">
                            <div className="view3d__devsection-label">Material <span className="view3d__live-tag">live</span></div>
                            <DevRow label="Normal U" value={woodMatParams.normalScaleU} min={0} max={3} step={0.05} onChange={(v) => setMP({ normalScaleU: v })} />
                            <DevRow label="Normal V" value={woodMatParams.normalScaleV} min={0} max={8} step={0.05} onChange={(v) => setMP({ normalScaleV: v })} />
                            <DevRow label="Clearcoat" value={woodMatParams.clearcoat} min={0} max={1} step={0.01} onChange={(v) => setMP({ clearcoat: v })} />
                            <DevRow label="CC rough" value={woodMatParams.clearcoatRoughness} min={0} max={1} step={0.01} onChange={(v) => setMP({ clearcoatRoughness: v })} />
                            <DevRow label="CC norm U" value={woodMatParams.ccNormalScaleU} min={0} max={3} step={0.05} onChange={(v) => setMP({ ccNormalScaleU: v })} />
                            <DevRow label="CC norm V" value={woodMatParams.ccNormalScaleV} min={0} max={6} step={0.05} onChange={(v) => setMP({ ccNormalScaleV: v })} />
                            <DevRow label="Metalness" value={woodMatParams.metalness} min={0} max={1} step={0.01} onChange={(v) => setMP({ metalness: v })} />
                        </div>

                        <button
                            className="view3d__devreset"
                            onClick={() => {
                                setWoodTexParams(DEFAULT_WOOD_TEXTURE_PARAMS);
                                setWoodMatParams(DEFAULT_WOOD_MATERIAL_PARAMS);
                            }}
                        >Reset to defaults</button>
                    </div>
                );
            })()}

            <div className="view3d__hint">Drag to orbit · Scroll to zoom · Right-drag to pan</div>
        </div>
    );
}
