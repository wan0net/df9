import type { SceneContext, SceneState } from '../renderer/SceneManager';
import { getTexture } from '../renderer/AssetLoader';
import { SoundManager } from '../audio/SoundManager';
import { line } from '../localization/Localization';
import { CreditsScreen } from './CreditsScreen';
import { SettingsPanel, type SettingsCallbacks } from './SettingsPanel';
import { SaveSlotPanel } from './SaveSlotPanel';
import { playWarble, playWarbleFullscreen } from './WarbleEffect';

const AMBER = '#dfa200';
const BRIGHT_AMBER = '#FFE696'; // Lua Gui.BRIGHT_AMBER = rgba(255,230,150,1)

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
  private onLoadBase!: (slotName?: string) => void;
  private onSaveBase: ((slotName?: string) => void) | null = null;
  private onResume: (() => void) | null = null;
  private escHandler: ((e: KeyboardEvent) => void) | null = null;
  private audioUnlockHandler: (() => void) | null = null;
  private saveYesNoEl: HTMLDivElement | null = null;
  private creditsScreen = new CreditsScreen();
  private settingsPanel = new SettingsPanel();
  private saveSlotPanel = new SaveSlotPanel();
  /** Set to true when a game session has been started (allows Resume). */
  gameRunning = false;

  constructor(handlers: {
    onNewGame: () => void;
    onTutorial: () => void;
    onLoadBase: (slotName?: string) => void;
    onSaveBase?: (slotName?: string) => void;
    onResume?: () => void;
    settingsCallbacks?: SettingsCallbacks;
  }) {
    this.onNewGame = handlers.onNewGame;
    this.onTutorial = handlers.onTutorial;
    this.onLoadBase = handlers.onLoadBase;
    this.onSaveBase = handlers.onSaveBase ?? null;
    this.onResume = handlers.onResume ?? null;
    if (handlers.settingsCallbacks) {
      this.settingsPanel.setCallbacks(handlers.settingsCallbacks);
    }
  }

  enter(ctx: SceneContext) {
    this.ctx = ctx;

    // Initialize audio eagerly (context will be suspended until user gesture)
    if (!SoundManager.isInitialized()) {
      SoundManager.init();
      SoundManager.generateFallbackSounds();
    }
    // Preload menu audio tracks
    SoundManager.preloadCues([
      'Intro_GuitarTrack', 'Intro_AcceptButton', 'Intro_CancelButton',
      'Intro_LaunchButton', 'UI_Hilight', 'UI_Select',
    ]);

    // AudioContext autoplay policy: context stays suspended until a user gesture.
    // Resume on first interaction, then start music.
    const tryStartMusic = () => {
      SoundManager.resume();
      SoundManager.playMusic('Intro_GuitarTrack');
    };
    // Try immediately (works if returning to menu after game started)
    tryStartMusic();
    // Also listen for first user interaction to unlock audio
    const unlockAudio = () => {
      tryStartMusic();
      document.removeEventListener('pointerdown', unlockAudio);
      document.removeEventListener('keydown', unlockAudio);
      this.audioUnlockHandler = null;
    };
    this.audioUnlockHandler = unlockAudio;
    document.addEventListener('pointerdown', unlockAudio);
    document.addEventListener('keydown', unlockAudio);

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
      position:absolute;top:0;left:0;width:100%;height:64px;
      background:linear-gradient(to bottom, rgba(0,0,0,0.6), rgba(0,0,0,0));
      pointer-events:none;
    `;
    this.overlay.appendChild(gradTop);

    const gradBottom = document.createElement('div');
    gradBottom.style.cssText = `
      position:absolute;bottom:0;left:0;width:100%;height:64px;
      background:linear-gradient(to top, rgba(0,0,0,0.6), rgba(0,0,0,0));
      pointer-events:none;
    `;
    this.overlay.appendChild(gradBottom);

    // MOTD background panel — hidden by default (no content)
    const motdBg = document.createElement('div');
    motdBg.style.cssText = `
      position:absolute;top:0;left:0;width:55%;height:100%;
      background:rgba(0,0,0,0.5);pointer-events:none;display:none;
    `;
    this.overlay.appendChild(motdBg);

    // Game title — original Lua has logo sprite commented out and shows the 3D world behind.
    // We use styled Orbitron text matching the game's visual language.
    const titleTop = document.createElement('div');
    titleTop.textContent = 'SPACEBASE';
    titleTop.style.cssText = `
      position:absolute;top:40px;left:40px;
      font-family:'Orbitron',monospace;
      font-size:42px;font-weight:700;color:${AMBER};
      letter-spacing:4px;
      text-shadow:0 0 30px rgba(223,162,0,0.4), 0 0 60px rgba(223,162,0,0.2);
    `;
    this.overlay.appendChild(titleTop);

    const titleBottom = document.createElement('div');
    titleBottom.textContent = 'DF-9';
    titleBottom.style.cssText = `
      position:absolute;top:105px;left:40px;
      font-family:'Orbitron',monospace;
      font-size:74px;font-weight:700;color:${AMBER};
      letter-spacing:8px;
      text-shadow:0 0 30px rgba(223,162,0,0.5), 0 0 80px rgba(223,162,0,0.3);
    `;
    this.overlay.appendChild(titleBottom);

    // Subtitle — Lua WebsiteText: UIMISC016TEXT, dosismedium32, center-justified
    const subtitle = document.createElement('div');
    subtitle.textContent = line('UIMISC016TEXT');
    subtitle.style.cssText = `
      position:absolute;top:200px;left:40px;
      font-family:'Dosis',sans-serif;font-weight:500;
      font-size:32px;color:${AMBER};opacity:0.8; /* Lua dosismedium32 */
      letter-spacing:1px;
    `;
    this.overlay.appendChild(subtitle);

    // Buttons panel — right side, right-aligned (mirrors Lua nMenuItemsX=100, RIGHT_JUSTIFY)
    const btnsPanel = document.createElement('div');
    btnsPanel.style.cssText = `
      position:absolute;right:60px;top:50%;transform:translateY(-50%);
      display:flex;flex-direction:column;align-items:flex-end;gap:0;
      pointer-events:auto;
    `; // Lua: nMenuItemsX=100 from center, RIGHT_JUSTIFY

    // Lua StartMenu button order: Resume, New Game, Learn to Play, Load Base,
    // Save Base, Settings, Credits, Quit (web: no Quit — can't close browser)
    const buttons: { label: string; action: () => void }[] = [];
    if (this.gameRunning && this.onResume) {
      buttons.push({ label: line('UIMISC023TEXT'), action: this.onResume });
    }
    buttons.push(
      { label: line('UIMISC024TEXT'), action: this.onNewGame },
      { label: line('UIMISC045TEXT'), action: this.onTutorial },
    );
    // Load Base — ALWAYS available (Lua StartMenu button 4, not conditional)
    buttons.push({ label: line('UIMISC044TEXT'), action: () => {
      this.saveSlotPanel.showLoad(this.overlay, (slotName) => {
        this.onLoadBase(slotName);
      }, () => {});
    }});
    // Save Base — when game running (Lua StartMenu button 5)
    if (this.gameRunning && this.onSaveBase) {
      const saveFn = this.onSaveBase;
      buttons.push({ label: line('UIMISC027TEXT'), action: () => {
        this.saveSlotPanel.showSave(this.overlay, (slotName) => {
          saveFn(slotName);
        }, () => {});
      }});
    }
    // Settings (Lua StartMenu button 6: UIMISC025TEXT)
    buttons.push({
      label: line('UIMISC025TEXT'),
      action: () => { this.settingsPanel.show(this.overlay, () => {}); },
    });
    // Credits (Lua StartMenu button 7: UIMISC026TEXT)
    buttons.push({
      label: line('UIMISC026TEXT'),
      action: () => { this.creditsScreen.show(this.overlay, () => {}); },
    });

    for (const btn of buttons) {
      const el = document.createElement('div');
      el.textContent = btn.label;
      el.style.cssText = `
        color: ${AMBER};
        font-family: 'Orbitron', monospace;
        font-size: 65px;
        font-weight: 400;
        height: 70px;
        line-height: 70px;
        margin-bottom: 10px;
        cursor: pointer;
        text-align: right;
        letter-spacing: 3px;
        min-width: 630px;
      `; // Lua: orbitronWhite=65px, nLineHeight=80, button scale 630×70
      el.addEventListener('mouseenter', () => {
        el.style.color = BRIGHT_AMBER;
        SoundManager.playUI('UI_Hilight');
      });
      el.addEventListener('mouseleave', () => {
        el.style.color = AMBER;
      });
      el.addEventListener('click', () => {
        SoundManager.playUI('Intro_AcceptButton');
        playWarbleFullscreen(this.overlay, 0.3, 0.3);
        btn.action();
      });
      btnsPanel.appendChild(el);
    }

    this.overlay.appendChild(btnsPanel);

    // Version label (bottom-center, Lua: "Version 1.06" centered)
    const version = document.createElement('div');
    version.textContent = 'Version 1.06'; // Lua original version
    version.style.cssText = `
      position:absolute;bottom:10px;left:50%;transform:translateX(-50%);
      color:${AMBER};font-size:22px;font-family:'Dosis',sans-serif; /* Lua dosissemibold22 */
      pointer-events:none;
    `;
    this.overlay.appendChild(version);

    ctx.container.appendChild(this.overlay);

    // ESC to resume game if running
    if (this.gameRunning && this.onResume) {
      this.escHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          SoundManager.playUI('Intro_AcceptButton');
          this.onResume!();
        }
      };
      window.addEventListener('keydown', this.escHandler);
    }
  }

  /** Show SaveYesNo confirmation dialog (Lua SaveYesNo.lua). */
  private showSaveYesNo() {
    if (this.saveYesNoEl) return;
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
      background:rgba(0,0,0,0.95);border:2px solid ${AMBER};
      padding:30px 40px;z-index:110;text-align:center;
      font-family:'Orbitron',monospace;
    `;
    const msg = document.createElement('div');
    msg.textContent = `${line('UIMISC027TEXT')}?`;
    msg.style.cssText = `color:${AMBER};font-size:20px;margin-bottom:24px;`;
    dialog.appendChild(msg);

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:16px;justify-content:center;';

    const makeDlgBtn = (label: string, action: () => void) => {
      const btn = document.createElement('div');
      btn.textContent = label;
      btn.style.cssText = `
        color:${AMBER};font-size:44px;padding:10px 20px;cursor:pointer; /* Lua dosismedium44 */
        border:1px solid ${AMBER};font-family:'Dosis',sans-serif;
      `;
      btn.addEventListener('click', action);
      btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(223,162,0,0.2)'; });
      btn.addEventListener('mouseleave', () => { btn.style.background = 'transparent'; });
      return btn;
    };

    // [S] Save & Quit
    btnRow.appendChild(makeDlgBtn(`${line('UIMISC027TEXT')} (S)`, () => {
      this.onSaveBase?.();
      this.closeSaveYesNo();
      // Stay at start menu (game saved)
    }));

    // [Q] Quit without saving
    btnRow.appendChild(makeDlgBtn(`${line('UIMISC043TEXT')} (Q)`, () => {
      this.closeSaveYesNo();
      // In web: just stay at start menu
    }));

    // [ESC] Cancel
    btnRow.appendChild(makeDlgBtn(`${line('BUILDM014TEXT')} (ESC)`, () => {
      this.closeSaveYesNo();
    }));

    dialog.appendChild(btnRow);
    this.overlay.appendChild(dialog);
    this.saveYesNoEl = dialog;

    // Keyboard shortcuts (Lua: S=save&quit, Q=quit, ESC=cancel)
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 's' || e.key === 'S') {
        this.onSaveBase?.();
        this.closeSaveYesNo();
        window.removeEventListener('keydown', keyHandler);
      } else if (e.key === 'q' || e.key === 'Q') {
        this.closeSaveYesNo();
        window.removeEventListener('keydown', keyHandler);
      } else if (e.key === 'Escape') {
        this.closeSaveYesNo();
        window.removeEventListener('keydown', keyHandler);
      }
    };
    window.addEventListener('keydown', keyHandler);
  }

  private closeSaveYesNo() {
    this.saveYesNoEl?.remove();
    this.saveYesNoEl = null;
  }

  update(_dt: number) {}

  exit() {
    SoundManager.stopMusic();
    if (this.escHandler) {
      window.removeEventListener('keydown', this.escHandler);
      this.escHandler = null;
    }
    if (this.audioUnlockHandler) {
      document.removeEventListener('pointerdown', this.audioUnlockHandler);
      document.removeEventListener('keydown', this.audioUnlockHandler);
      this.audioUnlockHandler = null;
    }
    this.overlay?.remove();
  }
}
