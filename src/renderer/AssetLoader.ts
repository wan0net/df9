import * as THREE from 'three';
import { SPRITE_SHEET_ENTRIES } from './SpriteAtlasData';
import { tObjects } from '../envobjects/EnvObjectData';
import { hasSpriteFrame } from './SpriteAtlasData';

/**
 * Texture/asset loader replacing Phaser's preload system.
 * Loads all PNG textures into Three.js Texture objects.
 */

const textureCache = new Map<string, THREE.Texture>();
const loader = new THREE.TextureLoader();

/** Load a single texture and cache it. Returns a Promise. */
function loadTexture(key: string, url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (tex) => {
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.colorSpace = THREE.SRGBColorSpace;
        textureCache.set(key, tex);
        resolve();
      },
      undefined,
      (err) => {
        console.warn(`Failed to load texture '${key}' from ${url}`);
        resolve(); // Don't block on missing textures
      }
    );
  });
}

/** Get a cached texture by key. */
export function getTexture(key: string): THREE.Texture | undefined {
  return textureCache.get(key);
}

/** Check if a texture key exists. */
export function hasTexture(key: string): boolean {
  return textureCache.has(key);
}

/**
 * Load all game assets. Returns a promise that resolves when loading is complete.
 */
export async function loadAllAssets(onProgress?: (loaded: number, total: number) => void): Promise<void> {
  const entries: [string, string][] = [];

  // Floor tiles — Base/Plain zone
  entries.push(['tile_floor', 'assets/tiles/base01.png']);
  entries.push(['tile_floor_2', 'assets/tiles/base02.png']);

  // Floor tiles — Garden zone
  entries.push(['garden01', 'assets/tiles/garden01.png']);
  entries.push(['garden02', 'assets/tiles/garden02.png']);

  // Floor tiles — Reactor/Power zone
  entries.push(['reactor01', 'assets/tiles/reactor01.png']);
  entries.push(['reactor02', 'assets/tiles/reactor02.png']);

  // Floor tiles — Pub zone
  entries.push(['pub_floor', 'assets/tiles/pub_floor.png']);

  // Floor tiles — Residence zone
  entries.push(['residence_floor', 'assets/tiles/residence_floor.png']);

  // Floor tiles — Infirmary zone
  entries.push(['infirmary01', 'assets/tiles/infirmary01.png']);
  entries.push(['infirmary02', 'assets/tiles/infirmary02.png']);

  // Floor tiles — Life Support zone
  entries.push(['lifesupport01', 'assets/tiles/lifesupport01.png']);
  entries.push(['lifesupport02', 'assets/tiles/lifesupport02.png']);

  // Floor tiles — Airlock zone
  entries.push(['airlock01', 'assets/tiles/airlock01.png']);
  entries.push(['airlock02', 'assets/tiles/airlock02.png']);

  // Floor tiles — Refinery zone
  entries.push(['refinery01', 'assets/tiles/refinery01.png']);

  // Floor tiles — Fitness zone
  entries.push(['fitness01', 'assets/tiles/fitness01.png']);
  entries.push(['fitness02', 'assets/tiles/fitness02.png']);

  // Floor tiles — Research zone
  entries.push(['research01', 'assets/tiles/research01.png']);
  entries.push(['research02', 'assets/tiles/research02.png']);

  // Floor tiles — Brig zone
  entries.push(['brig01', 'assets/tiles/brig01.png']);
  entries.push(['brig02', 'assets/tiles/brig02.png']);
  entries.push(['brig03', 'assets/tiles/brig03.png']);

  // Space tile
  entries.push(['tile_space', 'assets/tiles/full_01.png']);

  // Door sprites
  entries.push(['tile_door_closed', 'assets/walls/door_closed.png']);
  entries.push(['tile_door_open', 'assets/walls/door_open.png']);

  // Build cursor sprites
  entries.push(['cursor_yes', 'assets/ui/ISO_build_YES.png']);
  entries.push(['cursor_no', 'assets/ui/ISO_build_NO.png']);
  entries.push(['cursor_grid', 'assets/ui/ISO_build_grid.png']);
  entries.push(['cursor_grid_bright', 'assets/ui/ISO_build_grid_bright.png']);

  // Wall sprites for all zones
  const wallZones = [
    'Base', 'Garden', 'Reactor', 'Pub', 'Residence',
    'Infirmary', 'LifeSupport', 'Airlock', 'Refinery',
    'Fitness', 'Research', 'Brig', 'Exterior',
  ];
  for (const zone of wallZones) {
    entries.push([`${zone}_Straight01_bottom`, `assets/walls/${zone}_Straight01_bottom.png`]);
    entries.push([`${zone}_Straight01_top`, `assets/walls/${zone}_Straight01_top.png`]);
    entries.push([`${zone}_Corner_outer01_bottom`, `assets/walls/${zone}_Corner_outer01_bottom.png`]);
    entries.push([`${zone}_Corner_outer01_top`, `assets/walls/${zone}_Corner_outer01_top.png`]);
    entries.push([`${zone}_Corner_inner01_bottom`, `assets/walls/${zone}_Corner_inner01_bottom.png`]);
    entries.push([`${zone}_Corner_inner01_top`, `assets/walls/${zone}_Corner_inner01_top.png`]);
    entries.push([`${zone}_Corner_lb_bottom`, `assets/walls/${zone}_Corner_lb_bottom.png`]);
    entries.push([`${zone}_Corner_lb_top`, `assets/walls/${zone}_Corner_lb_top.png`]);
    entries.push([`${zone}_Corner_rb_bottom`, `assets/walls/${zone}_Corner_rb_bottom.png`]);
    entries.push([`${zone}_Corner_rb_top`, `assets/walls/${zone}_Corner_rb_top.png`]);
    entries.push([`${zone}_Corner_T_NE_bottom`, `assets/walls/${zone}_Corner_T_NE_bottom.png`]);
    entries.push([`${zone}_Corner_T_NE_top`, `assets/walls/${zone}_Corner_T_NE_top.png`]);
    entries.push([`${zone}_Corner_T_NW_bottom`, `assets/walls/${zone}_Corner_T_NW_bottom.png`]);
    entries.push([`${zone}_Corner_T_NW_top`, `assets/walls/${zone}_Corner_T_NW_top.png`]);
    entries.push([`${zone}_Corner_T_SE_bottom`, `assets/walls/${zone}_Corner_T_SE_bottom.png`]);
    entries.push([`${zone}_Corner_T_SE_top`, `assets/walls/${zone}_Corner_T_SE_top.png`]);
    entries.push([`${zone}_Corner_T_SW_bottom`, `assets/walls/${zone}_Corner_T_SW_bottom.png`]);
    entries.push([`${zone}_Corner_T_SW_top`, `assets/walls/${zone}_Corner_T_SW_top.png`]);
    entries.push([`${zone}_Corner_cross_bottom`, `assets/walls/${zone}_Corner_cross_bottom.png`]);
    entries.push([`${zone}_Corner_cross_top`, `assets/walls/${zone}_Corner_cross_top.png`]);
  }

  // Background
  entries.push(['space_bg', 'assets/tiles/space_bg.png']);
  entries.push(['stars_test', 'assets/tiles/stars_test.png']);

  // Seed pod
  entries.push(['seedpod01', 'assets/tiles/seedpod01.png']);

  // Asteroids
  entries.push(['asteroid01', 'assets/tiles/asteroid01.png']);
  entries.push(['asteroid01_b', 'assets/tiles/asteroid01_b.png']);
  entries.push(['asteroid01_bottom', 'assets/tiles/asteroid01_bottom.png']);

  // Extra Base straight variants
  entries.push(['Base_Straight02_bottom', 'assets/walls/Base_Straight02_bottom.png']);
  entries.push(['Base_Straight02_top', 'assets/walls/Base_Straight02_top.png']);
  entries.push(['Base_Straight03_bottom', 'assets/walls/Base_Straight03_bottom.png']);
  entries.push(['Base_Straight03_top', 'assets/walls/Base_Straight03_top.png']);
  entries.push(['Base_Straight04_top', 'assets/walls/Base_Straight04_top.png']);

  // Menu / New Game assets
  entries.push(['startmenu_atlas', 'assets/ui/StartMenu.png']);
  entries.push(['galaxy_map', 'assets/ui/GalaxyMap.png']);

  // HUD sprites
  entries.push(['ui_iconMatter', 'assets/ui/hud/ui_hud_iconMatter.png']);
  entries.push(['ui_iconPeople', 'assets/ui/hud/ui_hud_iconPeople.png']);
  entries.push(['ui_speed0', 'assets/ui/hud/ui_hud_speed0.png']);
  entries.push(['ui_speed0_active', 'assets/ui/hud/ui_hud_speed0_active.png']);
  entries.push(['ui_speed1', 'assets/ui/hud/ui_hud_speed1.png']);
  entries.push(['ui_speed1_active', 'assets/ui/hud/ui_hud_speed1_active.png']);
  entries.push(['ui_speed2', 'assets/ui/hud/ui_hud_speed2.png']);
  entries.push(['ui_speed2_active', 'assets/ui/hud/ui_hud_speed2_active.png']);
  entries.push(['ui_speed3', 'assets/ui/hud/ui_hud_speed3.png']);
  entries.push(['ui_speed3_active', 'assets/ui/hud/ui_hud_speed3_active.png']);

  // Environment object sprite sheets
  for (const [key, url] of SPRITE_SHEET_ENTRIES) {
    entries.push([key, url]);
  }

  // Load all in parallel
  const total = entries.length;
  let loaded = 0;

  await Promise.all(entries.map(([key, url]) =>
    loadTexture(key, url).then(() => {
      loaded++;
      onProgress?.(loaded, total);
    })
  ));

  // Generate placeholder textures for env objects without real sprites
  generatePlaceholderSprites();
}

/** Zone color map for placeholder sprites */
const ZONE_COLORS: Record<string, string> = {
  POWER: '#cc3333',
  LIFESUPPORT: '#33cc33',
  GARDEN: '#228B22',
  RESIDENCE: '#6666cc',
  PUB: '#cc9933',
  REFINERY: '#996633',
  FITNESS: '#cc6600',
  RESEARCH: '#9933cc',
  INFIRMARY: '#cc3366',
  AIRLOCK: '#336699',
  BRIG: '#666666',
};

/**
 * Generate canvas-based placeholder sprites for env objects
 * that don't have real sprite sheet frames.
 */
function generatePlaceholderSprites() {
  for (const [objName, objDef] of Object.entries(tObjects)) {
    // Skip if a real sprite frame exists for the base sprite name
    if (hasSpriteFrame(objDef.spriteName)) continue;
    // Skip if we already generated one
    const placeholderKey = `placeholder_${objDef.spriteName}`;
    if (textureCache.has(placeholderKey)) continue;

    const tileW = 128;
    const tileH = 64;
    const w = objDef.width * tileW;
    const h = Math.max(objDef.height * tileH, tileH * 1.5);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    // Pick zone color
    const zoneColor = ZONE_COLORS[objDef.zoneName ?? ''] ?? '#888888';

    // Draw isometric diamond shape
    ctx.fillStyle = zoneColor;
    ctx.globalAlpha = 0.7;
    const cx = w / 2;
    const cy = h / 2;
    const dw = w * 0.45;
    const dh = h * 0.35;
    ctx.beginPath();
    ctx.moveTo(cx, cy - dh);
    ctx.lineTo(cx + dw, cy);
    ctx.lineTo(cx, cy + dh);
    ctx.lineTo(cx - dw, cy);
    ctx.closePath();
    ctx.fill();

    // Border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.9;
    ctx.stroke();

    // Label text
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const fontSize = Math.min(14, w / (objDef.friendlyName.length * 0.65));
    ctx.font = `bold ${Math.max(8, fontSize)}px monospace`;
    ctx.fillText(objDef.friendlyName, cx, cy);

    // Icon symbol at top
    const icon = objDef.door ? '🚪' : objDef.nPowerOutput > 0 ? '⚡' :
      objDef.oxygenLevel > 0 ? '🌿' : objDef.nPowerDraw > 0 ? '⚙' : '▪';
    ctx.font = `${Math.max(12, Math.floor(h * 0.15))}px serif`;
    ctx.fillText(icon, cx, cy - dh * 0.6);

    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    textureCache.set(placeholderKey, tex);
  }
}
