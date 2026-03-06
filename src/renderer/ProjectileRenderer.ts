/**
 * ProjectileRenderer.ts — Renders visible projectiles between source and target.
 * Shows a colored line/beam that moves along the trajectory.
 */

import * as THREE from 'three';
import type { ProjectileData } from '../hazards/Projectile';
import { tileToScreen } from '../world/IsometricUtils';

/** Projectile visual colors by damage type (Lua: DAMAGE_TYPE). */
const DAMAGE_TYPE_COLORS: Record<number, number> = {
  1: 0xff4444,  // melee (red — shouldn't normally have projectile)
  2: 0x44ff44,  // laser (green)
  3: 0xffaa22,  // bullet (orange)
  4: 0x4488ff,  // stunner (blue)
  5: 0xff44ff,  // plasma (purple)
};

/** Beam length in pixels. */
const BEAM_LENGTH = 24;
/** Beam thickness. */
const BEAM_THICKNESS = 2;

export class ProjectileRenderer {
  private scene: THREE.Scene;
  private beams = new Map<number, THREE.Mesh>();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /** Sync visible projectiles with active projectile data. */
  update(projectiles: ProjectileData[]) {
    const activeIds = new Set<number>();

    for (const proj of projectiles) {
      activeIds.add(proj.id);

      // Interpolate position based on progress (0..1)
      const sx = proj.sourceX + (proj.targetX - proj.sourceX) * proj.progress;
      const sy = proj.sourceY + (proj.targetY - proj.sourceY) * proj.progress;

      // Convert tile coords to screen coords
      const src = tileToScreen(proj.sourceX, proj.sourceY);
      const tgt = tileToScreen(proj.targetX, proj.targetY);
      const cx = src.x + (tgt.x - src.x) * proj.progress;
      const cy = src.y + (tgt.y - src.y) * proj.progress;

      // Direction angle for rotation
      const dx = tgt.x - src.x;
      const dy = tgt.y - src.y;
      const angle = Math.atan2(-dy, dx); // negate Y because screen Y is inverted

      let beam = this.beams.get(proj.id);
      if (!beam) {
        // Create beam mesh
        const color = DAMAGE_TYPE_COLORS[proj.damageType] ?? 0x44ff44;
        const geo = new THREE.PlaneGeometry(BEAM_LENGTH, BEAM_THICKNESS);
        const mat = new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        beam = new THREE.Mesh(geo, mat);
        this.scene.add(beam);
        this.beams.set(proj.id, beam);
      }

      // Position and rotate beam
      beam.position.set(cx, -cy, 20500 + cy);
      beam.rotation.z = angle;
    }

    // Remove beams for projectiles that no longer exist
    for (const [id, beam] of this.beams) {
      if (!activeIds.has(id)) {
        this.scene.remove(beam);
        beam.geometry.dispose();
        (beam.material as THREE.Material).dispose();
        this.beams.delete(id);
      }
    }
  }

  dispose() {
    for (const [, beam] of this.beams) {
      this.scene.remove(beam);
      beam.geometry.dispose();
      (beam.material as THREE.Material).dispose();
    }
    this.beams.clear();
  }
}
