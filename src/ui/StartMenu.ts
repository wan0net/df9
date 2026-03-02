import type { SceneContext, SceneState } from '../renderer/SceneManager';
import { getTexture } from '../renderer/AssetLoader';

const AMBER_HEX = '#dfa200';

/**
 * Start menu rendered as HTML overlay.
 * Replaces StartMenuScene.ts (Phaser).
 */
export class StartMenuState implements SceneState {
  private ctx!: SceneContext;
  private overlay!: HTMLDivElement;
  private onNewGame!: () => void;
  private onTutorial!: () => void;
  private onLoadBase!: () => void;

  constructor(handlers: {
    onNewGame: () => void;
    onTutorial: () => void;
    onLoadBase: () => void;
  }) {
    this.onNewGame = handlers.onNewGame;
    this.onTutorial = handlers.onTutorial;
    this.onLoadBase = handlers.onLoadBase;
  }

  enter(ctx: SceneContext) {
    this.ctx = ctx;

    this.overlay = document.createElement('div');
    this.overlay.id = 'start-menu';
    this.overlay.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      background: #000; display: flex; flex-direction: column;
      align-items: center; justify-content: center; z-index: 100;
      font-family: monospace;
    `;

    // Space background
    const spaceTex = getTexture('space_bg');
    if (spaceTex?.image) {
      const bgCanvas = document.createElement('canvas');
      bgCanvas.width = window.innerWidth;
      bgCanvas.height = window.innerHeight;
      const bgCtx = bgCanvas.getContext('2d');
      if (bgCtx && spaceTex.image instanceof HTMLImageElement) {
        bgCtx.globalAlpha = 0.6;
        for (let y = 0; y < bgCanvas.height; y += spaceTex.image.height) {
          for (let x = 0; x < bgCanvas.width; x += spaceTex.image.width) {
            bgCtx.drawImage(spaceTex.image, x, y);
          }
        }
      }
      bgCanvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;';
      this.overlay.appendChild(bgCanvas);
    }

    // Content container
    const content = document.createElement('div');
    content.style.cssText = 'position:relative;z-index:1;text-align:center;';

    // Title
    content.innerHTML = `
      <div style="color:${AMBER_HEX};font-size:64px;font-weight:bold;margin-bottom:0;">SPACEBASE</div>
      <div style="color:${AMBER_HEX};font-size:80px;font-weight:bold;margin-bottom:10px;">DF-9</div>
      <div style="color:#888;font-size:16px;margin-bottom:30px;">Web Prototype</div>
      <div style="width:300px;height:2px;background:${AMBER_HEX};opacity:0.4;margin:0 auto 40px;"></div>
    `;

    // Buttons
    const buttons = [
      { label: 'New Game', action: this.onNewGame },
      { label: 'Tutorial', action: this.onTutorial },
      { label: 'Load Base', action: this.onLoadBase },
    ];

    for (const btn of buttons) {
      const el = document.createElement('div');
      el.textContent = btn.label;
      el.style.cssText = `
        color: ${AMBER_HEX}; font-size: 28px; padding: 8px 40px; margin: 10px 0;
        cursor: pointer; position: relative;
      `;
      el.addEventListener('mouseenter', () => {
        el.style.background = AMBER_HEX;
        el.style.color = '#000';
      });
      el.addEventListener('mouseleave', () => {
        el.style.background = 'transparent';
        el.style.color = AMBER_HEX;
      });
      el.addEventListener('click', btn.action);
      content.appendChild(el);
    }

    // Version
    const version = document.createElement('div');
    version.textContent = 'v0.1';
    version.style.cssText = 'position:fixed;bottom:10px;left:10px;color:#444;font-size:12px;';
    content.appendChild(version);

    this.overlay.appendChild(content);
    ctx.container.appendChild(this.overlay);
  }

  update(_dt: number) {}

  exit() {
    this.overlay?.remove();
  }
}
