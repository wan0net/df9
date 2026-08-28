/**
 * FireParticles.ts — Procedural flame particles on fire tiles.
 * Replaces plain orange tint overlay with animated flame/ember effect.
 * Uses Three.js Points with per-particle attributes for drift, fade, flicker.
 */

import * as THREE from 'three';
import { tileToScreen } from '../world/IsometricUtils';

/** Max particles per fire tile. */
const PARTICLES_PER_TILE = 12;
/** Particle lifetime in seconds. */
const PARTICLE_LIFETIME = 0.8;
/** Upward drift speed (screen pixels/sec). */
const DRIFT_SPEED = 40;
/** Horizontal spread radius. */
const SPREAD = 20;
/** Particle size range. */
const SIZE_MIN = 4;
const SIZE_MAX = 10;

let flameTexture: THREE.Texture | null = null;
function getFlameTexture(): THREE.Texture {
  if (!flameTexture) {
    flameTexture = new THREE.TextureLoader().load('assets/effects/flame01.png');
    flameTexture.magFilter = THREE.LinearFilter;
    flameTexture.minFilter = THREE.LinearFilter;
    flameTexture.colorSpace = THREE.SRGBColorSpace;
    flameTexture.userData.sourceAsset = 'flame01';
  }
  return flameTexture;
}

interface FireParticleData {
  /** Tile grid coords. */
  tx: number;
  ty: number;
  /** Per-particle state. */
  particles: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    age: number;
    lifetime: number;
    size: number;
  }[];
}

export class FireParticles {
  private scene: THREE.Scene;
  private fires = new Map<string, FireParticleData>();
  private geometry: THREE.BufferGeometry;
  private points: THREE.Points;
  private positions: Float32Array;
  private colors: Float32Array;
  private sizes: Float32Array;
  private maxParticles: number;

  constructor(scene: THREE.Scene, maxFireTiles = 64) {
    this.scene = scene;
    this.maxParticles = maxFireTiles * PARTICLES_PER_TILE;

    this.positions = new Float32Array(this.maxParticles * 3);
    this.colors = new Float32Array(this.maxParticles * 3);
    this.sizes = new Float32Array(this.maxParticles);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

    const material = new THREE.PointsMaterial({
      map: getFlameTexture(),
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

  /** Sync active fire tile set. */
  setFireTiles(tiles: { x: number; y: number; intensity: number }[]) {
    const currentKeys = new Set<string>();
    for (const t of tiles) {
      const key = `${t.x},${t.y}`;
      currentKeys.add(key);
      if (!this.fires.has(key)) {
        // Spawn particles for new fire tile
        const particles = [];
        for (let i = 0; i < PARTICLES_PER_TILE; i++) {
          particles.push(this.spawnParticle());
        }
        this.fires.set(key, { tx: t.x, ty: t.y, particles });
      }
    }
    // Remove fires that are no longer active
    for (const key of this.fires.keys()) {
      if (!currentKeys.has(key)) {
        this.fires.delete(key);
      }
    }
  }

  private spawnParticle() {
    return {
      x: (Math.random() - 0.5) * SPREAD,
      y: (Math.random() - 0.5) * SPREAD * 0.5,
      vx: (Math.random() - 0.5) * 10,
      vy: -DRIFT_SPEED * (0.5 + Math.random() * 0.5),
      age: Math.random() * PARTICLE_LIFETIME, // stagger start
      lifetime: PARTICLE_LIFETIME * (0.5 + Math.random() * 0.5),
      size: SIZE_MIN + Math.random() * (SIZE_MAX - SIZE_MIN),
    };
  }

  /** Update particle simulation and buffer data. */
  update(dt: number) {
    let idx = 0;

    for (const [, fd] of this.fires) {
      const screenPos = tileToScreen(fd.tx, fd.ty);
      const sx = screenPos.x, sy = screenPos.y;

      for (const p of fd.particles) {
        p.age += dt;
        if (p.age >= p.lifetime) {
          // Respawn
          Object.assign(p, this.spawnParticle());
          p.age = 0;
        }

        // Move
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        // Normalized age 0..1
        const t = p.age / p.lifetime;
        // Fade in quickly, fade out
        const alpha = t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.9;
        // Flicker
        const flicker = 0.7 + Math.random() * 0.3;

        if (idx < this.maxParticles) {
          // Position in world space
          this.positions[idx * 3] = sx + p.x;
          this.positions[idx * 3 + 1] = -(sy + p.y);
          this.positions[idx * 3 + 2] = 20100 + sy; // Above tiles, below characters

          // Color: yellow→red fade
          const r = (1.0 - t * 0.3) * alpha * flicker;
          const g = (0.7 - t * 0.6) * alpha * flicker;
          const b = (0.1 * (1 - t)) * alpha * flicker;
          this.colors[idx * 3] = r;
          this.colors[idx * 3 + 1] = g;
          this.colors[idx * 3 + 2] = b;

          this.sizes[idx] = p.size * (1 - t * 0.5);
          idx++;
        }
      }
    }

    // Zero out remaining particles
    for (let i = idx; i < this.maxParticles; i++) {
      this.positions[i * 3] = 0;
      this.positions[i * 3 + 1] = 0;
      this.positions[i * 3 + 2] = -99999;
      this.sizes[i] = 0;
    }

    // Update buffer attributes
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
