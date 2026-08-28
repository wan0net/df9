import type { SceneContext, SceneState } from '../renderer/SceneManager';
import { getTexture } from '../renderer/AssetLoader';
import { SoundManager } from '../audio/SoundManager';
import { line } from '../localization/Localization';
import { playWarbleFullscreen } from './WarbleEffect';
import { GameRules } from '../core/GameRules';
import { getStoredOrAutoUIScale } from './UIScale';
import { assetUrl } from '../assetUrl';

const AMBER_HEX = '#dfa200';
const GREEN_HEX = '#a5d318';
const RED_HEX   = '#ff3d00';

/** INFO_MAP_SIZE — mirrors NewBase.lua:31 */
const INFO_MAP_SIZE = 64;

const END_ANIM_INITIAL_DELAY          = 2.0;
const END_ANIM_ZOOM_TIME              = 2.5;
const END_ANIM_YEARS_DELAY            = 0.5;
const END_ANIM_BEFORE_COUNTDOWN_DELAY = 2.0;
const END_ANIM_COUNTDOWN_TIME         = 2.5;
const END_ANIM_FADE_OUT_TIME          = 0.5;
const MAX_YEARS = 358042;

/** Tutorial marker grid coords — NewBase.lua:228 */
const TUTORIAL_X = 12;
const TUTORIAL_Y = 34;

/**
 * Sidebar widths — native Lua pixel sizes.
 * Extracted NewGame sprites keep their native Lua dimensions.
 */
const LEFT_SIDEBAR_W = 405;
const LEFT_SIDEBAR_TILE_W = 340;
const RIGHT_SIDEBAR_W = 158;
const RIGHT_SIDEBAR_TILE_W = 128;
/** Lua NewBase:setMapLoc(): map begins at tile width - 90 and ends 146px from the right. */
const MAP_LEFT = LEFT_SIDEBAR_TILE_W - 90;
const MAP_RIGHT = 146;

type GameState = 'Initial' | 'SelectedLandingZone' | 'ConfirmedLandingZone' | 'Deploying' | 'Deployed';

interface LandingZone {
  x: number;
  y: number;
  density: number;
  threat: number;
  distance: number;
  interference: number;
}

// ── Word lists — NewBaseInspector.lua + MainGame_enUS.lua ─────────────────────

const REGION_ADJECTIVES = [
  // NEWBAS023-034, NEWBAS041, NEWBAS043
  'Puce','Dark','Cute','Green','Yummy','Gold','Scary','Purple','Viridian','Wobbly','Black','Lost','Gravy','Belt',
  // NEWBAS060-099
  'Empty','Deep','Uncharted','Forgotten','Forbidden','Discouraged','Unrecommended','Far',
  'Rift','Ring','Pearl','Jade','Ruby','Aluminum','Platinum','Lithium','Iridium','Calcium',
  'Barium','Tin','Ghost','Skull','Helix','Spider','Dwarf','Divine','Shadow','Intercourse',
  'Peculiar','Knob','Spinward','Darrian','Regina','Allel','Reaver','Scarran','Neutral',
  'Breakaway','Demilitarized','Excalibur',
  // NEWBAS100-151
  'Caduceus','Reserved','Unremarkable','Aromatic','Odorous','Accidental','Corpulent',
  'Execrable','Obnoxious','Irksome','Creepy','Foul','Rude','Ridiculous','Dreadful',
  'Abrasive','Limp','Spasmodic','Swollen','Turgid','Moist','Conjugal','Gelatinous',
  'Chartreuse','Congealed','Bulbous','Slimy','Lugubrious','Viscous','Clogged','Abnormal',
  'Indescribable','Nameless','Non-Euclidean','Stygian','Unmentionable','Unnameable',
  'Unutterable','Spectral','Loathsome','Cyclopean','Amorphous','Antique','Dank','Gibbous',
  'Iridescent','Blasphemous','Tedious','Wafer-thin','Unladened','Farcical','Ruthless',
  // Greek letters (ZONEUI018-033)
  'Epsilon','Zeta','Alpha','Beta','Gamma','Delta','Theta','Iota','Lambda','Mu','Omicron',
  'Rho','Sigma','Tau','Upsilon','Omega',
  // Colors (ZONEUI073-084)
  'Cobalt','Viridian','Alizarin','Yellow','Blue','Green','Red','Orange','Violet','Magenta','Cyan','Emerald',
];

const REGION_NOUNS = [
  // NEWBAS035-040, NEWBAS044-059
  'Region','Zone','Sector','Quadrant','Nebula','Cluster',
  'Quarter','Field','Subsector','Pocket','Territories','District',
  'Arm','Rim','Expanse','Corridor','Worlds','Systems','Marches','Wastes','Space','Cloud',
];

/** Severity linecodes — MiscUtil.tSeverityCodes (9 steps, low→high) */
const SEVERITY_CODES = [
  'UIMISC008TEXT','UIMISC003TEXT','UIMISC001TEXT',
  'UIMISC002TEXT','UIMISC010TEXT','UIMISC004TEXT',
  'UIMISC005TEXT','UIMISC006TEXT','UIMISC009TEXT',
];

/** Distance linecodes — MiscUtil.tDistanceCodes (5 steps) */
const DISTANCE_CODES = ['UIMISC042TEXT','UIMISC013TEXT','UIMISC012TEXT','UIMISC041TEXT','UIMISC011TEXT'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function cellHash(x: number, y: number, salt: number): number {
  const n = (x * 73856093 ^ y * 19349663 ^ salt * 83492791) >>> 0;
  return (n * 2654435761 >>> 0) / 4294967296;
}

function severityText(v: number): string {
  const idx = Math.min(SEVERITY_CODES.length - 1, Math.floor(v * SEVERITY_CODES.length));
  return line(SEVERITY_CODES[idx]);
}

function distanceText(v: number): string {
  const idx = Math.min(DISTANCE_CODES.length - 1, Math.floor(v * DISTANCE_CODES.length));
  return line(DISTANCE_CODES[idx]);
}

/** density color: high=green, low=red — NewBaseInspector.lua:105-107 */
function densityColor(v: number): string {
  return v > 0.66 ? GREEN_HEX : v < 0.33 ? RED_HEX : AMBER_HEX;
}

/** threat color: high=red, low=green — NewBaseInspector.lua:113-116 */
function threatColor(v: number): string {
  return v > 0.66 ? RED_HEX : v < 0.33 ? GREEN_HEX : AMBER_HEX;
}

/**
 * Region name: "Adjective Noun X-Y" — NewBaseInspector.lua:172-176
 * Deterministic from grid coordinates.
 */
function getRegionName(x: number, y: number): string {
  const adj  = REGION_ADJECTIVES[Math.floor(cellHash(x, y, 1) * REGION_ADJECTIVES.length)];
  const noun = REGION_NOUNS[Math.floor(cellHash(x, y, 2) * REGION_NOUNS.length)];
  return `${adj} ${noun} ${x}-${y}`;
}

/**
 * Age in billion years — NewBaseInspector.lua:102:
 *   math.abs(math.sin(math.rad(x*15))) * 10 + 5
 */
function getAge(x: number): number {
  return Math.round(Math.abs(Math.sin((x * 15) * Math.PI / 180)) * 10 + 5);
}

/** Set a DOM element's text and color in one call. */
function setColored(el: HTMLElement, label: string, value: string, color: string) {
  el.textContent = '';
  const lbl = document.createElement('span');
  // Linecodes already end with ":" — just add a space
  lbl.textContent = label + ' ';
  lbl.style.color = AMBER_HEX;
  const val = document.createElement('span');
  val.textContent = value;
  val.style.color = color;
  el.append(lbl, val);
}

/** Load an image from a URL. Returns null if not found. */
function loadImg(src: string): HTMLImageElement {
  const img = new Image();
  img.src = assetUrl(src);
  return img;
}

function isTutorialLandingZone(x: number, y: number): boolean {
  return (x === 12 && y === 34) || (x === 13 && y === 34);
}

// ── Screen ────────────────────────────────────────────────────────────────────

/**
 * Galaxy map landing zone selection + deployment animation.
 * Mirrors NewBase.lua + NewBaseLayout.lua + NewBaseInspector.lua.
 */
export class NewGameScreenState implements SceneState {
  private ctx!: SceneContext;
  private overlay!: HTMLDivElement;
  private canvas!: HTMLCanvasElement;
  private canvasCtx!: CanvasRenderingContext2D;

  private state: GameState = 'Initial';
  private selectedZone: LandingZone | null = null;
  private deployTime = 0;

  private mapW = 0;
  private mapH = 0;
  private mapX = 0;
  private mapY = 0;
  private hoverGx = -1;
  private hoverGy = -1;

  /** Inspector slide-in timer — NewBaseInspector.lua:150-169 */
  private inspectorTimer  = 0;
  private inspectorActive = false;
  private resizeHandler: (() => void) | null = null;

  private onStartGame: (lz: LandingZone, tutorial: boolean) => void;
  private onBack: () => void;

  // DOM refs
  private infoPanel!: HTMLDivElement;
  private panelName!: HTMLDivElement;
  private panelAge!: HTMLDivElement;
  private panelDensity!: HTMLDivElement;
  private panelDistance!: HTMLDivElement;
  private panelThreat!: HTMLDivElement;
  private panelInterference!: HTMLDivElement;
  private regionSelectionLabel!: HTMLDivElement;
  private flavorA!: HTMLDivElement;
  private flavorB!: HTMLDivElement;
  private tutorialLabel!: HTMLDivElement;
  private inspectorPreviewWrap!: HTMLDivElement;
  private telemetryPanel!: HTMLDivElement;
  private telemetryDensity!: HTMLDivElement;
  private telemetryDistance!: HTMLDivElement;
  private telemetryThreat!: HTMLDivElement;
  private telemetryInterference!: HTMLDivElement;
  private helpFolder!: HTMLDivElement;
  private helpText!: HTMLDivElement;
  private deployOverlay!: HTMLDivElement;
  private deployMsg!: HTMLDivElement;
  private deployEta!: HTMLDivElement;
  private deployYears!: HTMLDivElement;
  private deployTextWrap!: HTMLDivElement;
  private deployArrivalRow!: HTMLDivElement;

  // Sprite buttons — Lua layout elements
  private confirmBtnEl!: HTMLDivElement;
  private confirmImg!: HTMLImageElement;
  private declineBtnEl!: HTMLDivElement;
  private declineImg!: HTMLImageElement;
  private launchCoverEl!: HTMLImageElement;
  private launchActiveEl!: HTMLDivElement;
  private cancelBtnEl!: HTMLDivElement;
  private leftSidebar!: HTMLDivElement;
  private rightSidebar!: HTMLDivElement;

  private galaxyImg: HTMLImageElement | null = null;

  // Preload sprite images for snappy display
  private _preloads = [
    loadImg('assets/ui/newgame/launchbutton_cover.png'),
    loadImg('assets/ui/newgame/launchbutton_active.png'),
    loadImg('assets/ui/newgame/ui_newgame_buttonConfirm_inactive.png'),
    loadImg('assets/ui/newgame/ui_newgame_buttonConfirm_active.png'),
    loadImg('assets/ui/newgame/ui_newgame_buttonDecline_inactive.png'),
    loadImg('assets/ui/newgame/ui_newgame_buttonDecline_active.png'),
    loadImg('assets/ui/newgame/ui_newgame_sidebarLeft.png'),
    loadImg('assets/ui/newgame/ui_newgame_sidebarLeft_tile.png'),
    loadImg('assets/ui/newgame/ui_newgame_sidebarRight.png'),
    loadImg('assets/ui/newgame/ui_newgame_sidebarRight_tile.png'),
    loadImg('assets/ui/newgame/ui_newgame_sidebarRight_bottom.png'),
    loadImg('assets/ui/newgame/galaxy_zoom01.png'),
    loadImg('assets/ui/inspector/ui_inspector_folderTop.png'),
    loadImg('assets/ui/inspector/ui_inspector_folderActive.png'),
  ];

  constructor(handlers: { onStartGame: (lz: LandingZone, tutorial: boolean) => void; onBack: () => void }) {
    this.onStartGame = handlers.onStartGame;
    this.onBack = handlers.onBack;
  }

  enter(ctx: SceneContext) {
    this.ctx = ctx;
    this.state = 'Initial';
    this.selectedZone = null;
    this.deployTime = 0;
    this.inspectorTimer = 0;
    this.inspectorActive = false;

    SoundManager.playUI('Intro_LaunchScreen');  // Lua: cursorappear

    const galaxyTex = getTexture('galaxy_map');
    if (galaxyTex?.image instanceof HTMLImageElement) this.galaxyImg = galaxyTex.image;

    this.overlay = document.createElement('div');
    this.overlay.id = 'new-game';
    const uiScale = this.getUIScale();
    const scaleStyles = uiScale === 1 
      ? 'width: 100%; height: 100%;' 
      : `transform-origin: top left; transform: scale(${uiScale}); width: ${100/uiScale}%; height: ${100/uiScale}%;`;
    this.overlay.style.cssText = `position:absolute;top:0;left:0;width:100%;height:100%;background:#000;z-index:100;font-family:'Orbitron',monospace;overflow:hidden;${scaleStyles}`;

    this.canvas = document.createElement('canvas');
    this.canvas.dataset.testid = 'new-game-map';
    this.canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;';
    this.canvasCtx = this.canvas.getContext('2d')!;
    this.overlay.appendChild(this.canvas);

    this.buildSidebars();
    this.buildTelemetryPanel();
    this.buildInfoPanel();
    this.buildConfirmDecline();
    this.buildLaunchButton();
    this.buildHelpText();
    this.buildDeployOverlay();

    this.regionSelectionLabel = this.el('div',
      `position:absolute;left:10px;top:8px;color:rgba(255,255,255,0.72);
       font-size:11px;font-family:'Dosis',sans-serif;font-weight:600;
       letter-spacing:0.2px;z-index:7;pointer-events:none;`,
      'Region Selection') as HTMLDivElement;
    this.overlay.appendChild(this.regionSelectionLabel);

    // Flavor text — Lua: FlavorTextALabel (NEWBAS021TEXT) + FlavorTextBLabel (NEWBAS022TEXT)
    // Positioned at 314px from left edge (just right of left sidebar)
    this.flavorA = this.el('div',
      `position:absolute;top:26px;left:314px;color:${AMBER_HEX};font-size:26px;font-weight:600;z-index:6;font-family:'Dosis',sans-serif;white-space:pre-line;line-height:1.18;letter-spacing:0.2px;text-shadow:0 1px 0 rgba(0,0,0,0.8);max-width:1000px;` /* Lua dosissemibold26 */,
      line('NEWBAS021TEXT')) as HTMLDivElement;
    this.overlay.appendChild(this.flavorA);
    this.flavorB = this.el('div',
      `position:absolute;top:126px;left:314px;color:${AMBER_HEX};font-size:18px;z-index:6;font-family:'Dosis',sans-serif;font-style:italic;line-height:1.1;letter-spacing:0.05px;text-shadow:0 1px 0 rgba(0,0,0,0.8);` /* Lua dosissemibold18 */,
      line('NEWBAS022TEXT')) as HTMLDivElement;
    this.overlay.appendChild(this.flavorB);

    this.tutorialLabel = this.el('div',
      `position:absolute;left:${this.mapX + 138}px;top:${this.mapY + 370}px;color:${AMBER_HEX};
       font-size:35px;font-family:'Dosis',sans-serif;font-weight:600;letter-spacing:0.4px;
       z-index:6;pointer-events:none;text-shadow:0 1px 0 rgba(0,0,0,0.8);`,
      line('NEWBAS042TEXT')) as HTMLDivElement;
    this.overlay.appendChild(this.tutorialLabel);

    // Lua: ButtonSandboxActive {-W/2+170, -(H/2)+605} 50×50; LabelSandbox {-W/2+30, H/2-550} dosisregular35
    const sandboxCheck = document.createElement('div');
    sandboxCheck.style.cssText = `position:absolute;left:170px;bottom:605px;width:50px;height:50px;border:2px solid ${AMBER_HEX};display:flex;align-items:center;justify-content:center;font-size:32px;color:${AMBER_HEX};z-index:5;cursor:pointer;`;
    sandboxCheck.textContent = '';
    const sandboxLabel = this.el('div', `position:absolute;left:18px;top:550px;color:${AMBER_HEX};font-size:35px;font-family:'Dosis',sans-serif;font-weight:400;letter-spacing:1px;z-index:5;cursor:pointer;text-shadow:0 1px 0 rgba(0,0,0,0.7);`, 'SANDBOX');
    let sandboxActive = false;
    const toggleSandbox = () => {
      sandboxActive = !sandboxActive;
      sandboxCheck.textContent = sandboxActive ? '\u2714' : '';
      sandboxCheck.style.background = sandboxActive ? AMBER_HEX : 'transparent';
      sandboxCheck.style.color = sandboxActive ? '#000' : AMBER_HEX;
      GameRules.bSandboxMode = sandboxActive;
      SoundManager.playUI('Intro_AcceptButton');
    };
    sandboxCheck.addEventListener('click', toggleSandbox);
    sandboxLabel.addEventListener('click', toggleSandbox);
    sandboxLabel.addEventListener('mouseenter', () => { sandboxLabel.style.color = '#FFE696'; });
    sandboxLabel.addEventListener('mouseleave', () => { sandboxLabel.style.color = AMBER_HEX; });
    this.overlay.appendChild(sandboxCheck);
    this.overlay.appendChild(sandboxLabel);

    // Back
    const backBtn = this.el('div',
      `position:absolute;bottom:30px;left:24px;color:#888;font-size:35px;cursor:pointer;z-index:5;font-family:'Dosis',sans-serif;letter-spacing:1px;` /* Lua dosisregular35 */,
      line('NEWBUI001TEXT'));
    backBtn.addEventListener('click', this.onBack);
    backBtn.addEventListener('mouseenter', () => { backBtn.style.color = AMBER_HEX; });
    backBtn.addEventListener('mouseleave', () => { backBtn.style.color = '#888'; });
    this.overlay.appendChild(backBtn);

    this.canvas.addEventListener('click',     (e) => this.onMapClick(e));
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.resizeHandler = () => this.applyLayout();
    window.addEventListener('resize', this.resizeHandler);

    ctx.container.appendChild(this.overlay);
    this.applyLayout();
    this.draw();
  }

  // ── Build UI elements ────────────────────────────────────────────────────────

  private buildSidebars() {
    const uiScale = this.getUIScale();
    const h = Math.round(window.innerHeight / uiScale);

    // ── Left sidebar ──────────────────────────────────────────────────
    // Lua: top piece at left edge, tiles repeat, bottom piece at -(H/2)+350.
    this.leftSidebar = document.createElement('div');
    this.leftSidebar.dataset.testid = 'new-game-left-sidebar';
    this.leftSidebar.style.cssText = `position:absolute;left:0;top:0;width:${LEFT_SIDEBAR_W}px;height:${h}px;z-index:3;pointer-events:none;overflow:hidden;`;

    // Tile background — fills the entire height seamlessly via CSS repeat
    const lTileBg = document.createElement('div');
    lTileBg.style.cssText = `position:absolute;left:0;top:0;width:${LEFT_SIDEBAR_TILE_W}px;height:100%;background:url('${assetUrl('assets/ui/newgame/ui_newgame_sidebarLeft_tile.png')}') left top repeat-y;background-size:${LEFT_SIDEBAR_TILE_W}px auto;`;
    this.leftSidebar.appendChild(lTileBg);

    // Top piece — overlays the tile background at the top
    const lTop = document.createElement('img');
    lTop.src = assetUrl('assets/ui/newgame/ui_newgame_sidebarLeft.png');
    lTop.style.cssText = `position:absolute;left:0;top:0;width:${LEFT_SIDEBAR_W}px;`;
    this.leftSidebar.appendChild(lTop);

    // Bottom piece — Lua: pos = { '-W/2', '-(H/2) + 350' }
    // Top of sprite at 350px from viewport bottom.
    const lBottom = document.createElement('img');
    lBottom.src = assetUrl('assets/ui/newgame/ui_newgame_sidebarLeft_bottom.png');
    lBottom.style.cssText = `position:absolute;left:0;top:calc(100% - 350px);width:${LEFT_SIDEBAR_W}px;`;
    this.leftSidebar.appendChild(lBottom);

    this.overlay.appendChild(this.leftSidebar);

    // ── Right sidebar ─────────────────────────────────────────────────
    // Lua: top piece at W/2 - 156, tiles at W/2 - 126, bottom at W/2 - 146.
    // Container is 156px wide (matching the rightmost position offset).
    this.rightSidebar = document.createElement('div');
    this.rightSidebar.dataset.testid = 'new-game-right-sidebar';
    this.rightSidebar.style.cssText = `position:absolute;right:0;top:0;width:${RIGHT_SIDEBAR_W}px;height:${h}px;z-index:3;pointer-events:none;overflow:hidden;`;

    // Tile background — Lua: tiles at W/2 - 126 (30px inset from container left)
    const rTileBg = document.createElement('div');
    rTileBg.style.cssText = `position:absolute;left:30px;top:0;width:calc(100% - 30px);height:100%;background:url('${assetUrl('assets/ui/newgame/ui_newgame_sidebarRight_tile.png')}') left top repeat-y;background-size:auto;`;
    this.rightSidebar.appendChild(rTileBg);

    // Top piece — flush with container left at its extracted native width.
    const rTop = document.createElement('img');
    rTop.src = assetUrl('assets/ui/newgame/ui_newgame_sidebarRight.png');
    rTop.style.cssText = `position:absolute;left:0;top:0;width:${RIGHT_SIDEBAR_W}px;`;
    this.rightSidebar.appendChild(rTop);

    // Bottom piece — Lua: pos = { '(W/2) - 146', '-(H/2) + 382' }
    // 10px inset from container left (156-146=10), top at 382px from bottom.
    const rBottom = document.createElement('img');
    rBottom.src = assetUrl('assets/ui/newgame/ui_newgame_sidebarRight_bottom.png');
    rBottom.style.cssText = `position:absolute;left:10px;top:calc(100% - 382px);width:146px;`;
    this.rightSidebar.appendChild(rBottom);

    this.overlay.appendChild(this.rightSidebar);
  }

  private buildTelemetryPanel() {
    this.telemetryPanel = document.createElement('div');
    this.telemetryPanel.dataset.testid = 'new-game-telemetry';
    this.telemetryPanel.style.cssText = `
      position:absolute;right:15px;top:18px;width:550px;padding:0;
      z-index:4;color:${AMBER_HEX};font-size:28px;line-height:1.25;
      font-family:'Dosis',sans-serif;pointer-events:none;box-sizing:border-box;
      text-shadow:0 1px 0 rgba(0,0,0,0.75);
    `;

    const makeRow = () => {
      const row = document.createElement('div');
      row.style.cssText = 'height:35px;white-space:nowrap;';
      return row;
    };

    this.telemetryDensity = makeRow();
    this.telemetryDistance = makeRow();
    this.telemetryThreat = makeRow();
    this.telemetryInterference = makeRow();
    this.telemetryPanel.append(
      this.telemetryDensity,
      this.telemetryDistance,
      this.telemetryThreat,
      this.telemetryInterference,
    );

    this.overlay.appendChild(this.telemetryPanel);
    this.updateTelemetry(null);
  }

  private applyLayout() {
    const uiScale = this.getUIScale();
    const w = Math.round(window.innerWidth / uiScale);
    const h = Math.round(window.innerHeight / uiScale);
    this.canvas.width = w;
    this.canvas.height = h;

    this.mapX = MAP_LEFT;
    this.mapY = 0;
    this.mapW = Math.max(1, w - MAP_LEFT - MAP_RIGHT);
    this.mapH = h;
    this.canvas.dataset.mapLeft = String(this.mapX);
    this.canvas.dataset.mapWidth = String(this.mapW);

    if (this.leftSidebar) this.leftSidebar.style.height = `${h}px`;
    if (this.rightSidebar) this.rightSidebar.style.height = `${h}px`;
    if (this.tutorialLabel) {
      this.tutorialLabel.style.left = `${this.mapX + (TUTORIAL_X / INFO_MAP_SIZE) * this.mapW + 20}px`;
      this.tutorialLabel.style.top = `${this.mapY + (TUTORIAL_Y / INFO_MAP_SIZE) * this.mapH + 35}px`;
    }
    if (this.regionSelectionLabel) {
      this.regionSelectionLabel.style.left = `${this.mapX - 6}px`;
      this.regionSelectionLabel.style.top = '10px';
    }
    if (this.flavorA) {
      this.flavorA.style.left = '314px';
      this.flavorA.style.top = '24px';
      this.flavorA.style.maxWidth = '1000px';
    }
    if (this.flavorB) {
      this.flavorB.style.left = '314px';
      this.flavorB.style.top = '114px';
    }
    if (this.helpText) {
      this.helpText.style.left = '436px';
    }
  }

  private buildInfoPanel() {
    // Inspector panel on right side — NewBaseInspectorLayout.lua
    // Panel: 550px wide, positioned right of galaxy map, left of right sidebar
    const panelW = 550;
    const panelRight = 120;
    this.infoPanel = document.createElement('div');
    this.infoPanel.style.cssText = `position:absolute;right:${panelRight}px;top:0;width:${panelW}px;color:${AMBER_HEX};font-size:26px;z-index:5;display:none;font-family:'Dosis',sans-serif;pointer-events:none;`; /* Lua dosissemibold26, pointer-events:none so hover preview doesn't block canvas clicks */

    // Black background behind everything
    const blackBg = document.createElement('div');
    blackBg.style.cssText = `position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.75);z-index:0;`;
    this.infoPanel.appendChild(blackBg);

    // Zoomed map preview — original NewGame/galaxy_zoom01 sprite, amber-multiplied like MOAI.
    const previewWrap = this.inspectorPreviewWrap = document.createElement('div');
    previewWrap.style.cssText = `
      position:absolute;top:0;left:0;width:100%;height:215px;overflow:hidden;
      z-index:1;pointer-events:none;transform-origin:center center;background:${AMBER_HEX};
    `;
    const previewImg = document.createElement('img');
    previewImg.src = assetUrl('assets/ui/newgame/galaxy_zoom01.png');
    previewImg.style.cssText = `
      position:absolute;top:0;left:0;width:100%;height:100%;
      object-fit:fill;opacity:1;display:block;mix-blend-mode:multiply;
    `;
    previewWrap.appendChild(previewImg);
    this.infoPanel.appendChild(previewWrap);

    // Content container (relative, on top of bg)
    const content = document.createElement('div');
    content.style.cssText = 'position:relative;z-index:2;';

    // Amber header with region name — Lua: HeaderBG (amber) + LabelName (black text)
    const header = document.createElement('div');
    header.style.cssText = `background:${AMBER_HEX};padding:10px 13px 8px;margin-top:215px;`;
    this.panelName = document.createElement('div');
    this.panelName.style.cssText = `color:#000;font-weight:500;font-size:38px;font-family:'Dosis',sans-serif;line-height:1.02;`; /* Lua dosisregular52 */
    this.panelAge = document.createElement('div');
    this.panelAge.style.cssText = `color:#000;font-size:22px;margin-top:4px;font-family:'Dosis',sans-serif;text-align:left;line-height:1.05;`; /* Lua dosissemibold28 */
    header.append(this.panelName, this.panelAge);
    content.appendChild(header);

    // Stats section — Lua: StatsBG (amber opaque) with property labels
    const stats = document.createElement('div');
    stats.style.cssText = `background:#3B2600;padding:9px 13px 11px;border-top:1px solid rgba(223,162,0,0.3);`; /* Lua Gui.AMBER_OPAQUE = {0.23, 0.15, 0, 1} = #3B2600 */
    this.panelDensity      = document.createElement('div');
    this.panelDensity.style.cssText = 'margin-bottom:4px;font-size:23px;'; /* Lua dosissemibold28 */
    this.panelDistance     = document.createElement('div');
    this.panelDistance.style.cssText = 'margin-bottom:4px;font-size:23px;'; /* Lua dosissemibold28 */
    this.panelThreat       = document.createElement('div');
    this.panelThreat.style.cssText = 'margin-bottom:4px;font-size:23px;'; /* Lua dosissemibold28 */
    this.panelInterference = document.createElement('div');
    this.panelInterference.style.cssText = 'font-size:23px;'; /* Lua dosissemibold28 */
    stats.append(this.panelDensity, this.panelDistance, this.panelThreat, this.panelInterference);
    content.appendChild(stats);

    // Help folder — Lua: FolderHeader (amber tab) + LabelFolder "Help" + LabelHelpText
    this.helpFolder = document.createElement('div');
    this.helpFolder.style.cssText = 'position:relative;min-height:208px;background:#120c00;';
    const helpTop = document.createElement('img');
    helpTop.src = assetUrl('assets/ui/inspector/ui_inspector_folderTop.png');
    helpTop.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:63px;object-fit:fill;opacity:0.98;';
    this.helpFolder.appendChild(helpTop);
    const helpTab = document.createElement('img');
    helpTab.src = assetUrl('assets/ui/inspector/ui_inspector_folderActive.png');
    helpTab.style.cssText = 'position:absolute;top:0;left:0;width:312px;height:63px;object-fit:fill;';
    this.helpFolder.appendChild(helpTab);
    const helpTitle = document.createElement('div');
    helpTitle.style.cssText = `
      position:absolute;left:24px;top:2px;color:#000;font-weight:400;
      font-size:42px;font-family:'Dosis',sans-serif;line-height:1.05;z-index:1;
    `;
    helpTitle.textContent = line('NEWBAS013TEXT');
    this.helpFolder.appendChild(helpTitle);
    const helpFooter = document.createElement('div');
    helpFooter.style.cssText = `position:absolute;left:0;top:63px;width:100%;height:15px;background:${AMBER_HEX};box-shadow:0 1px 0 rgba(0,0,0,0.35);`;
    this.helpFolder.appendChild(helpFooter);
    const helpBody = document.createElement('div');
    helpBody.style.cssText = `
      padding:102px 13px 18px;color:${AMBER_HEX};font-size:22px;line-height:1.46;
      white-space:pre-line;font-family:'Dosis',sans-serif;position:relative;z-index:1;
    `; /* Lua dosissemibold28, LabelHelpText */
    helpBody.textContent = line('NEWBAS014TEXT');
    this.helpFolder.appendChild(helpBody);
    content.appendChild(this.helpFolder);

    this.infoPanel.appendChild(content);
    this.overlay.appendChild(this.infoPanel);
  }

  private buildConfirmDecline() {
    // Confirm and Decline buttons — ON the left sidebar panel
    // Lua: pos = { '-W/2 + 50', 'H/2 - 90' }, scale = { 154, 154 }
    const btnLeft = 50;
    const btnTop = 90;
    const btnSize = 154;
    const labelStyle = `color:#000;font-size:35px;line-height:1.1;text-align:left;margin-top:10px;letter-spacing:0px;font-family:'Dosis',sans-serif;font-weight:400;width:220px;`;

    // Confirm button
    this.confirmBtnEl = document.createElement('div');
    this.confirmBtnEl.setAttribute('role', 'button');
    this.confirmBtnEl.setAttribute('aria-label', 'Confirm');
    this.confirmBtnEl.style.cssText = `position:absolute;left:${btnLeft}px;top:${btnTop}px;width:${btnSize}px;height:${btnSize + 60}px;cursor:pointer;z-index:5;`;
    const confirmImg = this.confirmImg = document.createElement('img');
    confirmImg.src = assetUrl('assets/ui/newgame/ui_newgame_buttonConfirm_off.png');
    confirmImg.style.cssText = `width:${btnSize}px;height:${btnSize}px;display:block;image-rendering:auto;transition:filter 0.15s ease;`;
    this.confirmBtnEl.appendChild(confirmImg);

    // Label below confirm — Lua: LabelAccept, dosisregular35, Gui.BLACK
    const confirmLabel = this.el('div', labelStyle, line('NEWBAS002TEXT')); /* Lua dosisregular35 */
    this.confirmBtnEl.appendChild(confirmLabel);

    this.confirmBtnEl.addEventListener('mouseenter', () => {
      confirmImg.style.filter = 'brightness(1.3)';
      SoundManager.playUI('UI_Hilight');
    });
    this.confirmBtnEl.addEventListener('mouseleave', () => {
      confirmImg.style.filter = 'brightness(1)';
    });
    this.confirmBtnEl.addEventListener('click', () => this.onConfirm());
    this.overlay.appendChild(this.confirmBtnEl);

    // Decline button — below confirm
    this.declineBtnEl = document.createElement('div');
    // Lua: pos = { '-W/2 + 50', 'H/2 - 300' }
    const declineTop = 300;
    this.declineBtnEl.style.cssText = `position:absolute;left:${btnLeft}px;top:${declineTop}px;width:${btnSize}px;height:${btnSize + 60}px;cursor:pointer;z-index:5;`;
    const declineImg = this.declineImg = document.createElement('img');
    declineImg.src = assetUrl('assets/ui/newgame/ui_newgame_buttonDecline_off.png');
    declineImg.style.cssText = `width:${btnSize}px;height:${btnSize}px;display:block;image-rendering:auto;transition:filter 0.15s ease;`;
    this.declineBtnEl.appendChild(declineImg);

    const declineLabel = this.el('div', labelStyle, line('NEWBAS003TEXT')); /* Lua dosisregular35 */
    this.declineBtnEl.appendChild(declineLabel);

    this.declineBtnEl.addEventListener('mouseenter', () => {
      declineImg.style.filter = 'brightness(1.3)';
      SoundManager.playUI('UI_Hilight');
    });
    this.declineBtnEl.addEventListener('mouseleave', () => {
      declineImg.style.filter = 'brightness(1)';
    });
    this.declineBtnEl.addEventListener('click', () => this.onDecline());
    this.overlay.appendChild(this.declineBtnEl);
  }

  private buildLaunchButton() {
    // Lua native positions (MOAI Y-up, center anchor → CSS top:calc(100%-Y)):
    //   Housing (launchbutton_active): left=110, Y=204 from bottom, 405x351
    //   Cover (launchbutton_cover):    left=-40, Y=252 from bottom, 366px wide
    //   Cancel hitbox:                 left=10,  Y=302 from bottom, 60x50
    const housingLeft = 110;
    const coverW = 366;
    const coverLeft = -40;

    // Launch cover (hazard stripes "LAUNCH" — shown until confirmed)
    this.launchCoverEl = document.createElement('img') as HTMLImageElement;
    this.launchCoverEl.src = assetUrl('assets/ui/newgame/launchbutton_cover.png');
    this.launchCoverEl.style.cssText = `position:absolute;left:${coverLeft}px;top:calc(100% - 252px);width:${coverW}px;z-index:6;pointer-events:none;transition:transform 0.5s ease-in-out, opacity 0.5s;`;
    this.overlay.appendChild(this.launchCoverEl);

    // Deploy housing (red button + CANCEL — hidden until confirmed)
    this.launchActiveEl = document.createElement('div');
    this.launchActiveEl.style.cssText = `position:absolute;left:66px;top:calc(100% - 244px);width:180px;height:120px;z-index:5;display:none;cursor:pointer;`;

    const activeImg = document.createElement('img');
    activeImg.src = assetUrl('assets/ui/newgame/launchbutton_active.png');
    activeImg.style.cssText = 'width:183px;height:auto;pointer-events:none;';
    this.launchActiveEl.appendChild(activeImg);

    this.launchActiveEl.addEventListener('mouseenter', () => {
      activeImg.style.filter = 'brightness(1.3)';
      SoundManager.playUI('UI_Hilight');
    });
    this.launchActiveEl.addEventListener('mouseleave', () => {
      activeImg.style.filter = 'brightness(1)';
    });
    this.launchActiveEl.addEventListener('click', () => this.onDeploy());
    this.overlay.appendChild(this.launchActiveEl);

    // Cancel button — Lua: pos = { '-W/2 + 10', '-(H/2) + 302' }, scale = { 60, 50 }
    this.cancelBtnEl = document.createElement('div');
    this.cancelBtnEl.style.cssText = `position:absolute;left:0px;top:calc(100% - 340px);width:80px;height:65px;z-index:8;display:none;cursor:pointer;`;
    const cancelImg = document.createElement('img');
    cancelImg.src = assetUrl('assets/ui/newgame/cancelbutton_active.png');
    cancelImg.style.cssText = 'width:100%;height:100%;object-fit:contain;';
    this.cancelBtnEl.appendChild(cancelImg);
    this.cancelBtnEl.addEventListener('mouseenter', () => {
      cancelImg.style.filter = 'brightness(1.3)';
      SoundManager.playUI('UI_Hilight');
    });
    this.cancelBtnEl.addEventListener('mouseleave', () => {
      cancelImg.style.filter = 'brightness(1)';
    });
    this.cancelBtnEl.addEventListener('click', () => this.onCancel());
    this.overlay.appendChild(this.cancelBtnEl);
  }

  private buildHelpText() {
    // Help text bar — Lua: SelectRegionHelpTextBG at -(H/2)+78 (78px from bottom)
    // Width 570, height 50, amber bg with icon + text
    this.helpText = document.createElement('div') as HTMLDivElement;
    this.helpText.dataset.testid = 'new-game-help';
    this.helpText.style.cssText = `position:absolute;bottom:78px;left:436px;color:#000;font-size:25px;font-weight:700;z-index:5;background:${AMBER_HEX};padding:8px 14px 8px 12px;font-family:'Dosis',sans-serif;letter-spacing:0.7px;display:flex;align-items:center;box-shadow:inset 0 0 0 1px rgba(0,0,0,0.22), 0 1px 0 rgba(0,0,0,0.4);`; /* Lua dosissemibold30 */
    this.setHelpTextContent('idle', line('NEWBAS001TEXT'));
    this.overlay.appendChild(this.helpText);
  }

  private buildDeployOverlay() {
    // Deploy overlay — keep the galaxy visible until the late fade-to-black,
    // matching the original sequence more closely than an immediate blackout.
    this.deployOverlay = document.createElement('div');
    this.deployOverlay.style.cssText = `
      position:absolute;top:0;left:0;width:100%;height:100%;
      background:rgba(0,0,0,0);z-index:50;display:none;
      font-family:'Orbitron',monospace;color:${AMBER_HEX};
      pointer-events:none;
    `;
    this.deployTextWrap = document.createElement('div');
    this.deployTextWrap.style.cssText = `
      position:absolute;inset:0;
      pointer-events:none;
    `;
    this.deployEta = this.el('div',
      `font-size:52px;letter-spacing:0.5px;font-family:'Dosis',sans-serif;
       font-weight:400;text-shadow:0 1px 0 rgba(0,0,0,0.85);`,
      line('NEWBAS018TEXT')) as HTMLDivElement;
    this.deployYears = this.el('div',
      `font-size:52px;letter-spacing:0.5px;
       font-family:'Dosis',sans-serif;font-weight:400;text-shadow:0 1px 0 rgba(0,0,0,0.85);`) as HTMLDivElement;
    this.deployMsg = this.el('div',
      `position:absolute;left:50%;top:calc(50% + 308px);transform:translateX(-50%);
       width:min(1100px, 92%);text-align:center;font-size:52px;letter-spacing:0.4px;
       font-family:'Dosis',sans-serif;font-weight:400;text-shadow:0 1px 0 rgba(0,0,0,0.85);`) as HTMLDivElement;
    this.deployArrivalRow = document.createElement('div');
    this.deployArrivalRow.dataset.testid = 'deploy-arrival-row';
    this.deployEta.dataset.testid = 'deploy-eta';
    this.deployYears.dataset.testid = 'deploy-years';
    this.deployArrivalRow.style.cssText = `
      position:absolute;left:50%;top:calc(50% + 108px);transform:translateX(-50%);
      display:flex;align-items:baseline;justify-content:center;gap:14px;white-space:nowrap;
    `;
    this.deployArrivalRow.append(this.deployEta, this.deployYears);
    this.deployTextWrap.append(this.deployArrivalRow, this.deployMsg);
    this.deployOverlay.append(this.deployTextWrap);
    this.overlay.appendChild(this.deployOverlay);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private el(tag: string, css: string, text = ''): HTMLElement {
    const d = document.createElement(tag);
    d.style.cssText = css;
    if (text) d.textContent = text;
    return d;
  }

  private makeLandingZone(gx: number, gy: number): LandingZone {
    return {
      x: gx, y: gy,
      density:      cellHash(gx, gy, 10),
      threat:       cellHash(gx, gy, 20),
      distance:     cellHash(gx, gy, 30),
      interference: cellHash(gx, gy, 40),
    };
  }

  private showInspector(zone: LandingZone) {
    const { x, y, density, threat, distance, interference } = zone;

    // Header — black text on amber bg (Lua: LabelName, LabelAge with Gui.BLACK)
    this.panelName.textContent = getRegionName(x, y);
    this.panelAge.textContent  = `${line('NEWBAS008TEXT')} ${getAge(x)} ${line('NEWBAS009TEXT')}`;
    // Stats — colored values
    setColored(this.panelDensity,      line('NEWBAS020TEXT'), severityText(density),      densityColor(density));
    setColored(this.panelDistance,     line('NEWBAS010TEXT'), distanceText(distance),     AMBER_HEX);
    setColored(this.panelThreat,       line('NEWBAS015TEXT'), severityText(threat),       threatColor(threat));
    setColored(this.panelInterference, line('NEWBAS016TEXT'), severityText(interference), AMBER_HEX);

    // Only trigger slide-in animation on first appearance
    const wasHidden = this.infoPanel.style.display === 'none';
    this.infoPanel.style.display = 'block';
    if (wasHidden) {
      this.inspectorTimer  = 0;
      this.inspectorActive = true;
      this.infoPanel.style.opacity = '0';
      this.infoPanel.style.transform = 'translateX(300px)';
      this.inspectorPreviewWrap.style.transform = 'translateX(-300px) rotate(15deg)';
    }
  }

  private updateTelemetry(zone: LandingZone | null) {
    if (!zone) {
      setColored(this.telemetryDensity,      line('NEWBAS020TEXT'), '-', AMBER_HEX);
      setColored(this.telemetryDistance,     line('NEWBAS010TEXT'), '-', AMBER_HEX);
      setColored(this.telemetryThreat,       line('NEWBAS015TEXT'), '-', AMBER_HEX);
      setColored(this.telemetryInterference, line('NEWBAS016TEXT'), '-', AMBER_HEX);
      return;
    }

    const { density, threat, distance, interference } = zone;
    setColored(this.telemetryDensity,      line('NEWBAS020TEXT'), severityText(density),      densityColor(density));
    setColored(this.telemetryDistance,     line('NEWBAS010TEXT'), distanceText(distance),     AMBER_HEX);
    setColored(this.telemetryThreat,       line('NEWBAS015TEXT'), severityText(threat),       threatColor(threat));
    setColored(this.telemetryInterference, line('NEWBAS016TEXT'), severityText(interference), AMBER_HEX);
  }

  private refreshTelemetryFromHover() {
    if (this.hoverGx >= 0 && this.hoverGx < INFO_MAP_SIZE && this.hoverGy >= 0 && this.hoverGy < INFO_MAP_SIZE) {
      this.updateTelemetry(this.makeLandingZone(this.hoverGx, this.hoverGy));
    } else {
      this.updateTelemetry(null);
    }
  }

  // ── Events ───────────────────────────────────────────────────────────────────

  private onMapClick(e: MouseEvent) {
    if (this.state !== 'Initial') return;
    const rect = this.canvas.getBoundingClientRect();
    const uiScale = this.getUIScale();
    const cellW = this.mapW / INFO_MAP_SIZE;
    const cellH = this.mapH / INFO_MAP_SIZE;
    const gx = Math.floor(((e.clientX - rect.left) / uiScale - this.mapX) / cellW);
    const gy = Math.floor(((e.clientY - rect.top) / uiScale  - this.mapY) / cellH);
    if (gx < 0 || gx >= INFO_MAP_SIZE || gy < 0 || gy >= INFO_MAP_SIZE) return;

    this.selectedZone = this.makeLandingZone(gx, gy);
    GameRules.bTutorialMode = isTutorialLandingZone(gx, gy);
    this.state = 'SelectedLandingZone';
    // Update help text to "ACCEPT or DECLINE region for deployment"
    this.setHelpTextContent('selected', line('NEWBAS004TEXT'));
    SoundManager.playUI('Intro_UIAppear');  // Lua: previewappear
    playWarbleFullscreen(this.overlay, 0.3, 0.3);
    this.showInspector(this.selectedZone);
    this.updateTelemetry(this.selectedZone);
    this.confirmImg.src = assetUrl('assets/ui/newgame/ui_newgame_buttonConfirm_active.png');
    this.declineImg.src = assetUrl('assets/ui/newgame/ui_newgame_buttonDecline_active.png');
  }

  private onMouseMove(e: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const uiScale = this.getUIScale();
    const cellW = this.mapW / INFO_MAP_SIZE;
    const cellH = this.mapH / INFO_MAP_SIZE;
    this.hoverGx = Math.floor(((e.clientX - rect.left) / uiScale - this.mapX) / cellW);
    this.hoverGy = Math.floor(((e.clientY - rect.top) / uiScale  - this.mapY) / cellH);
    if (this.state === 'Initial') {
      GameRules.bTutorialMode =
        this.hoverGx >= 0 &&
        this.hoverGx < INFO_MAP_SIZE &&
        this.hoverGy >= 0 &&
        this.hoverGy < INFO_MAP_SIZE &&
        isTutorialLandingZone(this.hoverGx, this.hoverGy);
    }
    if (this.hoverGx >= 0 && this.hoverGx < INFO_MAP_SIZE && this.hoverGy >= 0 && this.hoverGy < INFO_MAP_SIZE) {
      if (this.state === 'Initial') this.updateTelemetry(this.makeLandingZone(this.hoverGx, this.hoverGy));
    } else if (this.state === 'Initial') {
      this.updateTelemetry(null);
    }
  }

  private onConfirm() {
    if (this.state !== 'SelectedLandingZone') return;
    SoundManager.playUI('Intro_AcceptButton');  // Lua: accept
    SoundManager.playUI('Intro_LaunchOpen');     // Lua: launchopen
    playWarbleFullscreen(this.overlay, 0.6, 0.5);
    this.state = 'ConfirmedLandingZone';
    this.confirmImg.src = assetUrl('assets/ui/newgame/ui_newgame_buttonConfirm_inactive.png');
    this.declineImg.src = assetUrl('assets/ui/newgame/ui_newgame_buttonDecline_inactive.png');
    this.helpText.style.display   = 'none';

    // Slide launch cover away to reveal active button
    this.launchCoverEl.style.transform = 'translateX(-300px)';
    this.launchCoverEl.style.opacity = '0';
    this.launchActiveEl.style.display  = 'block';
    this.cancelBtnEl.style.display     = 'block';
  }

  private onDecline() {
    SoundManager.playUI('Intro_AcceptButton');   // Lua: accept
    SoundManager.playUI('Intro_UIDisappear');     // Lua: previewdissappear
    this.state = 'Initial';
    this.selectedZone = null;
    GameRules.bTutorialMode = false;
    this.infoPanel.style.display       = 'none';
    this.infoPanel.style.opacity       = '0';
    this.infoPanel.style.transform     = 'translateX(300px)';
    this.inspectorPreviewWrap.style.transform = 'translateX(-300px) rotate(15deg)';
    this.confirmImg.src = assetUrl('assets/ui/newgame/ui_newgame_buttonConfirm_inactive.png');
    this.declineImg.src = assetUrl('assets/ui/newgame/ui_newgame_buttonDecline_inactive.png');
    this.launchActiveEl.style.display  = 'none';
    this.cancelBtnEl.style.display     = 'none';

    // Reset launch cover
    this.launchCoverEl.style.transform = 'none';
    this.launchCoverEl.style.opacity   = '1';

    this.rebuildHelpTextContent(line('NEWBAS001TEXT'));
    this.helpText.style.display    = 'flex';
    this.refreshTelemetryFromHover();
  }

  private onCancel() {
    // Lua: cancel + launchclose + previewdissappear
    SoundManager.playUI('Intro_CancelButton');   // cancel
    SoundManager.playUI('Intro_LaunchClose');     // launchclose
    SoundManager.playUI('Intro_UIDisappear');     // previewdissappear
    this.state = 'Initial';
    this.selectedZone = null;
    GameRules.bTutorialMode = false;
    this.infoPanel.style.display       = 'none';
    this.infoPanel.style.opacity       = '0';
    this.infoPanel.style.transform     = 'translateX(300px)';
    this.inspectorPreviewWrap.style.transform = 'translateX(-300px) rotate(15deg)';
    this.confirmImg.src = assetUrl('assets/ui/newgame/ui_newgame_buttonConfirm_inactive.png');
    this.declineImg.src = assetUrl('assets/ui/newgame/ui_newgame_buttonDecline_inactive.png');
    this.launchActiveEl.style.display  = 'none';
    this.cancelBtnEl.style.display     = 'none';

    // Reset launch cover
    this.launchCoverEl.style.transform = 'none';
    this.launchCoverEl.style.opacity   = '1';

    this.rebuildHelpTextContent(line('NEWBAS001TEXT'));
    this.helpText.style.display    = 'flex';
    this.refreshTelemetryFromHover();
  }

  private rebuildHelpTextContent(text: string) {
    this.setHelpTextContent('idle', text);
  }

  private onDeploy() {
    if (this.state !== 'ConfirmedLandingZone') return;
    SoundManager.playUI('Intro_LaunchButton');  // Lua: launchbutton
    SoundManager.stopMusic();                    // Lua: stopMusic()
    playWarbleFullscreen(this.overlay, 1.2, 0.5);
    this.state      = 'Deploying';
    this.deployTime = 0;
    this.launchActiveEl.style.display = 'none';
    this.cancelBtnEl.style.display    = 'none';
    this.infoPanel.style.display      = 'none';
    this.leftSidebar.style.display    = 'none';
    this.rightSidebar.style.display   = 'none';
    this.launchCoverEl.style.display  = 'none';

    const name = this.selectedZone ? getRegionName(this.selectedZone.x, this.selectedZone.y) : 'Unknown';
    this.deployMsg.textContent    = `${line('NEWBAS017TEXT')}${name.toUpperCase()}`;
    this.deployEta.style.opacity  = '0';
    this.deployYears.style.opacity = '0';
    this.deployOverlay.style.display = 'flex';
    this.deployOverlay.style.background = 'rgba(0,0,0,0)';
    this.deployOverlay.style.opacity = '1';
    this.deployTextWrap.style.opacity = '0';
  }

  // ── Update ───────────────────────────────────────────────────────────────────

  update(dt: number) {
    if (this.state === 'Deploying') {
      this.deployTime += dt;
      this.updateDeployAnimation();
    }
    // Inspector slide-in — NewBaseInspector.lua:154-168
    if (this.inspectorActive) {
      this.inspectorTimer += dt;
      const STEP = 0.25, TOTAL = 1.0;
      const t = Math.min(this.inspectorTimer / TOTAL, 1);
      const steps = Math.max(Math.floor(TOTAL / STEP), 1);
      const progress = Math.min(Math.floor(t / STEP) / steps, 1);
      this.infoPanel.style.opacity = String(progress);
      this.infoPanel.style.transform = `translateX(${(1 - progress) * 300}px)`;
      this.inspectorPreviewWrap.style.transform =
        `translateX(${(-300 + (progress * 300)).toFixed(2)}px) rotate(${(15 * (1 - progress)).toFixed(2)}deg)`;
      if (this.inspectorTimer >= TOTAL) {
        this.inspectorTimer  = 0;
        this.inspectorActive = false;
        this.infoPanel.style.opacity = '1';
        this.infoPanel.style.transform = 'none';
        this.inspectorPreviewWrap.style.transform = 'none';
      }
    }
    this.draw();
  }

  private updateDeployAnimation() {
    const t = this.deployTime;
    const zoomT = Math.max(0, Math.min(1, (t - END_ANIM_INITIAL_DELAY) / END_ANIM_ZOOM_TIME));
    const fadeAlpha = String(1 - zoomT);
    this.canvas.style.transformOrigin = 'center center';
    this.canvas.style.transform = `translateX(${(zoomT * 140).toFixed(1)}px) scale(${(1 + zoomT * 0.18).toFixed(3)})`;
    this.canvas.style.filter = `brightness(${(1 - zoomT * 0.7).toFixed(3)})`;
    this.regionSelectionLabel.style.opacity = fadeAlpha;
    this.flavorA.style.opacity = fadeAlpha;
    this.flavorB.style.opacity = fadeAlpha;
    this.tutorialLabel.style.opacity = fadeAlpha;

    // Phase 1: fade overlay in
    if (t < END_ANIM_INITIAL_DELAY) {
      this.deployTextWrap.style.opacity = String(t / END_ANIM_INITIAL_DELAY);
      return;
    }
    this.deployTextWrap.style.opacity = '1';

    // Phase 2: show seed pod message
    const t2 = t - END_ANIM_INITIAL_DELAY;
    if (t2 < END_ANIM_ZOOM_TIME) return;

    // Phase 3: show "Estimated arrival"
    const t3 = t2 - END_ANIM_ZOOM_TIME - END_ANIM_YEARS_DELAY;
    if (t3 < END_ANIM_BEFORE_COUNTDOWN_DELAY) {
      this.deployEta.style.opacity   = '1';
      this.deployYears.style.opacity = '1';
      this.deployYears.textContent   = `${MAX_YEARS}${line('NEWBAS019TEXT')}`;
      return;
    }

    // Phase 4: countdown
    const t4 = t3 - END_ANIM_BEFORE_COUNTDOWN_DELAY;
    if (t4 < END_ANIM_COUNTDOWN_TIME) {
      const years = Math.floor(MAX_YEARS * (1 - t4 / END_ANIM_COUNTDOWN_TIME));
      this.deployYears.textContent = `${years}${line('NEWBAS019TEXT')}`;
      return;
    }

    // Phase 5: fade out text
    const t5 = t4 - END_ANIM_COUNTDOWN_TIME;
    if (t5 < END_ANIM_FADE_OUT_TIME) {
      this.deployYears.textContent = `0${line('NEWBAS019TEXT')}`;
      const alpha = String(1 - t5 / END_ANIM_FADE_OUT_TIME);
      this.deployMsg.style.opacity   = alpha;
      this.deployEta.style.opacity   = alpha;
      this.deployYears.style.opacity = alpha;
      const blackAlpha = Math.min(1, t5 / END_ANIM_FADE_OUT_TIME);
      this.deployOverlay.style.background = `rgba(0,0,0,${blackAlpha})`;
      return;
    }

    this.state = 'Deployed';
    if (this.selectedZone) this.onStartGame(this.selectedZone, GameRules.bTutorialMode);
  }

  // ── Draw ─────────────────────────────────────────────────────────────────────

  private draw() {
    const ctx = this.canvasCtx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.galaxyImg) {
      ctx.drawImage(this.galaxyImg, this.mapX, this.mapY, this.mapW, this.mapH);
    }

    const vignette = ctx.createRadialGradient(
      this.mapX + this.mapW * 0.5,
      this.mapY + this.mapH * 0.48,
      Math.min(this.mapW, this.mapH) * 0.18,
      this.mapX + this.mapW * 0.5,
      this.mapY + this.mapH * 0.5,
      Math.max(this.mapW, this.mapH) * 0.72,
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = vignette;
    ctx.fillRect(this.mapX, this.mapY, this.mapW, this.mapH);

    // Grid lines
    const cellW = this.mapW / INFO_MAP_SIZE;
    const cellH = this.mapH / INFO_MAP_SIZE;
    ctx.strokeStyle = 'rgba(223,162,0,0.1)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= INFO_MAP_SIZE; i++) {
      ctx.beginPath(); ctx.moveTo(this.mapX + i * cellW, this.mapY); ctx.lineTo(this.mapX + i * cellW, this.mapY + this.mapH); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(this.mapX, this.mapY + i * cellH); ctx.lineTo(this.mapX + this.mapW, this.mapY + i * cellH); ctx.stroke();
    }

    // Tutorial marker at (12, 34) — Lua: small radio_pressed icon + label beside it
    if (this.state !== 'Deploying') {
      const tx = this.mapX + TUTORIAL_X * cellW + cellW * 0.5;
      const ty = this.mapY + TUTORIAL_Y * cellH + cellH * 0.5;
      ctx.strokeStyle = AMBER_HEX;
      ctx.lineWidth = 2;
      ctx.strokeRect(tx - 8, ty - 8, 16, 16);
      ctx.fillStyle = 'rgba(223,162,0,0.18)';
      ctx.fillRect(tx - 8, ty - 8, 16, 16);
      ctx.fillStyle = GREEN_HEX;
      ctx.beginPath();
      ctx.arc(tx, ty, Math.max(3, Math.min(cellW, cellH) * 0.3), 0, Math.PI * 2);
      ctx.fill();
    }

    // Hover crosshair — mirrors NewBaseLayout CursorLineHorizontal/Vertical
    if (this.state === 'Initial' && this.hoverGx >= 0 && this.hoverGx < INFO_MAP_SIZE) {
      const hx = this.mapX + (this.hoverGx + 0.5) * cellW;
      const hy = this.mapY + (this.hoverGy + 0.5) * cellH;

      // Full-width crosshair lines (amber)
      ctx.strokeStyle = 'rgba(223,162,0,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(this.mapX, hy); ctx.lineTo(this.mapX + this.mapW, hy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hx, this.mapY); ctx.lineTo(hx, this.mapY + this.mapH); ctx.stroke();

      const cursorSize = Math.max(10, Math.min(cellW, cellH) * 0.75);
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(Math.PI / 4);
      ctx.strokeStyle = AMBER_HEX;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-cursorSize / 2, -cursorSize / 2, cursorSize, cursorSize);
      ctx.restore();

      // Coordinate label at cursor — mirrors CursorText / CursorTutorialText
      ctx.font = `600 22px Dosis, sans-serif`;
      ctx.fillStyle = AMBER_HEX;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${this.hoverGx} - ${this.hoverGy}`, hx + 28, hy - 30);
      if ((this.hoverGx === 12 && this.hoverGy === 34) || (this.hoverGx === 13 && this.hoverGy === 34)) {
        ctx.textBaseline = 'top';
        ctx.fillText('QUICK-START MODE', hx - 120, hy + 52);
      }
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }

    // Selection marker
    if (this.selectedZone) {
      const sx = this.mapX + this.selectedZone.x * cellW;
      const sy = this.mapY + this.selectedZone.y * cellH;
      ctx.fillStyle   = 'rgba(223,162,0,0.25)';
      ctx.strokeStyle = AMBER_HEX;
      ctx.lineWidth   = 2;
      ctx.fillRect(sx, sy, cellW, cellH);
      ctx.strokeRect(sx, sy, cellW, cellH);
    }

    ctx.strokeStyle = 'rgba(223,162,0,0.22)';
    ctx.lineWidth = 1;
    ctx.strokeRect(this.mapX + 0.5, this.mapY + 0.5, this.mapW - 1, this.mapH - 1);
  }

  private setHelpTextContent(mode: 'idle' | 'selected', text: string) {
    this.helpText.textContent = '';

    const icon = document.createElement('span');
    icon.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:2px solid #000;border-radius:50%;margin-right:12px;flex-shrink:0;background:rgba(0,0,0,0.08);box-shadow:inset 0 0 0 1px rgba(223,162,0,0.18);';
    const glyph = document.createElement('span');
    glyph.style.cssText = `color:#000;font-size:${mode === 'idle' ? 16 : 18}px;font-weight:900;line-height:1;transform:translateY(-1px);`;
    glyph.textContent = mode === 'idle' ? '▶' : 'O';
    icon.appendChild(glyph);
    this.helpText.appendChild(icon);

    const label = document.createElement('span');
    label.style.cssText = 'font-size:24px;line-height:1.1;letter-spacing:0.5px;font-weight:700;';
    label.textContent = text;
    this.helpText.appendChild(label);
  }

  private getUIScale(): number {
    return getStoredOrAutoUIScale();
  }

  exit() {
    GameRules.bTutorialMode = false;
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }
    this.canvas.style.transform = 'none';
    this.canvas.style.filter = 'none';
    this.overlay?.remove();
  }
}
