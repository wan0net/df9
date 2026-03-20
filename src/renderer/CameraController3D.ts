import { ZOOM_MIN, ZOOM_MAX, ZOOM_STEP, PAN_SPEED, GRID_W, GRID_H, TILE_W, TILE_HALF_H } from '../config';
import type { ThreeRenderer } from './ThreeRenderer';
import { GameRules } from '../core/GameRules';

// Lua: GameRules.ZOOM_RATE = 0.005 (per-frame interpolation decrement)
const ZOOM_RATE = 0.005;

/**
 * Camera controller for Three.js orthographic camera.
 * Replaces Phaser's CameraController with native DOM events.
 */
export class CameraController3D {
  private threeRenderer: ThreeRenderer;

  /** Camera scroll position (top-left corner in world coordinates). */
  scrollX = 0;
  scrollY = 0;
  zoom = 2.5; // Lua START_ZOOM=2.5 (GameRules.lua:178)

  private keysDown: Set<string> = new Set();
  private dragStart: { x: number; y: number; scrollX: number; scrollY: number } | null = null;

  // ── Smooth zoom (Lua: zoomBuffer + ZOOM_RATE) ──────────────
  private zoomBuffer = 0;
  private zoomMouseX = 0;
  private zoomMouseY = 0;

  // ── Camera shake (Lua: Camera:shake) ───────────────────────
  private shakeEndTime = 0;
  private shakeMagnitude = 0;
  private shakeOffsetX = 0;
  private shakeOffsetY = 0;

  /** World bounds. */
  private boundsMinX: number;
  private boundsMinY: number;
  private boundsMaxX: number;
  private boundsMaxY: number;

  constructor(threeRenderer: ThreeRenderer) {
    this.threeRenderer = threeRenderer;

    // World bounds
    const worldW = GRID_W * TILE_W + TILE_W;
    const worldH = GRID_H * TILE_HALF_H + TILE_HALF_H;
    this.boundsMinX = -TILE_W;
    this.boundsMinY = -TILE_HALF_H;
    this.boundsMaxX = worldW;
    this.boundsMaxY = worldH;

    // Center on middle of grid
    const centerX = (GRID_W / 2) * TILE_W;
    const centerY = (GRID_H / 2) * TILE_HALF_H;
    this.scrollX = centerX - window.innerWidth / 2;
    this.scrollY = centerY - window.innerHeight / 2;

    this.setupEvents();
    this.updateCamera();
  }

  private setupEvents() {
    const canvas = this.threeRenderer.getCanvas();

    // Keyboard
    window.addEventListener('keydown', (e) => this.keysDown.add(e.code));
    window.addEventListener('keyup', (e) => this.keysDown.delete(e.code));

    // Mouse wheel zoom — accumulate into zoomBuffer for smooth interpolation
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = -Math.sign(e.deltaY) * ZOOM_STEP;
      this.zoomBuffer += delta;
      // Store mouse position for zoom-toward-cursor
      const rect = canvas.getBoundingClientRect();
      this.zoomMouseX = e.clientX - rect.left;
      this.zoomMouseY = e.clientY - rect.top;
    }, { passive: false });

    // Middle/right mouse drag to pan
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button === 1 || e.button === 2) {
        this.dragStart = {
          x: e.clientX,
          y: e.clientY,
          scrollX: this.scrollX,
          scrollY: this.scrollY,
        };
      }
    });

    window.addEventListener('pointermove', (e) => {
      if (this.dragStart) {
        const dx = e.clientX - this.dragStart.x;
        const dy = e.clientY - this.dragStart.y;
        this.scrollX = this.dragStart.scrollX - dx / this.zoom;
        this.scrollY = this.dragStart.scrollY - dy / this.zoom;
      }
    });

    window.addEventListener('pointerup', (e) => {
      if (e.button === 1 || e.button === 2) {
        this.dragStart = null;
      }
    });

    // Disable context menu
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  update() {
    const speed = PAN_SPEED / this.zoom;

    if (this.keysDown.has('ArrowLeft')) this.scrollX -= speed;
    if (this.keysDown.has('ArrowRight')) this.scrollX += speed;
    if (this.keysDown.has('ArrowUp')) this.scrollY -= speed;
    if (this.keysDown.has('ArrowDown')) this.scrollY += speed;

    // ── Smooth zoom: drain zoomBuffer by ZOOM_RATE per frame (Lua Camera) ──
    if (Math.abs(this.zoomBuffer) > 0.0001) {
      const drain = Math.sign(this.zoomBuffer) * Math.min(Math.abs(this.zoomBuffer), ZOOM_RATE);
      const oldZoom = this.zoom;
      this.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, this.zoom + drain));
      this.zoomBuffer -= drain;

      // Zoom toward mouse cursor
      if (this.zoom !== oldZoom) {
        const factor = this.zoom / oldZoom;
        const viewW = window.innerWidth;
        const viewH = window.innerHeight;
        const worldMouseX = this.scrollX + this.zoomMouseX / oldZoom;
        const worldMouseY = this.scrollY + this.zoomMouseY / oldZoom;
        this.scrollX = worldMouseX - this.zoomMouseX / this.zoom;
        this.scrollY = worldMouseY - this.zoomMouseY / this.zoom;
      }
    } else {
      this.zoomBuffer = 0;
    }

    // ── Camera shake (Lua Camera:tick, R-29: use game time) ──
    if (this.shakeEndTime > GameRules.elapsedTime) {
      this.shakeOffsetX = (Math.random() - 0.5) * 2 * this.shakeMagnitude;
      this.shakeOffsetY = (Math.random() - 0.5) * 2 * this.shakeMagnitude;
    } else {
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
    }

    // Clamp to bounds
    const viewW = window.innerWidth / this.zoom;
    const viewH = window.innerHeight / this.zoom;
    this.scrollX = Math.max(this.boundsMinX, Math.min(this.boundsMaxX - viewW, this.scrollX));
    this.scrollY = Math.max(this.boundsMinY, Math.min(this.boundsMaxY - viewH, this.scrollY));

    this.updateCamera();
  }

  /** Add zoom increment (Lua GameRules.AddZoom, called by zoom buttons). */
  addZoom(steps: number) {
    this.zoomBuffer += steps * ZOOM_STEP;
    // Center zoom on screen center
    this.zoomMouseX = window.innerWidth / 2;
    this.zoomMouseY = window.innerHeight / 2;
  }

  /** Trigger camera shake (Lua Camera:shake). */
  shake(magnitude: number, duration: number) {
    this.shakeMagnitude = magnitude;
    // R-29: Use GameRules.elapsedTime instead of wall-clock so shake pauses when game pauses
    this.shakeEndTime = GameRules.elapsedTime + duration;
  }

  private updateCamera() {
    const viewW = window.innerWidth / this.zoom;
    const viewH = window.innerHeight / this.zoom;

    // Apply shake offset (Lua Camera:setLoc adds shakeX/Y)
    const sx = this.scrollX + this.shakeOffsetX / this.zoom;
    const sy = this.scrollY + this.shakeOffsetY / this.zoom;

    this.threeRenderer.setCameraView(
      sx,           // left
      sy,           // top
      sx + viewW,   // right
      sy + viewH,   // bottom
    );
  }

  /** Center the camera on a world-coordinate position. */
  centerOnWorld(worldX: number, worldY: number) {
    const viewW = window.innerWidth / this.zoom;
    const viewH = window.innerHeight / this.zoom;
    this.scrollX = worldX - viewW / 2;
    this.scrollY = worldY - viewH / 2;
    this.updateCamera();
  }

  /**
   * Convert screen pixel position to world coordinates.
   */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: this.scrollX + screenX / this.zoom,
      y: this.scrollY + screenY / this.zoom,
    };
  }
}
