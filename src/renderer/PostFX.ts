/**
 * PostFX.ts — Post-processing effects matching Lua PostFX/Post.lua.
 *
 * Original Lua Post.lua composites multiple render layers with:
 * - SceneLight material (scene + light buffer compositing)
 * - Color LUT grading (5 presets: neutral, warmspace, coldspace, magenta, greenpunch)
 * - Object outlines (amber {1.0, 0.7, 0.0, 0.2}, width=2)
 * - SuperBlur (multi-pass bloom glow)
 *
 * Three.js implementation uses EffectComposer with UnrealBloomPass for the
 * bloom glow effect. Color grading is approximated via OutputPass tone mapping.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export class PostFX {
  private composer: EffectComposer;
  private bloomPass: UnrealBloomPass;
  enabled = true;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.composer = new EffectComposer(renderer);

    // Render the scene
    const renderPass = new RenderPass(scene, camera);
    this.composer.addPass(renderPass);

    // Bloom — subtle glow matching Lua Post:SuperBlur
    // Lua uses multiple blur passes with additive blending at various intensities (.3, .2, .2, .2, .15)
    // UnrealBloomPass is a good approximation
    const resolution = new THREE.Vector2(window.innerWidth, window.innerHeight);
    this.bloomPass = new UnrealBloomPass(resolution, 0.3, 0.4, 0.85);
    // strength=0.3 (subtle), radius=0.4 (spread), threshold=0.85 (only bright areas bloom)
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

  dispose() {
    this.composer.dispose();
  }
}
