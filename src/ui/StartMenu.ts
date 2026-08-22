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
const MOTD_CACHE_KEY = 'df9_startmenu_motd';
const MOTD_URL = 'https://spacebasehub.net/motd.json';
const MAX_MOTD_BYTES = 64 * 1024;
const MAX_MOTD_PARAGRAPHS = 12;
const MAX_MOTD_TEXT_LENGTH = 2_000;
const MOTD_LINK_ORIGINS = new Set([
  'https://spacebasehub.net',
  'https://www.spacebasehub.net',
  'https://spacebasedf9.com',
  'https://www.spacebasedf9.com',
]);
type MotdData = {
  body: Array<{ text: string; y?: number }>;
  footer: { text: string; url: string };
};
const DEFAULT_MOTD = {
  body: [
    { text: 'Thank you for playing Spacebase DF-9 Unofficial v1.09!', y: 70 },
    { text: 'This is the final patch from Skenners and the team at Derelict Games.\nNew features include:  Bug fixes, new objects and cleaned up functionality! Its not perfect but its a hoot!', y: 190 },
  ],
  footer: {
    text: '>> Spacebase Hub: For all your Spacebase DF-9 needs!',
    url: 'https://www.spacebasehub.net/',
  },
} satisfies MotdData;

export function getAllowedMotdUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2_048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !MOTD_LINK_ORIGINS.has(url.origin)) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function validateMotd(value: unknown): MotdData | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as { body?: unknown; footer?: unknown };
  if (!Array.isArray(candidate.body) || candidate.body.length > MAX_MOTD_PARAGRAPHS) return null;
  const body: MotdData['body'] = [];
  for (const item of candidate.body) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const paragraph = item as { text?: unknown; y?: unknown };
    if (typeof paragraph.text !== 'string' || paragraph.text.length > MAX_MOTD_TEXT_LENGTH) return null;
    if (paragraph.y !== undefined && (!Number.isFinite(paragraph.y) || Math.abs(paragraph.y as number) > 100_000)) return null;
    body.push({ text: paragraph.text, ...(paragraph.y === undefined ? {} : { y: paragraph.y as number }) });
  }
  if (!candidate.footer || typeof candidate.footer !== 'object' || Array.isArray(candidate.footer)) return null;
  const footer = candidate.footer as { text?: unknown; url?: unknown };
  const url = getAllowedMotdUrl(footer.url);
  if (typeof footer.text !== 'string' || footer.text.length > MAX_MOTD_TEXT_LENGTH || !url) return null;
  return { body, footer: { text: footer.text, url } };
}

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
  private motdFooterUrl = DEFAULT_MOTD.footer.url;
  private backgroundCanvas: HTMLCanvasElement | null = null;
  private resizeHandler: (() => void) | null = null;
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
    const uiScale = this.getUIScale();
    const scaleStyles = uiScale === 1 
      ? 'width: 100%; height: 100%;' 
      : `transform-origin: top left; transform: scale(${uiScale}); width: ${100 / uiScale}%; height: ${100 / uiScale}%;`;
    this.overlay.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      background: #000; display: flex; flex-direction: column;
      align-items: stretch; z-index: 100; overflow: hidden;
      ${scaleStyles}
    `;

    // Space background
    const spaceTex = getTexture('space_bg');
    if (spaceTex?.image) {
      const bgCanvas = document.createElement('canvas');
      this.backgroundCanvas = bgCanvas;
      this.redrawBackground();
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

    // MOTD dark band — StartMenuLayout.lua positions everything in a
    // 1920x1152, centre-origin coordinate system.  Keep the original offsets
    // expressed relative to the viewport centre so the layout also tracks the
    // original at non-reference aspect ratios.
    const motdBand = document.createElement('div');
    motdBand.style.cssText = `
      position:absolute;left:calc(50% - 1024px);top:calc(50% - 175px);
      width:2568px;height:625px;
      background:linear-gradient(to right, rgba(0,0,0,0.68), rgba(0,0,0,0.52) 46%, rgba(0,0,0,0.56));
      pointer-events:none;
    `;
    this.overlay.appendChild(motdBand);

    const motdBandFadeTop = document.createElement('div');
    motdBandFadeTop.style.cssText = `
      position:absolute;left:calc(50% - 1024px);top:calc(50% - 239px);
      width:2568px;height:64px;
      background:linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.6));
      pointer-events:none;
    `;
    this.overlay.appendChild(motdBandFadeTop);

    const motdBandFadeBottom = document.createElement('div');
    motdBandFadeBottom.style.cssText = `
      position:absolute;left:calc(50% - 1024px);top:calc(50% + 514px);
      width:2568px;height:64px;
      background:linear-gradient(to bottom, rgba(0,0,0,0.6), rgba(0,0,0,0));
      pointer-events:none;
    `;
    this.overlay.appendChild(motdBandFadeBottom);

    // MOTD / SpaceBaseHub column — static offline approximation of the original
    // network-fed left panel. Kept deliberately plain and amber-on-black.
    const motdBg = document.createElement('div');
    motdBg.dataset.testid = 'start-menu-motd';
    motdBg.style.cssText = `
      position:absolute;left:calc(50% - 900px);top:calc(50% - 150px);
      width:940px;height:650px;box-sizing:border-box;
      pointer-events:none;display:flex;flex-direction:column;gap:18px;
      padding-top:0;
    `;
    const motdTitle = document.createElement('div');
    motdTitle.textContent = line('UIMISC022TEXT');
    motdTitle.style.cssText = `
      color:${AMBER};font-family:'Dosis',sans-serif;font-size:38px;
      font-weight:600;letter-spacing:0.2px;line-height:1;
    `;
    motdBg.appendChild(motdTitle);

    const motdBody = document.createElement('div');
    motdBody.style.cssText = `
      display:flex;flex-direction:column;gap:26px;max-width:940px;
      color:${AMBER};font-family:'Dosis',sans-serif;font-size:32px;
      font-weight:500;line-height:1.26;letter-spacing:0.05px;opacity:0.95;
      white-space:pre-wrap;
    `;
    motdBg.appendChild(motdBody);

    const motdFooter = document.createElement('div');
    motdFooter.textContent = '>> Spacebase Hub: For all your Spacebase DF-9 needs!';
    motdFooter.style.cssText = `
      margin-top:auto;
      color:${AMBER};font-family:'Dosis',sans-serif;font-size:19px;
      font-weight:600;letter-spacing:0.3px;line-height:1.2;
      max-width:740px;opacity:0.95;pointer-events:auto;cursor:pointer;
      transition:color 0.12s ease, opacity 0.12s ease;
      padding-bottom:14px;
    `;
    motdFooter.addEventListener('mouseenter', () => {
      motdFooter.style.color = BRIGHT_AMBER;
      motdFooter.style.opacity = '1';
      SoundManager.playUI('UI_Hilight');
    });
    motdFooter.addEventListener('mouseleave', () => {
      motdFooter.style.color = AMBER;
      motdFooter.style.opacity = '0.95';
    });
    motdFooter.addEventListener('click', () => {
      window.open(this.motdFooterUrl, '_blank', 'noopener,noreferrer');
    });
    motdBg.appendChild(motdFooter);
    this.overlay.appendChild(motdBg);
    this.renderMotd(DEFAULT_MOTD, motdBody, motdFooter);
    void this.loadMotd(motdBody, motdFooter);

    // Game logo — Lua StartMenuLayout: Logo element with hidden=false, scale 1.5
    const logoImg = document.createElement('img');
    logoImg.src = 'assets/ui/startmenu_logo.png';
    logoImg.dataset.testid = 'start-menu-logo';
    logoImg.style.cssText = `
      position:absolute;top:calc(50% - 626px);left:calc(50% - 960px);
      width:${1280 * 1.5}px;height:auto;
      pointer-events:none;filter:drop-shadow(0 0 18px rgba(223,162,0,0.28));
    `;
    this.overlay.appendChild(logoImg);

    // WebsiteText / ButtonWebsite — centered clickable subtitle beneath the logo.
    const websiteRow = document.createElement('div');
    websiteRow.dataset.testid = 'start-menu-website';
    websiteRow.style.cssText = `
      position:absolute;top:calc(50% - 260px);left:calc(50% - 400px);
      width:800px;height:70px;
      display:flex;align-items:center;justify-content:center;
      cursor:pointer;pointer-events:auto;z-index:2;
    `;
    const subtitle = document.createElement('div');
    subtitle.textContent = line('UIMISC016TEXT');
    subtitle.style.cssText = `
      font-family:'Dosis',sans-serif;font-weight:500;
      font-size:32px;color:${AMBER};opacity:0.82;text-align:center;
      letter-spacing:0.8px;text-shadow:0 1px 0 rgba(0,0,0,0.9);
      transition:color 0.12s ease, opacity 0.12s ease;
    `;
    websiteRow.appendChild(subtitle);
    websiteRow.addEventListener('mouseenter', () => {
      subtitle.style.color = BRIGHT_AMBER;
      subtitle.style.opacity = '1';
      SoundManager.playUI('UI_Hilight');
    });
    websiteRow.addEventListener('mouseleave', () => {
      subtitle.style.color = AMBER;
      subtitle.style.opacity = '0.82';
    });
    websiteRow.addEventListener('click', () => {
      window.open('https://spacebasedf9.com/', '_blank', 'noopener,noreferrer');
    });
    this.overlay.appendChild(websiteRow);

    // Buttons panel — right side, right-aligned (mirrors Lua nMenuItemsX=100, RIGHT_JUSTIFY)
    const btnsPanel = document.createElement('div');
    btnsPanel.dataset.testid = 'start-menu-buttons';
    const firstButtonY = this.gameRunning && this.onResume ? 120 : 40;
    btnsPanel.style.cssText = `
      position:absolute;left:calc(50% + 100px);top:calc(50% - ${firstButtonY}px);
      width:800px;display:flex;flex-direction:column;align-items:stretch;gap:10px;
      pointer-events:auto;
    `; // Lua: nMenuItemsX=100 from center, RIGHT_JUSTIFY

    // Lua StartMenu button order: Resume, New Game, Learn to Play, Load Base,
    // Save Base, Settings, Credits, Quit
    const buttons: { label: string; action: () => void }[] = [];
    if (this.gameRunning && this.onResume) {
      buttons.push({ label: line('UIMISC023TEXT'), action: this.onResume });
    }
    buttons.push(
      { label: line('UIMISC024TEXT'), action: this.onNewGame },
      { label: line('UIMISC045TEXT'), action: this.onTutorial },
    );
    // Load Base — ALWAYS available (Lua StartMenu button 4, hardcoded 'LOAD BASE')
    buttons.push({ label: 'LOAD BASE', action: () => {
      this.saveSlotPanel.showLoad(this.overlay, (slotName) => {
        this.onLoadBase(slotName);
      }, () => {});
    }});
    // Save Base — when game running (Lua StartMenu button 5)
    if (this.gameRunning && this.onSaveBase) {
      const saveFn = this.onSaveBase;
      buttons.push({ label: 'SAVE BASE', action: () => {
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
    // Quit — web fallback returns to the start menu by reloading the page.
    buttons.push({
      label: line('UIMISC027TEXT'),
      action: () => {
        if (this.gameRunning && this.onSaveBase) {
          this.showSaveYesNo();
        } else {
          window.location.reload();
        }
      },
    });

    for (const btn of buttons) {
      const el = document.createElement('div');
      const hitArea = document.createElement('div');
      hitArea.textContent = btn.label;
      el.style.cssText = `
        height: 70px;
        display:flex;
        justify-content:flex-end;
        align-items:center;
        cursor:pointer;
        width:100%;
        box-sizing:border-box;
      `; // Lua: orbitronWhite=65px, nLineHeight=80, button scale 630×70
      hitArea.style.cssText = `
        color:${AMBER};
        font-family:'Orbitron',monospace;
        font-size:60px;
        font-weight:400;
        height:70px;
        line-height:70px;
        text-align:right;
        letter-spacing:2.3px;
        width:630px;
        padding-right:6px;
        box-sizing:border-box;
        transition:color 0.12s ease, background-color 0.12s ease;
      `;
      el.appendChild(hitArea);
      el.addEventListener('mouseenter', () => {
        hitArea.style.color = BRIGHT_AMBER;
        hitArea.style.background = 'rgba(0,0,0,0.08)';
        SoundManager.playUI('UI_Hilight');
      });
      el.addEventListener('mouseleave', () => {
        hitArea.style.color = AMBER;
        hitArea.style.background = 'transparent';
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
      color:${AMBER};font-size:22px;font-family:'Dosis',sans-serif;
      text-shadow:0 1px 0 rgba(0,0,0,0.9); /* Lua dosissemibold22 */
      pointer-events:none;
    `;
    this.overlay.appendChild(version);

    ctx.container.appendChild(this.overlay);
    this.resizeHandler = () => this.applyLayout();
    window.addEventListener('resize', this.resizeHandler);
    this.applyLayout();

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

  private renderMotd(
    data: MotdData,
    motdBody: HTMLDivElement,
    motdFooter: HTMLDivElement,
  ) {
    motdBody.textContent = '';
    const body = [...data.body].sort((a, b) => (a.y ?? 0) - (b.y ?? 0));
    for (const paragraph of body) {
      if (!paragraph.text) continue;
      const p = document.createElement('div');
      p.textContent = paragraph.text;
      motdBody.appendChild(p);
    }
    this.motdFooterUrl = data.footer.url;
    motdFooter.textContent = data.footer.text;
  }

  private async loadMotd(motdBody: HTMLDivElement, motdFooter: HTMLDivElement) {
    const cached = localStorage.getItem(MOTD_CACHE_KEY);
    if (cached) {
      try {
        const data = validateMotd(JSON.parse(cached));
        if (!data) throw new Error('Invalid cached MOTD');
        this.renderMotd(data, motdBody, motdFooter);
      } catch {
        localStorage.removeItem(MOTD_CACHE_KEY);
      }
    }
    try {
      const response = await fetch(MOTD_URL, {
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      });
      if (!response.ok) return;
      const contentLength = Number(response.headers.get('content-length'));
      if (Number.isFinite(contentLength) && contentLength > MAX_MOTD_BYTES) return;
      const text = await response.text();
      if (new Blob([text]).size > MAX_MOTD_BYTES) return;
      const data = validateMotd(JSON.parse(text));
      if (!data) return;
      localStorage.setItem(MOTD_CACHE_KEY, JSON.stringify(data));
      this.renderMotd(data, motdBody, motdFooter);
    } catch {
      // Keep cached/default content when offline or blocked.
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

  private applyLayout() {
    if (!this.overlay) return;
    const uiScale = this.getUIScale();
    if (uiScale === 1) {
      this.overlay.style.transformOrigin = 'top left';
      this.overlay.style.transform = '';
      this.overlay.style.width = '100%';
      this.overlay.style.height = '100%';
    } else {
      this.overlay.style.transformOrigin = 'top left';
      this.overlay.style.transform = `scale(${uiScale})`;
      this.overlay.style.width = `${100 / uiScale}%`;
      this.overlay.style.height = `${100 / uiScale}%`;
    }
    this.redrawBackground();
  }

  private redrawBackground() {
    const bgCanvas = this.backgroundCanvas;
    if (!bgCanvas) return;
    const spaceTex = getTexture('space_bg');
    bgCanvas.width = window.innerWidth;
    bgCanvas.height = window.innerHeight;
    const bgCtx = bgCanvas.getContext('2d');
    if (!bgCtx || !(spaceTex?.image instanceof HTMLImageElement)) return;
    bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
    bgCtx.globalAlpha = 0.6;
    for (let y = 0; y < bgCanvas.height; y += spaceTex.image.height) {
      for (let x = 0; x < bgCanvas.width; x += spaceTex.image.width) {
        bgCtx.drawImage(spaceTex.image, x, y);
      }
    }
  }

  private getUIScale(): number {
    const stored = localStorage.getItem('df9_ui_scale');
    if (stored) {
      const v = parseFloat(stored);
      if (v > 0 && v <= 2) return v;
    }
    return Math.min(1, window.innerWidth / 1920);
  }

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
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }
    this.backgroundCanvas = null;
    this.overlay?.remove();
  }
}
