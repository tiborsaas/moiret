import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import type { CanvasSettings, Layer } from "../../types";
import { buildLayerSvgString } from "./layerTexture";

// ─── Composite all visible layers into a single grayscale etch canvas ─────────
// White pixels = etched/frosted, black = clear glass

async function renderLayerToImageData(
    layer: Layer,
    canvas: CanvasSettings,
): Promise<ImageData | null> {
    const { width, height } = canvas;
    const svgString = buildLayerSvgString(layer, canvas);
    if (!svgString) return null;

    const blob = new Blob([svgString], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);

    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const tmp = document.createElement("canvas");
            tmp.width = width;
            tmp.height = height;
            const ctx = tmp.getContext("2d")!;
            ctx.drawImage(img, 0, 0, width, height);
            URL.revokeObjectURL(url);
            resolve(ctx.getImageData(0, 0, width, height));
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(null);
        };
        img.src = url;
    });
}

export async function buildCompositeEtchCanvas(
    layers: Layer[],
    canvas: CanvasSettings,
): Promise<HTMLCanvasElement> {
    const { width: W, height: H } = canvas;
    const visibleLayers = layers.filter((l) => l.visible);

    const outCanvas = document.createElement("canvas");
    outCanvas.width = W;
    outCanvas.height = H;
    const outCtx = outCanvas.getContext("2d")!;
    // Black background = clear glass
    outCtx.fillStyle = "#000000";
    outCtx.fillRect(0, 0, W, H);

    const outImg = outCtx.createImageData(W, H);
    const outData = outImg.data;

    // Initialise output to black (all zeros)
    for (let i = 0; i < outData.length; i += 4) {
        outData[i + 3] = 255;
    }

    for (const layer of visibleLayers) {
        let imgData: ImageData | null = null;
        try {
            imgData = await renderLayerToImageData(layer, canvas);
        } catch {
            continue;
        }
        if (!imgData) continue;

        const src = imgData.data;
        const layerOpacity = layer.opacity;

        for (let i = 0; i < src.length; i += 4) {
            // Any visible pixel contributes to the etch map as white
            const alpha = src[i + 3];
            if (alpha > 20) {
                const contribution = (alpha / 255) * layerOpacity;
                const prev = outData[i] / 255;
                const next = Math.min(1.0, prev + contribution);
                const v = Math.round(next * 255);
                outData[i] = v;
                outData[i + 1] = v;
                outData[i + 2] = v;
            }
        }
    }

    outCtx.putImageData(outImg, 0, 0);
    return outCanvas;
}

// ─── Etch shader parameter types + defaults ───────────────────────────────────

export interface EtchShaderParams {
    refractionStrength: number; // UV offset magnitude
    frostBlend: number; // frost tint opacity at normal incidence
    frostFresnelAdd: number; // extra frost opacity at grazing angles
    specularStrength: number; // groove-edge highlight multiplier
    fresnelPower: number; // Fresnel exponent (higher = sharper rim)
    baseAlpha: number; // base opacity of etched region
    fresnelAlphaAdd: number; // extra alpha added at grazing angles
    lampFalloffStrength: number; // distance attenuation strength
    lampMinLight: number; // minimum etched visibility floor
    lampWrap: number; // wrap lighting for softer angular falloff
    lampVerticalBias: number; // how strongly upper regions are favored
}

export const DEFAULT_ETCH_SHADER_PARAMS: EtchShaderParams = {
    refractionStrength: 0.025,
    frostBlend: 0.39,
    frostFresnelAdd: 0.46,
    specularStrength: 2.2,
    fresnelPower: 3.5,
    baseAlpha: 0.54,
    fresnelAlphaAdd: 0.68,
    lampFalloffStrength: 0.035,
    lampMinLight: 0.54,
    lampWrap: 0.33,
    lampVerticalBias: 0.79,
};

// ─── Screen-space refraction shader ──────────────────────────────────────────

const ETCH_VERT = /* glsl */ `
varying vec2 vUv;
varying vec4 vClipPos;
varying vec3 vViewNormal;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

void main() {
    vUv = uv;
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vViewNormal = normalize(normalMatrix * normal);
    vClipPos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = vClipPos;
}
`;

const ETCH_FRAG = /* glsl */ `
uniform sampler2D uSceneTex;       // scene rendered without crystal plates
uniform sampler2D uEtchTex;        // etch mask  (white = etched)
uniform float uRefractionStrength; // UV perturbation magnitude
uniform float uFrostBlend;         // frost tint at normal incidence
uniform float uFrostFresnelAdd;    // extra frost tint at grazing angles
uniform float uSpecularStrength;   // groove-edge highlight multiplier
uniform float uFresnelPower;       // Fresnel exponent
uniform float uBaseAlpha;          // base opacity of etched region
uniform float uFresnelAlphaAdd;    // extra alpha at grazing angles
uniform vec3 uLampWorldPos;        // lamp world position
uniform vec3 uLampNormal;          // lamp emission direction (world)
uniform float uLampIntensity;      // lamp intensity scalar
uniform float uLampFalloffStrength;// distance attenuation strength
uniform float uLampMinLight;       // minimum etched visibility floor
uniform float uLampWrap;           // wrap lighting term
uniform float uLampVerticalBias;   // upper-region emphasis

varying vec2 vUv;
varying vec4 vClipPos;
varying vec3 vViewNormal;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

void main() {
    float etchMask = texture2D(uEtchTex, vUv).r;
    if (etchMask < 0.01) discard;

    // Screen-space UV derived from clip-space position
    vec2 screenUV = (vClipPos.xy / vClipPos.w) * 0.5 + 0.5;

    // Estimate local slope from etch texture neighborhood.
    vec2 uvStep = max(fwidth(vUv), vec2(1.0 / 2048.0));
    float etchL = texture2D(uEtchTex, vUv - vec2(uvStep.x, 0.0)).r;
    float etchR = texture2D(uEtchTex, vUv + vec2(uvStep.x, 0.0)).r;
    float etchD = texture2D(uEtchTex, vUv - vec2(0.0, uvStep.y)).r;
    float etchU = texture2D(uEtchTex, vUv + vec2(0.0, uvStep.y)).r;
    vec2 etchGrad = vec2(etchR - etchL, etchU - etchD);

    vec2 offset = etchGrad * (uRefractionStrength * 2.0) * etchMask;
    vec3 behindColor = texture2D(uSceneTex, screenUV + offset).rgb;

    // Build an approximate etched normal in world space from etch gradients.
    vec3 dpdx = dFdx(vWorldPos);
    vec3 dpdy = dFdy(vWorldPos);
    vec3 geomNormalWorld = normalize(cross(dpdx, dpdy));
    if (dot(geomNormalWorld, vWorldNormal) < 0.0) geomNormalWorld = -geomNormalWorld;
    vec3 tangentWorld = normalize(dpdx);
    vec3 bitangentWorld = normalize(cross(geomNormalWorld, tangentWorld));
    vec3 etchedNormalWorld = normalize(
        geomNormalWorld
        - tangentWorld * etchGrad.x * 12.0
        - bitangentWorld * etchGrad.y * 12.0
    );

    // Lamp response: distance attenuation + etched normal + lamp facing term.
    vec3 toLampWorld = uLampWorldPos - vWorldPos;
    float lampDistance = length(toLampWorld);
    vec3 fragToLampWorld = lampDistance > 1e-4 ? toLampWorld / lampDistance : vec3(0.0, 1.0, 0.0);
    vec3 lampToFragWorld = -fragToLampWorld;
    vec3 lampNormalWorld = normalize(uLampNormal);

    float wrap = clamp(uLampWrap, 0.0, 1.0);
    float wrappedNdotL = clamp((dot(etchedNormalWorld, fragToLampWorld) + wrap) / (1.0 + wrap), 0.0, 1.0);
    float lampFacing = max(0.0, dot(lampNormalWorld, lampToFragWorld));
    float distanceAtten = 1.0 / (1.0 + uLampFalloffStrength * lampDistance * lampDistance);
    float vertical = clamp(0.5 + 0.5 * fragToLampWorld.y, 0.0, 1.0);
    float verticalAtten = mix(1.0, vertical, clamp(uLampVerticalBias, 0.0, 1.0));
    float intensityNorm = max(0.0, uLampIntensity) / 15.0;

    float lampLight = clamp(wrappedNdotL * lampFacing * distanceAtten * verticalAtten * intensityNorm, 0.0, 1.0);
    float lightFactor = clamp(max(uLampMinLight, lampLight), 0.0, 1.0);

    // Fresnel: more opaque at grazing angles
    vec3 etchedNormalView = normalize((viewMatrix * vec4(etchedNormalWorld, 0.0)).xyz);
    float NdotV = clamp(dot(etchedNormalView, vec3(0.0, 0.0, 1.0)), 0.0, 1.0);
    float fresnel = pow(1.0 - NdotV, uFresnelPower);

    // Frosted tint: blend refracted background with milky blue-white
    vec3 frostTint = vec3(0.88, 0.93, 1.0);
    vec3 color = mix(behindColor, frostTint, uFrostBlend + uFrostFresnelAdd * fresnel);

    // Edge sparkle from etch gradient magnitude (no separate spec-edge texture).
    float edge = smoothstep(0.02, 0.18, length(etchGrad));
    color += vec3(0.08, 0.11, 0.15) * edge * uSpecularStrength * lightFactor;

    // Alpha: semi-opaque in etched region, stronger at grazing angles
    float alpha = etchMask * (uBaseAlpha + uFresnelAlphaAdd * fresnel) * lightFactor;

    gl_FragColor = vec4(color, alpha);
}
`;

// Build the etch ShaderMaterial for a single plate.
// uSceneTex is updated every frame by the two-pass render loop in View3D.
export function createEtchShaderMaterial(
    etchTex: THREE.Texture,
): THREE.ShaderMaterial {
    // Placeholder 1×1 black texture until the render target is ready
    const ph = document.createElement("canvas");
    ph.width = 1;
    ph.height = 1;
    const phTex = new THREE.CanvasTexture(ph);

    return new THREE.ShaderMaterial({
        uniforms: {
            uSceneTex: { value: phTex },
            uEtchTex: { value: etchTex },
            uRefractionStrength: {
                value: DEFAULT_ETCH_SHADER_PARAMS.refractionStrength,
            },
            uFrostBlend: { value: DEFAULT_ETCH_SHADER_PARAMS.frostBlend },
            uFrostFresnelAdd: {
                value: DEFAULT_ETCH_SHADER_PARAMS.frostFresnelAdd,
            },
            uSpecularStrength: {
                value: DEFAULT_ETCH_SHADER_PARAMS.specularStrength,
            },
            uFresnelPower: { value: DEFAULT_ETCH_SHADER_PARAMS.fresnelPower },
            uBaseAlpha: { value: DEFAULT_ETCH_SHADER_PARAMS.baseAlpha },
            uFresnelAlphaAdd: {
                value: DEFAULT_ETCH_SHADER_PARAMS.fresnelAlphaAdd,
            },
            uLampWorldPos: { value: new THREE.Vector3(0, 200, 0) },
            uLampNormal: { value: new THREE.Vector3(0, -1, 0) },
            uLampIntensity: { value: 0.0 },
            uLampFalloffStrength: {
                value: DEFAULT_ETCH_SHADER_PARAMS.lampFalloffStrength,
            },
            uLampMinLight: { value: DEFAULT_ETCH_SHADER_PARAMS.lampMinLight },
            uLampWrap: { value: DEFAULT_ETCH_SHADER_PARAMS.lampWrap },
            uLampVerticalBias: {
                value: DEFAULT_ETCH_SHADER_PARAMS.lampVerticalBias,
            },
        },
        vertexShader: ETCH_VERT,
        fragmentShader: ETCH_FRAG,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
    });
}

// ─── Crystal slab mesh ────────────────────────────────────────────────────────

export const CRYSTAL_PLATE_DEPTH = 14;

// Returns a Group: glass box + etch shader plane.
// The etched shader uses only the scene capture + etch mask textures.
// Call refs.etchShaderMats.push(getEtchShaderMat(plate)!) after building.
export function buildCrystalPlate(
    W: number,
    H: number,
    etchCanvas: HTMLCanvasElement,
): THREE.Group {
    const group = new THREE.Group();

    // ── Glass body ──────────────────────────────────────────────────────
    const boxGeo = new THREE.BoxGeometry(W, H, CRYSTAL_PLATE_DEPTH);
    const boxMat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0xb8d8f0),
        transparent: true,
        opacity: 0.10,
        roughness: 0.04,
        metalness: 0.0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.04,
        reflectivity: 0.6,
        specularColor: new THREE.Color(0xd0e8ff),
        specularIntensity: 1.2,
        depthWrite: false,
    });
    group.add(new THREE.Mesh(boxGeo, boxMat));

    // ── Generate etch mask texture ─────────────────────────────────────
    const mkTex = (cvs: HTMLCanvasElement) => {
        const t = new THREE.CanvasTexture(cvs);
        t.anisotropy = 8;
        t.needsUpdate = true;
        return t;
    };

    const etchTex = mkTex(etchCanvas);

    // ── Etch plane with screen-space refraction shader ─────────────────
    const planeMat = createEtchShaderMaterial(etchTex);
    const planeMesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H), planeMat);
    planeMesh.position.z = CRYSTAL_PLATE_DEPTH / 2 + 0.5;
    group.add(planeMesh);

    return group;
}

// Extract the etch ShaderMaterial from a plate group (the plane mesh).
export function getEtchShaderMat(
    plate: THREE.Group,
): THREE.ShaderMaterial | null {
    for (const child of plate.children) {
        if (
            child instanceof THREE.Mesh &&
            child.material instanceof THREE.ShaderMaterial
        ) {
            return child.material as THREE.ShaderMaterial;
        }
    }
    return null;
}

// ─── Hanging head-lamp: RectAreaLight + physical lamp body ───────────────────
//
// A long rectangular lamp hangs above the plates. Its body is a box that is
// black on all five outer faces and white-emissive on the bottom (the LED panel).
// A RectAreaLight sits flush at the bottom face, casting a soft even glow down.

export interface HeadLamp {
    light: THREE.RectAreaLight;
    mesh: THREE.Mesh;
}

export function buildHeadLamp(plateW: number, plateH: number): HeadLamp {
    RectAreaLightUniformsLib.init();

    // Lamp dimensions — matches plate width, relatively narrow depth
    const lampW = plateW * 0.85 * 1.2;
    const lampD = 60 * 1.2; // depth (Z) of the lamp body
    const lampH = 28; // height (Y) of the lamp body
    const yPos = plateH / 2 + lampH / 2 + 60; // hang above top edge of plates

    // ── Area light ──────────────────────────────────────────────────────
    const light = new THREE.RectAreaLight(0xfff5e8, 15, lampW, lampD);
    light.position.set(0, yPos - lampH / 2, 0); // flush with bottom face
    light.rotation.x = -Math.PI / 2; // points straight down

    // ── Lamp body mesh ──────────────────────────────────────────────────
    // BoxGeometry face order: +X, -X, +Y, -Y, +Z, -Z
    // Face index 3 (–Y) is the bottom = white emissive LED panel.
    const geo = new THREE.BoxGeometry(lampW, lampH, lampD);

    const blackMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x0a0a0a),
        roughness: 0.6,
        metalness: 0.4,
    });
    const ledMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0xffffff),
        emissive: new THREE.Color(0xfff5e8),
        emissiveIntensity: 2.5,
        roughness: 0.9,
        metalness: 0.0,
    });

    // Six faces: 0=+X, 1=-X, 2=+Y, 3=-Y(bottom/LED), 4=+Z, 5=-Z
    const materials: THREE.Material[] = [
        blackMat,
        blackMat,
        blackMat,
        ledMat,
        blackMat,
        blackMat,
    ];

    const mesh = new THREE.Mesh(geo, materials);
    mesh.position.set(0, yPos, 0);

    return { light, mesh };
}

export function disposeHeadLamp(lamp: HeadLamp): void {
    lamp.mesh.geometry.dispose();
    const mats = Array.isArray(lamp.mesh.material)
        ? lamp.mesh.material
        : [lamp.mesh.material];
    // Deduplicate (blackMat is shared across 5 slots)
    [...new Set(mats)].forEach((m) => (m as THREE.Material).dispose());
}

// ─── Dispose crystal plate resources ─────────────────────────────────────────

export function disposeCrystalMesh(mesh: THREE.Mesh): void {
    mesh.geometry.dispose();
    const mat = mesh.material as THREE.Material;
    if (mat instanceof THREE.ShaderMaterial) {
        const u = mat.uniforms;
        // Dispose per-plate textures; uSceneTex is the shared render target — skip it.
        if (u.uEtchTex?.value) u.uEtchTex.value.dispose();
    }
    mat.dispose();
}
