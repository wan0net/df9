import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { TILE_HALF_W, TILE_HALF_H } from '../config';
import type { Character } from '../characters/Character';

/**
 * Renders characters as textured sprite quads in the Three.js scene.
 * Uses a procedurally generated texture matching the Phaser version.
 * Need bars use CSS2DObjects for HTML rendering above characters.
 */

/** Procedurally generated character texture (matches BootScene generation). */
let characterTexture: THREE.Texture | null = null;

function getCharacterTexture(): THREE.Texture {
  if (characterTexture) return characterTexture;

  const w = 32;
  const h = 48;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Skin
  ctx.fillStyle = '#ddbb99';
  ctx.beginPath();
  ctx.arc(w / 2, 10, 7, 0, Math.PI * 2);
  ctx.fill();

  // Hair
  ctx.fillStyle = '#665544';
  ctx.beginPath();
  ctx.ellipse(w / 2, 6, 7, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.fillStyle = '#cccccc';
  ctx.fillRect(w / 2 - 8, 16, 16, 14);

  // Arms
  ctx.fillRect(w / 2 - 11, 17, 4, 10);
  ctx.fillRect(w / 2 + 7, 17, 4, 10);

  // Hands
  ctx.fillStyle = '#ddbb99';
  ctx.beginPath();
  ctx.arc(w / 2 - 9, 28, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(w / 2 + 9, 28, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Legs
  ctx.fillStyle = '#444466';
  ctx.fillRect(w / 2 - 6, 30, 5, 12);
  ctx.fillRect(w / 2 + 1, 30, 5, 12);

  // Feet
  ctx.fillStyle = '#333333';
  ctx.fillRect(w / 2 - 7, 41, 6, 4);
  ctx.fillRect(w / 2 + 1, 41, 6, 4);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(w / 2, 46, 10, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  characterTexture = tex;
  return tex;
}

const JOB_COLORS: Record<number, THREE.Color> = {};
function getJobColor(job: number): THREE.Color {
  if (JOB_COLORS[job]) return JOB_COLORS[job];
  // Import job constants inline to avoid circular deps
  const colors: Record<number, number> = {
    2: 0xffcc44,   // BUILDER - yellow
    3: 0x44aaff,   // TECHNICIAN - blue
    4: 0xff8844,   // MINER - orange
    5: 0xff4444,   // EMERGENCY - red
    7: 0xcc44ff,   // BARTENDER - purple
    8: 0x44cc44,   // BOTANIST - green
    9: 0x44dddd,   // SCIENTIST - cyan
    12: 0xffffff,  // DOCTOR - white
    13: 0x888888,  // JANITOR - grey
  };
  const hex = colors[job] ?? 0xcccccc;
  const c = new THREE.Color(hex);
  JOB_COLORS[job] = c;
  return c;
}

export interface CharacterRenderHandle {
  sprite: THREE.Mesh;
  needBarsEl: HTMLDivElement;
  needBarsObj: CSS2DObject;
}

export class CharacterRenderer {
  private scene: THREE.Scene;
  private overlayScene: THREE.Scene;
  private handles = new Map<number, CharacterRenderHandle>();

  constructor(scene: THREE.Scene, overlayScene: THREE.Scene) {
    this.scene = scene;
    this.overlayScene = overlayScene;
  }

  /** Create render objects for a character. Returns a handle ID. */
  createCharacter(char: Character): CharacterRenderHandle {
    const tex = getCharacterTexture();
    const geo = new THREE.PlaneGeometry(32, 48);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      alphaTest: 0.01,
      depthWrite: false,
      color: getJobColor(char.getJob()),
    });
    const sprite = new THREE.Mesh(geo, mat);
    sprite.position.set(char.screenX, char.screenY - 16, 20000 + char.screenY);
    this.scene.add(sprite);

    // Need bars as CSS2D overlay
    const needBarsEl = document.createElement('div');
    needBarsEl.className = 'need-bars';
    needBarsEl.style.cssText = 'width:32px;pointer-events:none;';
    const needBarsObj = new CSS2DObject(needBarsEl);
    needBarsObj.position.set(char.screenX, char.screenY - 30, 20001 + char.screenY);
    this.overlayScene.add(needBarsObj);

    const handle: CharacterRenderHandle = { sprite, needBarsEl, needBarsObj };
    this.handles.set(char.id, handle);
    return handle;
  }

  /** Update character visual position and need bars. */
  updateCharacter(char: Character) {
    const handle = this.handles.get(char.id);
    if (!handle) return;

    handle.sprite.position.set(char.screenX, char.screenY - 16, 20000 + char.screenY);

    // Update tint
    if (handle.sprite.material instanceof THREE.MeshBasicMaterial) {
      handle.sprite.material.color.copy(getJobColor(char.getJob()));
    }

    // Update need bars
    handle.needBarsObj.position.set(char.screenX, char.screenY - 30, 20001 + char.screenY);
    this.drawNeedBars(handle.needBarsEl, char);
  }

  private drawNeedBars(el: HTMLDivElement, char: Character) {
    const bars = [
      { value: char.needs.oxygen, color: '#4488ff' },
      { value: char.needs.hunger, color: '#ff8844' },
      { value: char.needs.energy, color: '#aaaa44' },
      { value: Math.max(0, (char.nMorale + 100) / 2), color: '#44cc44' },
    ];

    let html = '';
    for (const bar of bars) {
      const color = bar.value > 30 ? bar.color : '#ff0000';
      const pct = Math.max(0, Math.min(100, bar.value));
      html += `<div style="width:32px;height:3px;margin-bottom:1px;background:#333;position:relative;">` +
        `<div style="width:${pct}%;height:100%;background:${color};"></div></div>`;
    }
    el.innerHTML = html;
  }

  /** Remove render objects for a character. */
  destroyCharacter(charId: number) {
    const handle = this.handles.get(charId);
    if (!handle) return;

    this.scene.remove(handle.sprite);
    handle.sprite.geometry.dispose();

    this.overlayScene.remove(handle.needBarsObj);
    handle.needBarsEl.remove();

    this.handles.delete(charId);
  }
}
