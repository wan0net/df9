/**
 * EffectParticles.ts — Procedural particle effects for meteors and construction sparks.
 * Mirrors Lua Effect.new() for BuildSparks and meteor visuals.
 */

import * as THREE from 'three';
import { tileToScreen } from '../world/IsometricUtils';

/** A single timed particle effect. */
interface ParticleEffect {
  id: number;
  type: 'meteor' | 'sparks';
  worldX: number;
  worldY: number;
  age: number;
  lifetime: number;
  particles: {
    x: number; y: number;
    vx: number; vy: number;
    age: number; lifetime: number;
    size: number;
  }[];
}

/** Max concurrent effects. */
const MAX_EFFECTS = 32;
const PARTICLES_PER_EFFECT = 16;
const MAX_PARTICLES = MAX_EFFECTS * PARTICLES_PER_EFFECT;

let sparkTex: THREE.Texture | null = null;
function getSparkTexture(): THREE.Texture {
  if (!sparkTex) {
    sparkTex = new THREE.TextureLoader().load('assets/effects/spark01.png');
    sparkTex.magFilter = THREE.LinearFilter;
    sparkTex.minFilter = THREE.LinearFilter;
    sparkTex.colorSpace = THREE.SRGBColorSpace;
    sparkTex.userData.sourceAsset = 'spark01';
  }
  return sparkTex;
}

export class EffectParticles {
  private scene: THREE.Scene;
  private effects: ParticleEffect[] = [];
  private nextId = 1;
  private geometry: THREE.BufferGeometry;
  private points: THREE.Points;
  private positions: Float32Array;
  private colors: Float32Array;
  private sizes: Float32Array;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.positions = new Float32Array(MAX_PARTICLES * 3);
    this.colors = new Float32Array(MAX_PARTICLES * 3);
    this.sizes = new Float32Array(MAX_PARTICLES);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

    const material = new THREE.PointsMaterial({
      map: getSparkTexture(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true,
      sizeAttenuation: false,
    });

    this.points = new THREE.Points(this.geometry, material);
    this.points.frustumCulled = false;
    this.scene.add(this.points);
  }

  /**
   * Spawn a meteor trail effect at a tile (Lua MeteorEvent animated sprite).
   * Trail falls from above and fades on impact.
   */
  spawnMeteorTrail(tileX: number, tileY: number) {
    const pos = tileToScreen(tileX, tileY);
    const particles = [];
    for (let i = 0; i < PARTICLES_PER_EFFECT; i++) {
      particles.push({
        x: (Math.random() - 0.5) * 30,
        y: -150 - Math.random() * 100, // Start above
        vx: (Math.random() - 0.5) * 20,
        vy: 80 + Math.random() * 60, // Fall down
        age: Math.random() * 0.3,
        lifetime: 0.8 + Math.random() * 0.5,
        size: 3 + Math.random() * 6,
      });
    }
    this.effects.push({
      id: this.nextId++,
      type: 'meteor',
      worldX: pos.x,
      worldY: pos.y,
      age: 0,
      lifetime: 1.5,
      particles,
    });
    if (this.effects.length > MAX_EFFECTS) this.effects.shift();
  }

  /**
   * Spawn construction danger sparks at a tile (Lua EnvObject.sSparkFX = BuildSparks).
   * Small bright sparks shooting outward from damaged object.
   */
  spawnSparks(tileX: number, tileY: number) {
    const pos = tileToScreen(tileX, tileY);
    const particles = [];
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 50;
      particles.push({
        x: 0,
        y: 0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30, // slight upward bias
        age: 0,
        lifetime: 0.3 + Math.random() * 0.3,
        size: 2 + Math.random() * 3,
      });
    }
    // Pad to PARTICLES_PER_EFFECT
    while (particles.length < PARTICLES_PER_EFFECT) {
      particles.push({ x: 0, y: 0, vx: 0, vy: 0, age: 0, lifetime: 0.01, size: 0 });
    }
    this.effects.push({
      id: this.nextId++,
      type: 'sparks',
      worldX: pos.x,
      worldY: pos.y,
      age: 0,
      lifetime: 0.8,
      particles,
    });
    if (this.effects.length > MAX_EFFECTS) this.effects.shift();
  }

  update(dt: number) {
    // Remove expired effects
    this.effects = this.effects.filter(e => e.age < e.lifetime);

    let idx = 0;
    for (const eff of this.effects) {
      eff.age += dt;

      for (const p of eff.particles) {
        p.age += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        // Gravity for sparks
        if (eff.type === 'sparks') {
          p.vy += 120 * dt;
        }

        const t = Math.min(1, p.age / p.lifetime);
        const alpha = t < 0.1 ? t / 0.1 : Math.max(0, 1 - (t - 0.1) / 0.9);

        if (idx < MAX_PARTICLES && alpha > 0.01) {
          this.positions[idx * 3] = eff.worldX + p.x;
          this.positions[idx * 3 + 1] = -(eff.worldY + p.y);
          this.positions[idx * 3 + 2] = 25000 + eff.worldY; // Above everything

          if (eff.type === 'meteor') {
            // Orange-white trail
            this.colors[idx * 3] = (1.0 - t * 0.3) * alpha;
            this.colors[idx * 3 + 1] = (0.6 - t * 0.4) * alpha;
            this.colors[idx * 3 + 2] = (0.2 * (1 - t)) * alpha;
          } else {
            // Bright yellow sparks
            this.colors[idx * 3] = 1.0 * alpha;
            this.colors[idx * 3 + 1] = (0.8 - t * 0.5) * alpha;
            this.colors[idx * 3 + 2] = (0.3 * (1 - t)) * alpha;
          }

          this.sizes[idx] = p.size * (1 - t * 0.3) * alpha;
          idx++;
        }
      }
    }

    // Zero remaining
    for (let i = idx; i < MAX_PARTICLES; i++) {
      this.positions[i * 3 + 2] = -99999;
      this.sizes[i] = 0;
    }

    (this.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.attributes.size as THREE.BufferAttribute).needsUpdate = true;
  }

  getTextureSource(): string | null {
    const material = this.points.material as THREE.PointsMaterial;
    return material.map?.userData.sourceAsset ?? null;
  }

  dispose() {
    this.scene.remove(this.points);
    this.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}
