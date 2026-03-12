import * as THREE from 'three';
import { tileToScreen } from '../world/IsometricUtils';

interface ExplosionParticle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  color: { r: number; g: number; b: number };
}

export class ExplosionSystem {
  private scene: THREE.Scene;
  private particles: ExplosionParticle[] = [];
  private geometry: THREE.BufferGeometry;
  private points: THREE.Points;
  private positions: Float32Array;
  private colors: Float32Array;
  private sizes: Float32Array;
  private maxParticles: number;

  constructor(scene: THREE.Scene, maxParticles = 256) {
    this.scene = scene;
    this.maxParticles = maxParticles;

    this.positions = new Float32Array(maxParticles * 3);
    this.colors = new Float32Array(maxParticles * 3);
    this.sizes = new Float32Array(maxParticles);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

    const material = new THREE.PointsMaterial({
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

  spawnExplosion(tx: number, ty: number, intensity = 1) {
    const screenPos = tileToScreen(tx, ty);
    const sx = screenPos.x;
    const sy = screenPos.y;
    const count = Math.floor(20 * intensity);

    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;

      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 50;
      const vz = Math.random() * 20;

      this.particles.push({
        x: sx + (Math.random() - 0.5) * 20,
        y: -(sy + (Math.random() - 0.5) * 10),
        z: 20100 + sy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.5,
        vz: vz,
        life: 0,
        maxLife: 0.5 + Math.random() * 0.5,
        size: 4 + Math.random() * 8,
        color: {
          r: 1.0,
          g: 0.3 + Math.random() * 0.4,
          b: 0.1,
        },
      });
    }
  }

  spawnSparks(tx: number, ty: number, count = 10) {
    const screenPos = tileToScreen(tx, ty);
    const sx = screenPos.x;
    const sy = screenPos.y;

    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;

      const angle = Math.random() * Math.PI * 2;
      const speed = 20 + Math.random() * 40;

      this.particles.push({
        x: sx,
        y: -sy,
        z: 20100 + sy + Math.random() * 10,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.5 - 20,
        vz: Math.random() * 10,
        life: 0,
        maxLife: 0.3 + Math.random() * 0.3,
        size: 2 + Math.random() * 3,
        color: {
          r: 1.0,
          g: 0.9,
          b: 0.5,
        },
      });
    }
  }

  update(dt: number) {
    let idx = 0;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;

      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy += 50 * dt;

      const t = p.life / p.maxLife;
      const alpha = 1 - t;

      if (idx < this.maxParticles) {
        this.positions[idx * 3] = p.x;
        this.positions[idx * 3 + 1] = p.y;
        this.positions[idx * 3 + 2] = p.z;

        this.colors[idx * 3] = p.color.r * alpha;
        this.colors[idx * 3 + 1] = p.color.g * alpha;
        this.colors[idx * 3 + 2] = p.color.b * alpha;

        this.sizes[idx] = p.size * (1 - t * 0.5);
        idx++;
      }
    }

    for (let i = idx; i < this.maxParticles; i++) {
      this.positions[i * 3] = 0;
      this.positions[i * 3 + 1] = 0;
      this.positions[i * 3 + 2] = -99999;
      this.sizes[i] = 0;
    }

    (this.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.attributes.size as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this.points);
    this.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}
