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

interface AnimatedExplosion {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  age: number;
  frame: number;
}

const EXPLOSION_FRAME_COUNT = 32;
const EXPLOSION_FPS = 30;
const EXPLOSION_SOURCE_SIZE = 128;
const textureLoader = new THREE.TextureLoader();
let explosionFrames: THREE.Texture[] | null = null;
let sparkTexture: THREE.Texture | null = null;

function getExplosionFrames(): THREE.Texture[] {
  if (!explosionFrames) {
    explosionFrames = Array.from({ length: EXPLOSION_FRAME_COUNT }, (_, frame) => {
      const name = `explode01_${String(frame).padStart(5, '0')}`;
      const texture = textureLoader.load(`assets/effects/explode01/${name}.png`);
      texture.magFilter = THREE.LinearFilter;
      texture.minFilter = THREE.LinearFilter;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.userData.sourceAsset = name;
      return texture;
    });
  }
  return explosionFrames;
}

function getSparkTexture(): THREE.Texture {
  if (!sparkTexture) {
    sparkTexture = textureLoader.load('assets/effects/spark01.png');
    sparkTexture.magFilter = THREE.LinearFilter;
    sparkTexture.minFilter = THREE.LinearFilter;
    sparkTexture.colorSpace = THREE.SRGBColorSpace;
    sparkTexture.userData.sourceAsset = 'spark01';
  }
  return sparkTexture;
}

export class ExplosionSystem {
  private scene: THREE.Scene;
  private particles: ExplosionParticle[] = [];
  private explosions: AnimatedExplosion[] = [];
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

  spawnExplosion(tx: number, ty: number, _intensity = 1) {
    const screenPos = tileToScreen(tx, ty);
    const frames = getExplosionFrames();
    const material = new THREE.SpriteMaterial({
      map: frames[0],
      transparent: true,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(material);
    const sourceScale = 1.65 + Math.random() * 0.3;
    const size = EXPLOSION_SOURCE_SIZE * sourceScale;
    sprite.scale.set(Math.random() > 0.5 ? -size : size, size, 1);
    // Lua World.playExplosion: setLoc(wx, wy + 40, 0), WorldWall layer.
    sprite.position.set(screenPos.x, -(screenPos.y + 40), 20100 + screenPos.y);
    sprite.userData.sourceAnimation = 'explode01_';
    sprite.userData.sourceScale = sourceScale;
    this.scene.add(sprite);
    this.explosions.push({ sprite, material, age: 0, frame: 0 });
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
    const frames = this.explosions.length > 0 ? getExplosionFrames() : null;
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const explosion = this.explosions[i];
      explosion.age += dt;
      const frame = Math.floor(explosion.age * EXPLOSION_FPS);
      if (frame >= EXPLOSION_FRAME_COUNT) {
        this.scene.remove(explosion.sprite);
        explosion.material.dispose();
        this.explosions.splice(i, 1);
      } else if (frame !== explosion.frame) {
        explosion.frame = frame;
        explosion.material.map = frames![frame];
        explosion.material.needsUpdate = true;
      }
    }

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

  getDebugInfo(): {
    explosionCount: number;
    explosionFrame: number | null;
    explosionSource: string | null;
    explosionScale: number | null;
    sparkSource: string | null;
  } {
    const explosion = this.explosions[0];
    const material = this.points.material as THREE.PointsMaterial;
    return {
      explosionCount: this.explosions.length,
      explosionFrame: explosion?.frame ?? null,
      explosionSource: explosion?.sprite.userData.sourceAnimation ?? null,
      explosionScale: explosion?.sprite.userData.sourceScale ?? null,
      sparkSource: material.map?.userData.sourceAsset ?? null,
    };
  }

  dispose() {
    for (const explosion of this.explosions) {
      this.scene.remove(explosion.sprite);
      explosion.material.dispose();
    }
    this.explosions = [];
    this.scene.remove(this.points);
    this.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}
