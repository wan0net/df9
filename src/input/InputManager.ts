import { screenToTile } from '../world/IsometricUtils';
import type { CameraController3D } from '../renderer/CameraController3D';

/**
 * Native DOM input system replacing Phaser's input.
 * Handles keyboard, mouse, and pointer events.
 */
export class InputManager {
  private keysDown = new Set<string>();
  private keyCallbacks = new Map<string, (() => void)[]>();
  private canvas: HTMLCanvasElement;
  private camera: CameraController3D;

  /** Current pointer state. */
  private _pointerScreenX = 0;
  private _pointerScreenY = 0;
  private _pointerButtons = 0;
  private _pointerDownThisFrame = false;
  private _pointerUpThisFrame = false;
  private _wasLeftDown = false;

  constructor(canvas: HTMLCanvasElement, camera: CameraController3D) {
    this.canvas = canvas;
    this.camera = camera;

    window.addEventListener('keydown', (e) => {
      this.keysDown.add(e.code);
      const cbs = this.keyCallbacks.get(e.code);
      if (cbs) cbs.forEach(cb => cb());
    });

    window.addEventListener('keyup', (e) => {
      this.keysDown.delete(e.code);
    });

    canvas.addEventListener('pointermove', (e) => {
      this._pointerScreenX = e.clientX;
      this._pointerScreenY = e.clientY;
      this._pointerButtons = e.buttons;
    });

    canvas.addEventListener('pointerdown', (e) => {
      this._pointerButtons = e.buttons;
      this._pointerDownThisFrame = true;
    });

    canvas.addEventListener('pointerup', (e) => {
      this._pointerButtons = e.buttons;
      this._pointerUpThisFrame = true;
    });
  }

  isKeyDown(code: string): boolean {
    return this.keysDown.has(code);
  }

  onKeyPress(code: string, callback: () => void) {
    const cbs = this.keyCallbacks.get(code) ?? [];
    cbs.push(callback);
    this.keyCallbacks.set(code, cbs);
  }

  /** Get pointer position in world coordinates. */
  getWorldPointer(): { x: number; y: number } {
    return this.camera.screenToWorld(this._pointerScreenX, this._pointerScreenY);
  }

  /** Get pointer position as tile coordinates. */
  getHoveredTile(): { x: number; y: number } {
    const world = this.getWorldPointer();
    return screenToTile(world.x, world.y);
  }

  /** Check if left mouse button is currently held. */
  isLeftDown(): boolean {
    return (this._pointerButtons & 1) !== 0;
  }

  /** Check if left button was just pressed this frame. */
  get leftJustPressed(): boolean {
    return this.isLeftDown() && !this._wasLeftDown;
  }

  /** Check if left button was just released this frame. */
  get leftJustReleased(): boolean {
    return !this.isLeftDown() && this._wasLeftDown;
  }

  /** Get screen-space pointer position. */
  get pointerScreenX(): number { return this._pointerScreenX; }
  get pointerScreenY(): number { return this._pointerScreenY; }

  /** Call at end of each frame to reset per-frame state. */
  endFrame() {
    this._wasLeftDown = this.isLeftDown();
    this._pointerDownThisFrame = false;
    this._pointerUpThisFrame = false;
  }
}
