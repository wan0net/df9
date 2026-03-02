import { ZOOM_MIN, ZOOM_MAX, ZOOM_STEP, PAN_SPEED, GRID_W, GRID_H, TILE_W, TILE_HALF_H } from '../config';
import type { ThreeRenderer } from './ThreeRenderer';

/**
 * Camera controller for Three.js orthographic camera.
 * Replaces Phaser's CameraController with native DOM events.
 */
export class CameraController3D {
  private threeRenderer: ThreeRenderer;

  /** Camera scroll position (top-left corner in world coordinates). */
  scrollX = 0;
  scrollY = 0;
  zoom = 1;

  private keysDown: Set<string> = new Set();
  private dragStart: { x: number; y: number; scrollX: number; scrollY: number } | null = null;

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

    // Mouse wheel zoom
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX,
        this.zoom - Math.sign(e.deltaY) * ZOOM_STEP * this.zoom
      ));

      // Zoom toward mouse position
      if (newZoom !== this.zoom) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Mouse position in world coords before zoom
        const worldX = this.scrollX + mouseX / this.zoom;
        const worldY = this.scrollY + mouseY / this.zoom;

        this.zoom = newZoom;

        // Adjust scroll so mouse position stays at same world point
        this.scrollX = worldX - mouseX / this.zoom;
        this.scrollY = worldY - mouseY / this.zoom;
      }
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

    // Clamp to bounds
    const viewW = window.innerWidth / this.zoom;
    const viewH = window.innerHeight / this.zoom;
    this.scrollX = Math.max(this.boundsMinX, Math.min(this.boundsMaxX - viewW, this.scrollX));
    this.scrollY = Math.max(this.boundsMinY, Math.min(this.boundsMaxY - viewH, this.scrollY));

    this.updateCamera();
  }

  private updateCamera() {
    const viewW = window.innerWidth / this.zoom;
    const viewH = window.innerHeight / this.zoom;

    this.threeRenderer.setCameraView(
      this.scrollX,           // left
      this.scrollY,           // top
      this.scrollX + viewW,   // right
      this.scrollY + viewH,   // bottom
    );
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
