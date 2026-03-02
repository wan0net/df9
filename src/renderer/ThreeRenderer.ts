import * as THREE from 'three';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';

/**
 * Core Three.js rendering layer.
 * Manages WebGLRenderer, Scene, OrthographicCamera, and CSS2D overlay.
 */
export class ThreeRenderer {
  renderer: THREE.WebGLRenderer;
  css2dRenderer: CSS2DRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;

  /** Overlay scene for HTML elements (need bars, tooltips). */
  overlayScene: THREE.Scene;

  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;

    // WebGL renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.sortObjects = true;
    container.appendChild(this.renderer.domElement);

    // CSS2D overlay for HTML UI elements above characters
    this.css2dRenderer = new CSS2DRenderer();
    this.css2dRenderer.setSize(window.innerWidth, window.innerHeight);
    this.css2dRenderer.domElement.style.position = 'absolute';
    this.css2dRenderer.domElement.style.top = '0';
    this.css2dRenderer.domElement.style.left = '0';
    this.css2dRenderer.domElement.style.pointerEvents = 'none';
    container.appendChild(this.css2dRenderer.domElement);

    // Main scene
    this.scene = new THREE.Scene();

    // Overlay scene (for CSS2D objects)
    this.overlayScene = new THREE.Scene();

    // Orthographic camera — Y-up convention (standard Three.js).
    // Game logic uses Y-down screen coords; we negate Y when positioning objects.
    // Camera params: (left, right, top, bottom, near, far)
    // top > bottom for standard Y-up orientation.
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera = new THREE.OrthographicCamera(0, w, 0, -h, -100000, 100000);
    this.camera.position.set(0, 0, 1000);
    this.camera.lookAt(0, 0, 0);

    // Window resize
    window.addEventListener('resize', () => this.onResize());
  }

  /**
   * Current viewport dimensions in world units (accounting for zoom).
   */
  getViewSize(): { width: number; height: number } {
    return {
      width: this.camera.right - this.camera.left,
      height: this.camera.top - this.camera.bottom, // top > bottom in Y-up
    };
  }

  /**
   * Set the camera viewport from screen-space coordinates (Y-down).
   * Internally negates Y so Three.js renders with correct Y-up orientation.
   */
  setCameraView(left: number, top: number, right: number, bottom: number) {
    this.camera.left = left;
    this.camera.right = right;
    // Negate Y: screen Y-down → Three.js Y-up
    this.camera.top = -top;
    this.camera.bottom = -bottom;
    this.camera.updateProjectionMatrix();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
    this.css2dRenderer.render(this.overlayScene, this.camera);
  }

  private onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.css2dRenderer.setSize(w, h);
    // The camera view is managed by CameraController3D
  }

  getCanvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  dispose() {
    this.renderer.dispose();
  }
}
