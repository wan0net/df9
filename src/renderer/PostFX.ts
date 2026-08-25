/**
 * PostFX.ts — Post-processing effects matching Lua PostFX/Post.lua.
 *
 * Original Lua Post.lua composites multiple render layers with:
 * - SceneLight material (scene + light buffer compositing)
 * - Color LUT grading (neutral by default, with selectable presets)
 * - Object outlines (amber {1.0, 0.7, 0.0, 0.2}, width=2)
 * - SuperBlur (multi-pass bloom glow)
 *
 * Three.js implementation uses the extracted 256×256 source LUT before the
 * bloom/output stages. Only the three presets present in the public extraction
 * are exposed; the missing magenta and green-punch sheets are not invented.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export type SourceColorLUT = 'neutral' | 'warmspace' | 'coldspace';

const LUT_PATHS: Record<SourceColorLUT, string> = {
  neutral: 'assets/effects/lut/Neutral2D_256.png',
  warmspace: 'assets/effects/lut/WarmSpace2D_256.png',
  coldspace: 'assets/effects/lut/ColdSpace2D_256.png',
};

const SOURCE_LUT_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    tColorLUT: { value: null },
    lutTexelSize: { value: new THREE.Vector2(1 / 256, 1 / 256) },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform sampler2D tColorLUT;
    uniform vec2 lutTexelSize;
    varying vec2 vUv;

    void main() {
      vec4 source = texture2D(tDiffuse, vUv);
      vec3 color = clamp(source.rgb, 0.0, 1.0);
      vec2 inset = 0.5 * lutTexelSize;
      vec2 scale = vec2(1.0) - lutTexelSize;

      // DF-9's 2D LUT stores the red/blue curves across X and green across Y.
      // Sampling once for RG and once for BG preserves all three input channels.
      vec3 rg = texture2D(tColorLUT, vec2(color.r, color.g) * scale + inset).rgb;
      vec3 bg = texture2D(tColorLUT, vec2(color.b, color.g) * scale + inset).rgb;
      gl_FragColor = vec4(rg.r, rg.g, bg.b, source.a);
    }
  `,
};

export class PostFX {
  private composer: EffectComposer;
  private lutPass: ShaderPass;
  private lutTextures: Record<SourceColorLUT, THREE.Texture>;
  private activeLUT: SourceColorLUT = 'neutral';
  private outlinePass: OutlinePass;
  private bloomPass: UnrealBloomPass;
  enabled = true;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.composer = new EffectComposer(renderer);

    // Render the scene
    const renderPass = new RenderPass(scene, camera);
    this.composer.addPass(renderPass);

    const textureLoader = new THREE.TextureLoader();
    this.lutTextures = Object.fromEntries(
      (Object.entries(LUT_PATHS) as [SourceColorLUT, string][]).map(([name, path]) => {
        const texture = textureLoader.load(path);
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearFilter;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.colorSpace = THREE.NoColorSpace;
        // The source LUT is authored top-to-bottom with black/magenta at Y=0
        // and green/white at Y=1. Three's default upload flip would make a
        // black scene sample the green row and wash the entire world lime.
        texture.flipY = false;
        texture.userData.sourceAsset = path.split('/').pop()?.replace('.png', '') ?? name;
        return [name, texture];
      }),
    ) as Record<SourceColorLUT, THREE.Texture>;

    // Lua Post:ScenePlusUI applies SceneLight's g_samColorLUT while composing
    // the scene, before later output work. Keep that same relative ordering.
    this.lutPass = new ShaderPass(SOURCE_LUT_SHADER);
    this.lutPass.uniforms.tColorLUT.value = this.lutTextures.neutral;
    this.composer.addPass(this.lutPass);

    // Lua renders every character into WorldOutlines, then composites a
    // 2-pixel amber outline with {1.0, 0.7, 0.0, 0.2}. OutlinePass supplies
    // the equivalent isolated-object mask without tinting the character mesh.
    const resolution = new THREE.Vector2(window.innerWidth, window.innerHeight);
    this.outlinePass = new OutlinePass(resolution, scene, camera);
    this.outlinePass.visibleEdgeColor.setRGB(1.0, 0.7, 0.0);
    this.outlinePass.hiddenEdgeColor.setRGB(1.0, 0.7, 0.0);
    this.outlinePass.edgeStrength = 0.2;
    // A half-resolution one-texel mask produces the source two-screen-pixel
    // edge while avoiding four full-size mask buffers under SwiftShader/GPU.
    this.outlinePass.edgeThickness = 1.0;
    this.outlinePass.edgeGlow = 0;
    this.outlinePass.downSampleRatio = 2;
    this.outlinePass.pulsePeriod = 2 * Math.PI;
    this.composer.addPass(this.outlinePass);

    // Bloom — subtle glow matching Lua Post:SuperBlur
    // Lua uses multiple blur passes with additive blending at various intensities (.3, .2, .2, .2, .15)
    // UnrealBloomPass is a good approximation
    this.bloomPass = new UnrealBloomPass(resolution, 0.42, 0.5, 0.72);
    // Slightly stronger than the previous baseline so bright sprites and HUD accents
    // pick up a soft DF-9-like halo without washing out the whole scene.
    this.composer.addPass(this.bloomPass);

    // Output pass for tone mapping
    const outputPass = new OutputPass();
    this.composer.addPass(outputPass);
  }

  render() {
    if (this.enabled) {
      this.composer.render();
    }
  }

  setSize(width: number, height: number) {
    this.composer.setSize(width, height);
  }

  setBloomStrength(strength: number) {
    this.bloomPass.strength = strength;
  }

  setBloomThreshold(threshold: number) {
    this.bloomPass.threshold = threshold;
  }

  setBloomRadius(radius: number) {
    this.bloomPass.radius = radius;
  }

  setColorLUT(name: SourceColorLUT) {
    this.activeLUT = name;
    this.lutPass.uniforms.tColorLUT.value = this.lutTextures[name];
  }

  setOutlinedObjects(objects: THREE.Object3D[]) {
    this.outlinePass.selectedObjects = objects;
  }

  getDebugInfo(): {
    colorLUT: SourceColorLUT;
    sourceAsset: string | null;
    availableLUTs: SourceColorLUT[];
    lutFlipY: boolean | null;
    appliedBeforeBloom: boolean;
    outlineObjectCount: number;
    outlineColor: [number, number, number];
    outlineWidth: number;
    outlineOpacity: number;
    outlineAppliedAfterLUT: boolean;
  } {
    const texture = this.lutPass.uniforms.tColorLUT.value as THREE.Texture | null;
    return {
      colorLUT: this.activeLUT,
      sourceAsset: texture?.userData.sourceAsset ?? null,
      availableLUTs: Object.keys(this.lutTextures) as SourceColorLUT[],
      lutFlipY: texture?.flipY ?? null,
      appliedBeforeBloom: this.composer.passes.indexOf(this.lutPass) < this.composer.passes.indexOf(this.bloomPass),
      outlineObjectCount: this.outlinePass.selectedObjects.length,
      outlineColor: this.outlinePass.visibleEdgeColor.toArray() as [number, number, number],
      outlineWidth: this.outlinePass.edgeThickness * this.outlinePass.downSampleRatio,
      outlineOpacity: this.outlinePass.edgeStrength,
      outlineAppliedAfterLUT: this.composer.passes.indexOf(this.outlinePass) > this.composer.passes.indexOf(this.lutPass),
    };
  }

  dispose() {
    for (const texture of Object.values(this.lutTextures)) texture.dispose();
    this.composer.dispose();
  }
}
