import type { SceneContext, SceneState } from '../renderer/SceneManager';
import { getTexture } from '../renderer/AssetLoader';
import { SoundManager } from '../audio/SoundManager';

const AMBER = '#dfa200';
const BRIGHT_AMBER = '#ffcc44';

/**
 * Start menu rendered as HTML overlay.
 * Mirrors StartMenuLayout.lua: right-aligned Orbitron-font buttons in AMBER,
 * logo from UI/StartMenu sprite sheet, gradient overlay bars, dark background.
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

    // Initialize audio on first user interaction (menu entry)
    if (!SoundManager.isInitialized()) {
      SoundManager.init();
      SoundManager.generateFallbackSounds();
    }
    SoundManager.resume();
    // Play menu music
    SoundManager.playMusic('Intro_GuitarTrack');

    // Load Orbitron font (matches original game's orbitronWhite style)
    if (!document.getElementById('orbitron-font')) {
      const link = document.createElement('link');
      link.id = 'orbitron-font';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&display=swap';
      document.head.appendChild(link);
    }

    this.overlay = document.createElement('div');
    this.overlay.id = 'start-menu';
    this.overlay.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      background: #000; display: flex; flex-direction: column;
      align-items: stretch; z-index: 100; overflow: hidden;
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

    // Dark overlay (PAUSESCREEN_BG = rgba(0,0,0,0.3))
    const darkOverlay = document.createElement('div');
    darkOverlay.style.cssText = `
      position:absolute;top:0;left:0;width:100%;height:100%;
      background:rgba(0,0,0,0.3);pointer-events:none;
    `;
    this.overlay.appendChild(darkOverlay);

    // Gradient fade bars (TextBGFadeTop / TextBGFadeBottom from UI/Shared grad64)
    const gradTop = document.createElement('div');
    gradTop.style.cssText = `
      position:absolute;top:0;left:0;width:100%;height:180px;
      background:linear-gradient(to bottom, rgba(0,0,0,0.6), rgba(0,0,0,0));
      pointer-events:none;
    `;
    this.overlay.appendChild(gradTop);

    const gradBottom = document.createElement('div');
    gradBottom.style.cssText = `
      position:absolute;bottom:0;left:0;width:100%;height:180px;
      background:linear-gradient(to top, rgba(0,0,0,0.6), rgba(0,0,0,0));
      pointer-events:none;
    `;
    this.overlay.appendChild(gradBottom);

    // MOTD background panel
    const motdBg = document.createElement('div');
    motdBg.style.cssText = `
      position:absolute;top:0;left:0;width:55%;height:100%;
      background:rgba(0,0,0,0.5);pointer-events:none;
    `;
    this.overlay.appendChild(motdBg);

    // Logo — rendered from startmenu_atlas, top-left position, scale 1.5 per Lua
    const logoTex = getTexture('startmenu_atlas');
    if (logoTex?.image && logoTex.image instanceof HTMLImageElement) {
      const logoImg = document.createElement('img');
      logoImg.src = logoTex.image.src;
      // StartMenu.png is 2048x4096; logo occupies roughly top 25% of sheet
      logoImg.style.cssText = `
        position:absolute;top:20px;left:20px;
        width:auto;height:200px;
        object-fit:cover;object-position:top left;
      `;
      this.overlay.appendChild(logoImg);
    } else {
      // Text fallback if texture not loaded yet
      const logoLine1 = document.createElement('div');
      logoLine1.textContent = 'SPACEBASE';
      logoLine1.style.cssText = `
        position:absolute;top:30px;left:30px;
        font-family:'Orbitron',monospace;
        font-size:48px;font-weight:700;color:${AMBER};
        text-shadow:0 0 20px rgba(223,162,0,0.5);
      `;
      this.overlay.appendChild(logoLine1);

      const logoLine2 = document.createElement('div');
      logoLine2.textContent = 'DF-9';
      logoLine2.style.cssText = `
        position:absolute;top:90px;left:30px;
        font-family:'Orbitron',monospace;
        font-size:72px;font-weight:700;color:${AMBER};
        text-shadow:0 0 20px rgba(223,162,0,0.5);
      `;
      this.overlay.appendChild(logoLine2);
    }

    // Buttons panel — right side, right-aligned (mirrors Lua nMenuItemsX=100, RIGHT_JUSTIFY)
    const btnsPanel = document.createElement('div');
    btnsPanel.style.cssText = `
      position:absolute;right:80px;top:50%;transform:translateY(-50%);
      display:flex;flex-direction:column;align-items:flex-end;gap:0;
      pointer-events:auto;
    `;

    const buttons = [
      { label: 'NEW GAME', action: this.onNewGame },
      { label: 'TUTORIAL', action: this.onTutorial },
      { label: 'LOAD BASE', action: this.onLoadBase },
    ];

    for (const btn of buttons) {
      const el = document.createElement('div');
      el.textContent = btn.label;
      el.style.cssText = `
        color: ${AMBER};
        font-family: 'Orbitron', monospace;
        font-size: 28px;
        font-weight: 400;
        padding: 16px 0;
        cursor: pointer;
        text-align: right;
        letter-spacing: 2px;
        min-width: 400px;
      `;
      el.addEventListener('mouseenter', () => {
        el.style.color = BRIGHT_AMBER;
        SoundManager.playUI('UI_Hilight');
      });
      el.addEventListener('mouseleave', () => {
        el.style.color = AMBER;
      });
      el.addEventListener('click', () => {
        SoundManager.playUI('Intro_AcceptButton');
        btn.action();
      });
      btnsPanel.appendChild(el);
    }

    this.overlay.appendChild(btnsPanel);

    // Version label (bottom-left)
    const version = document.createElement('div');
    version.textContent = 'v0.1';
    version.style.cssText = `
      position:absolute;bottom:10px;left:10px;
      color:#444;font-size:12px;font-family:monospace;
      pointer-events:none;
    `;
    this.overlay.appendChild(version);

    ctx.container.appendChild(this.overlay);
  }

  update(_dt: number) {}

  exit() {
    SoundManager.stopMusic();
    this.overlay?.remove();
  }
}
