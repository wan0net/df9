import type { SceneContext, SceneState } from '../renderer/SceneManager';
import { getTexture } from '../renderer/AssetLoader';
import { SoundManager } from '../audio/SoundManager';
import { line } from '../localization/Localization';
import { playWarbleFullscreen } from './WarbleEffect';

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
 * Left sidebar sprite: 295px wide.
 * Right sidebar positioned at W/2 - 156 in Lua (156px from right edge).
 */
const LEFT_SIDEBAR_W = 295;
const RIGHT_SIDEBAR_W = 156;

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
  img.src = src;
  return img;
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

  private mapSize = 0;
  private mapX = 0;
  private mapY = 0;
  private hoverGx = -1;
  private hoverGy = -1;

  /** Inspector slide-in timer — NewBaseInspector.lua:150-169 */
  private inspectorTimer  = 0;
  private inspectorActive = false;

  private onStartGame: (lz: LandingZone) => void;
  private onBack: () => void;

  // DOM refs
  private infoPanel!: HTMLDivElement;
  private panelName!: HTMLDivElement;
  private panelAge!: HTMLDivElement;
  private panelDensity!: HTMLDivElement;
  private panelDistance!: HTMLDivElement;
  private panelThreat!: HTMLDivElement;
  private panelInterference!: HTMLDivElement;
  private helpFolder!: HTMLDivElement;
  private helpText!: HTMLDivElement;
  private deployOverlay!: HTMLDivElement;
  private deployMsg!: HTMLDivElement;
  private deployEta!: HTMLDivElement;
  private deployYears!: HTMLDivElement;

  // Sprite buttons — Lua layout elements
  private confirmBtnEl!: HTMLDivElement;
  private declineBtnEl!: HTMLDivElement;
  private launchCoverEl!: HTMLImageElement;
  private launchActiveEl!: HTMLDivElement;
  private cancelBtnEl!: HTMLDivElement;
  private leftSidebar!: HTMLDivElement;
  private rightSidebar!: HTMLDivElement;

  private galaxyImg: HTMLImageElement | null = null;

  // Preload sprite images for snappy display
  private _preloads = [
    loadImg('/assets/ui/newgame/launchbutton_cover.png'),
    loadImg('/assets/ui/newgame/launchbutton_active.png'),
    loadImg('/assets/ui/newgame/ui_newgame_buttonConfirm_off.png'),
    loadImg('/assets/ui/newgame/ui_newgame_buttonConfirm_active.png'),
    loadImg('/assets/ui/newgame/ui_newgame_buttonDecline_off.png'),
    loadImg('/assets/ui/newgame/ui_newgame_buttonDecline_active.png'),
    loadImg('/assets/ui/newgame/ui_newgame_sidebarLeft.png'),
    loadImg('/assets/ui/newgame/ui_newgame_sidebarLeft_tile.png'),
    loadImg('/assets/ui/newgame/ui_newgame_sidebarRight.png'),
    loadImg('/assets/ui/newgame/ui_newgame_sidebarRight_tile.png'),
    loadImg('/assets/ui/newgame/ui_newgame_sidebarRight_bottom.png'),
  ];

  constructor(handlers: { onStartGame: (lz: LandingZone) => void; onBack: () => void }) {
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
    this.overlay.style.cssText = `position:absolute;top:0;left:0;width:100%;height:100%;background:#000;z-index:100;font-family:'Orbitron',monospace;overflow:hidden;`;

    this.canvas = document.createElement('canvas');
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;';
    this.canvasCtx = this.canvas.getContext('2d')!;
    this.overlay.appendChild(this.canvas);

    const w = window.innerWidth;
    const h = window.innerHeight;
    // Galaxy map fills available space between sidebars, with room for title/helptext
    const availW = w - LEFT_SIDEBAR_W - RIGHT_SIDEBAR_W - 20;
    const availH = h - 110; // 50px title + 60px help bar at bottom
    this.mapSize = Math.min(availW, availH);
    this.mapX = LEFT_SIDEBAR_W + (availW - this.mapSize) / 2 + 10;
    this.mapY = 55; // below title

    this.buildSidebars();
    this.buildInfoPanel();
    this.buildConfirmDecline();
    this.buildLaunchButton();
    this.buildHelpText();
    this.buildDeployOverlay();

    // Flavor text — Lua: FlavorTextALabel (NEWBAS021TEXT) + FlavorTextBLabel (NEWBAS022TEXT)
    // Positioned at 314px from left edge (just right of left sidebar)
    const flavorA = this.el('div',
      `position:absolute;top:14px;left:${LEFT_SIDEBAR_W + 20}px;color:${AMBER_HEX};font-size:26px;font-weight:600;z-index:5;font-family:'Dosis',sans-serif;white-space:pre-line;line-height:1.4;letter-spacing:0.5px;` /* Lua dosissemibold26 */,
      line('NEWBAS021TEXT'));
    this.overlay.appendChild(flavorA);
    const flavorB = this.el('div',
      `position:absolute;top:68px;left:${LEFT_SIDEBAR_W + 20}px;color:${AMBER_HEX};font-size:18px;z-index:5;font-family:'Dosis',sans-serif;font-style:italic;` /* Lua dosissemibold18 */,
      line('NEWBAS022TEXT'));
    this.overlay.appendChild(flavorB);

    // "Region Selection" header on left sidebar — Lua: NewBase.lua top label
    const regionSelHeader = this.el('div',
      `position:absolute;top:16px;left:16px;color:${AMBER_HEX};font-size:26px;font-weight:600;z-index:5;font-family:'Dosis',sans-serif;letter-spacing:1px;font-style:italic;` /* Lua dosissemibold26 */,
      'Region Selection');
    this.overlay.appendChild(regionSelHeader);

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

    ctx.container.appendChild(this.overlay);
    this.draw();
  }

  // ── Build UI elements ────────────────────────────────────────────────────────

  private buildSidebars() {
    const h = window.innerHeight;

    // ── Left sidebar ──────────────────────────────────────────────────
    // Lua: top piece at left edge, tiles repeat, bottom piece at -(H/2)+350.
    this.leftSidebar = document.createElement('div');
    this.leftSidebar.style.cssText = `position:absolute;left:0;top:0;width:${LEFT_SIDEBAR_W}px;height:${h}px;z-index:3;pointer-events:none;overflow:hidden;`;

    // Tile background — fills the entire height seamlessly via CSS repeat
    const lTileBg = document.createElement('div');
    lTileBg.style.cssText = `position:absolute;left:0;top:0;width:100%;height:100%;background:url('/assets/ui/newgame/ui_newgame_sidebarLeft_tile.png') left top repeat-y;background-size:${LEFT_SIDEBAR_W}px auto;`;
    this.leftSidebar.appendChild(lTileBg);

    // Top piece — overlays the tile background at the top
    const lTop = document.createElement('img');
    lTop.src = '/assets/ui/newgame/ui_newgame_sidebarLeft.png';
    lTop.style.cssText = `position:absolute;left:0;top:0;width:${LEFT_SIDEBAR_W}px;`;
    this.leftSidebar.appendChild(lTop);

    // Bottom piece — Lua: pos = { '-W/2', '-(H/2) + 350' }
    // Top of sprite at 350px from viewport bottom.
    const lBottom = document.createElement('img');
    lBottom.src = '/assets/ui/newgame/ui_newgame_sidebarLeft_bottom.png';
    lBottom.style.cssText = `position:absolute;left:0;top:calc(100% - 350px);width:${LEFT_SIDEBAR_W}px;`;
    this.leftSidebar.appendChild(lBottom);

    this.overlay.appendChild(this.leftSidebar);

    // ── Right sidebar ─────────────────────────────────────────────────
    // Lua: top piece at W/2 - 156, tiles at W/2 - 126, bottom at W/2 - 146.
    // Container is 156px wide (matching the rightmost position offset).
    this.rightSidebar = document.createElement('div');
    this.rightSidebar.style.cssText = `position:absolute;right:0;top:0;width:${RIGHT_SIDEBAR_W}px;height:${h}px;z-index:3;pointer-events:none;overflow:hidden;`;

    // Tile background — Lua: tiles at W/2 - 126 (30px inset from container left)
    const rTileBg = document.createElement('div');
    rTileBg.style.cssText = `position:absolute;left:30px;top:0;width:calc(100% - 30px);height:100%;background:url('/assets/ui/newgame/ui_newgame_sidebarRight_tile.png') left top repeat-y;background-size:auto;`;
    this.rightSidebar.appendChild(rTileBg);

    // Top piece — flush with container left (sprite is 145px wide)
    const rTop = document.createElement('img');
    rTop.src = '/assets/ui/newgame/ui_newgame_sidebarRight.png';
    rTop.style.cssText = `position:absolute;left:0;top:0;width:${RIGHT_SIDEBAR_W}px;`;
    this.rightSidebar.appendChild(rTop);

    // Bottom piece — Lua: pos = { '(W/2) - 146', '-(H/2) + 382' }
    // 10px inset from container left (156-146=10), top at 382px from bottom.
    const rBottom = document.createElement('img');
    rBottom.src = '/assets/ui/newgame/ui_newgame_sidebarRight_bottom.png';
    rBottom.style.cssText = `position:absolute;left:10px;top:calc(100% - 382px);width:146px;`;
    this.rightSidebar.appendChild(rBottom);

    this.overlay.appendChild(this.rightSidebar);
  }

  private buildInfoPanel() {
    // Inspector panel on right side — NewBaseInspectorLayout.lua
    // Panel: 550px wide, positioned right of galaxy map, left of right sidebar
    const panelW = 550; // Lua NewBaseInspectorLayout: WIDTH = 550
    const panelRight = RIGHT_SIDEBAR_W + 10;
    this.infoPanel = document.createElement('div');
    this.infoPanel.style.cssText = `position:absolute;right:${panelRight}px;top:0;width:${panelW}px;color:${AMBER_HEX};font-size:26px;z-index:5;display:none;font-family:'Dosis',sans-serif;pointer-events:none;`; /* Lua dosissemibold26, pointer-events:none so hover preview doesn't block canvas clicks */

    // Black background behind everything
    const blackBg = document.createElement('div');
    blackBg.style.cssText = `position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.75);`;
    this.infoPanel.appendChild(blackBg);

    // Content container (relative, on top of bg)
    const content = document.createElement('div');
    content.style.cssText = 'position:relative;z-index:1;';

    // Amber header with region name — Lua: HeaderBG (amber) + LabelName (black text)
    const header = document.createElement('div');
    header.style.cssText = `background:${AMBER_HEX};padding:12px 16px;`;
    this.panelName = document.createElement('div');
    this.panelName.style.cssText = `color:#000;font-weight:600;font-size:52px;font-family:'Dosis',sans-serif;`; /* Lua dosisregular52 */
    this.panelAge = document.createElement('div');
    this.panelAge.style.cssText = `color:#000;font-size:28px;margin-top:4px;font-family:'Dosis',sans-serif;`; /* Lua dosissemibold28 */
    header.append(this.panelName, this.panelAge);
    content.appendChild(header);

    // Stats section — Lua: StatsBG (amber opaque) with property labels
    const stats = document.createElement('div');
    stats.style.cssText = `background:#3B2600;padding:12px 16px;border-top:1px solid rgba(223,162,0,0.3);`; /* Lua Gui.AMBER_OPAQUE = {0.23, 0.15, 0, 1} = #3B2600 */
    this.panelDensity      = document.createElement('div');
    this.panelDensity.style.cssText = 'margin-bottom:6px;font-size:28px;'; /* Lua dosissemibold28 */
    this.panelDistance     = document.createElement('div');
    this.panelDistance.style.cssText = 'margin-bottom:6px;font-size:28px;'; /* Lua dosissemibold28 */
    this.panelThreat       = document.createElement('div');
    this.panelThreat.style.cssText = 'margin-bottom:6px;font-size:28px;'; /* Lua dosissemibold28 */
    this.panelInterference = document.createElement('div');
    this.panelInterference.style.cssText = 'font-size:28px;'; /* Lua dosissemibold28 */
    stats.append(this.panelDensity, this.panelDistance, this.panelThreat, this.panelInterference);
    content.appendChild(stats);

    // Help folder — Lua: FolderHeader (amber tab) + LabelFolder "Help" + LabelHelpText
    this.helpFolder = document.createElement('div');
    this.helpFolder.style.cssText = 'border-top:2px solid rgba(223,162,0,0.5);';
    const helpTab = document.createElement('div');
    helpTab.style.cssText = `background:${AMBER_HEX};display:inline-block;padding:4px 16px;color:#000;font-weight:700;font-size:52px;font-family:'Dosis',sans-serif;`; /* Lua dosisregular52, same as LabelFolder */
    helpTab.textContent = line('NEWBAS013TEXT');
    this.helpFolder.appendChild(helpTab);
    const helpFooter = document.createElement('div');
    helpFooter.style.cssText = `background:${AMBER_HEX};height:3px;margin-top:-1px;`;
    this.helpFolder.appendChild(helpFooter);
    const helpBody = document.createElement('div');
    helpBody.style.cssText = `padding:12px 16px;color:${AMBER_HEX};font-size:28px;line-height:1.6;white-space:pre-line;font-family:'Dosis',sans-serif;`; /* Lua dosissemibold28, LabelHelpText */
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

    // Confirm button
    this.confirmBtnEl = document.createElement('div');
    this.confirmBtnEl.setAttribute('role', 'button');
    this.confirmBtnEl.setAttribute('aria-label', 'Confirm');
    this.confirmBtnEl.style.cssText = `position:absolute;left:${btnLeft}px;top:${btnTop}px;width:${btnSize}px;height:${btnSize}px;cursor:pointer;z-index:5;display:none;`;
    const confirmImg = document.createElement('img');
    confirmImg.src = '/assets/ui/newgame/ui_newgame_buttonConfirm_off.png';
    confirmImg.style.cssText = `width:100%;height:100%;`;
    this.confirmBtnEl.appendChild(confirmImg);

    // Label below confirm — Lua: LabelAccept, dosisregular35, Gui.BLACK
    const confirmLabel = this.el('div', `color:#000;font-size:35px;text-align:left;margin-top:4px;letter-spacing:1px;font-family:'Dosis',sans-serif;`, line('NEWBAS002TEXT')); /* Lua dosisregular35 */
    this.confirmBtnEl.appendChild(confirmLabel);

    this.confirmBtnEl.addEventListener('mouseenter', () => {
      confirmImg.src = '/assets/ui/newgame/ui_newgame_buttonConfirm_active.png';
      SoundManager.playUI('UI_Hilight');
    });
    this.confirmBtnEl.addEventListener('mouseleave', () => {
      confirmImg.src = '/assets/ui/newgame/ui_newgame_buttonConfirm_off.png';
    });
    this.confirmBtnEl.addEventListener('click', () => this.onConfirm());
    this.overlay.appendChild(this.confirmBtnEl);

    // Decline button — below confirm
    this.declineBtnEl = document.createElement('div');
    // Lua: pos = { '-W/2 + 50', 'H/2 - 300' }
    const declineTop = 300;
    this.declineBtnEl.style.cssText = `position:absolute;left:${btnLeft}px;top:${declineTop}px;width:${btnSize}px;height:${btnSize}px;cursor:pointer;z-index:5;display:none;`;
    const declineImg = document.createElement('img');
    declineImg.src = '/assets/ui/newgame/ui_newgame_buttonDecline_off.png';
    declineImg.style.cssText = `width:100%;height:100%;`;
    this.declineBtnEl.appendChild(declineImg);

    const declineLabel = this.el('div', `color:#000;font-size:35px;text-align:left;margin-top:4px;letter-spacing:1px;font-family:'Dosis',sans-serif;`, line('NEWBAS003TEXT')); /* Lua dosisregular35 */
    this.declineBtnEl.appendChild(declineLabel);

    this.declineBtnEl.addEventListener('mouseenter', () => {
      declineImg.src = '/assets/ui/newgame/ui_newgame_buttonDecline_active.png';
      SoundManager.playUI('UI_Hilight');
    });
    this.declineBtnEl.addEventListener('mouseleave', () => {
      declineImg.src = '/assets/ui/newgame/ui_newgame_buttonDecline_off.png';
    });
    this.declineBtnEl.addEventListener('click', () => this.onDecline());
    this.overlay.appendChild(this.declineBtnEl);
  }

  private buildLaunchButton() {
    // Lua native positions (MOAI Y-up, center anchor → CSS top:calc(100%-Y)):
    //   Housing (launchbutton_active): left=110, Y=204 from bottom, 405x351
    //   Cover (launchbutton_cover):    left=-40, Y=252 from bottom, 366px wide
    //   Cancel hitbox:                 left=10,  Y=302 from bottom, 60x50
    const housingW = 405;
    const housingH = 351;
    const housingLeft = 110;
    const coverW = 366;
    const coverLeft = -40;

    // Launch cover (hazard stripes "LAUNCH" — shown until confirmed)
    this.launchCoverEl = document.createElement('img') as HTMLImageElement;
    this.launchCoverEl.src = '/assets/ui/newgame/launchbutton_cover.png';
    this.launchCoverEl.style.cssText = `position:absolute;left:${coverLeft}px;top:calc(100% - 252px);width:${coverW}px;z-index:6;pointer-events:none;transition:transform 0.5s ease-in-out, opacity 0.5s;`;
    this.overlay.appendChild(this.launchCoverEl);

    // Deploy housing (red button + CANCEL — hidden until confirmed)
    this.launchActiveEl = document.createElement('div');
    this.launchActiveEl.style.cssText = `position:absolute;left:${housingLeft}px;top:calc(100% - 204px);width:${housingW}px;height:${housingH}px;z-index:5;display:none;cursor:pointer;`;

    const activeImg = document.createElement('img');
    activeImg.src = '/assets/ui/newgame/launchbutton_active.png';
    activeImg.style.cssText = 'width:100%;height:100%;pointer-events:none;';
    this.launchActiveEl.appendChild(activeImg);

    // DEPLOY label centered over the red button area
    const deployLabel = this.el('div', `position:absolute;top:55%;left:50%;transform:translate(-50%,-50%);color:white;font-size:35px;font-family:'Dosis',sans-serif;letter-spacing:3px;text-shadow:0 0 8px rgba(255,60,0,0.8);`, line('NEWBUI002TEXT')); /* Lua dosisregular35 */
    this.launchActiveEl.appendChild(deployLabel);

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
    this.cancelBtnEl.style.cssText = `position:absolute;left:10px;top:calc(100% - 302px);width:60px;height:50px;z-index:8;display:none;cursor:pointer;`;
    this.cancelBtnEl.addEventListener('click', () => this.onCancel());
    this.overlay.appendChild(this.cancelBtnEl);
  }

  private buildHelpText() {
    // Help text bar — Lua: SelectRegionHelpTextBG at -(H/2)+78 (78px from bottom)
    // Width 570, height 50, amber bg with icon + text
    this.helpText = document.createElement('div') as HTMLDivElement;
    this.helpText.style.cssText = `position:absolute;bottom:78px;left:${LEFT_SIDEBAR_W + 140}px;color:#000;font-size:30px;font-weight:700;z-index:5;background:${AMBER_HEX};padding:10px 20px 10px 40px;font-family:'Dosis',sans-serif;letter-spacing:1px;display:flex;align-items:center;`; /* Lua dosissemibold30 */
    // Hazard stripe icon (Lua: SelectRegionHelpIcon = ui_hud_buttonPlay)
    const icon = this.el('span',
      `display:inline-block;width:30px;height:30px;border:2px solid #000;border-radius:50%;text-align:center;line-height:28px;font-size:22px;font-weight:700;margin-right:12px;color:#000;flex-shrink:0;`,
      '?');
    this.helpText.appendChild(icon);
    const textSpan = this.el('span', '', line('NEWBAS001TEXT'));
    this.helpText.appendChild(textSpan);
    this.overlay.appendChild(this.helpText);
  }

  private buildDeployOverlay() {
    // Deploy overlay (black screen + countdown text)
    this.deployOverlay = document.createElement('div');
    this.deployOverlay.style.cssText = `position:absolute;top:0;left:0;width:100%;height:100%;background:#000;z-index:50;display:none;flex-direction:column;align-items:center;justify-content:center;font-family:'Orbitron',monospace;color:${AMBER_HEX};`;
    this.deployMsg   = this.el('div', 'font-size:20px;margin-bottom:20px;letter-spacing:2px;') as HTMLDivElement;
    this.deployEta   = this.el('div', 'font-size:30px;margin-bottom:20px;letter-spacing:1px;', line('NEWBAS018TEXT')) as HTMLDivElement; /* Lua dosissemibold30 */
    this.deployYears = this.el('div', 'font-size:48px;font-weight:bold;letter-spacing:3px;') as HTMLDivElement;
    this.deployOverlay.append(this.deployMsg, this.deployEta, this.deployYears);
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
    }
  }

  // ── Events ───────────────────────────────────────────────────────────────────

  private onMapClick(e: MouseEvent) {
    if (this.state !== 'Initial') return;
    const rect = this.canvas.getBoundingClientRect();
    const cellSize = this.mapSize / INFO_MAP_SIZE;
    const gx = Math.floor((e.clientX - rect.left - this.mapX) / cellSize);
    const gy = Math.floor((e.clientY - rect.top  - this.mapY) / cellSize);
    if (gx < 0 || gx >= INFO_MAP_SIZE || gy < 0 || gy >= INFO_MAP_SIZE) return;

    this.selectedZone = this.makeLandingZone(gx, gy);
    this.state = 'SelectedLandingZone';
    // Update help text to "ACCEPT or DECLINE region for deployment"
    this.helpText.textContent = '';
    const selIcon = this.el('span',
      `display:inline-block;width:30px;height:30px;border:2px solid #000;border-radius:50%;text-align:center;line-height:28px;font-size:22px;font-weight:700;margin-right:12px;color:#000;flex-shrink:0;`,
      'O');
    this.helpText.appendChild(selIcon);
    const selText = this.el('span', '', line('NEWBAS004TEXT'));
    this.helpText.appendChild(selText);
    SoundManager.playUI('Intro_UIAppear');  // Lua: previewappear
    playWarbleFullscreen(this.overlay, 0.3, 0.3);
    this.showInspector(this.selectedZone);
    this.confirmBtnEl.style.display = 'block';
    this.declineBtnEl.style.display = 'block';
  }

  private onMouseMove(e: MouseEvent) {
    if (this.state !== 'Initial') return;
    const rect = this.canvas.getBoundingClientRect();
    const cellSize = this.mapSize / INFO_MAP_SIZE;
    this.hoverGx = Math.floor((e.clientX - rect.left - this.mapX) / cellSize);
    this.hoverGy = Math.floor((e.clientY - rect.top  - this.mapY) / cellSize);
    if (this.hoverGx >= 0 && this.hoverGx < INFO_MAP_SIZE && this.hoverGy >= 0 && this.hoverGy < INFO_MAP_SIZE) {
      this.showInspector(this.makeLandingZone(this.hoverGx, this.hoverGy));
    } else {
      this.infoPanel.style.display = 'none';
    }
  }

  private onConfirm() {
    if (this.state !== 'SelectedLandingZone') return;
    SoundManager.playUI('Intro_AcceptButton');  // Lua: accept
    SoundManager.playUI('Intro_LaunchOpen');     // Lua: launchopen
    playWarbleFullscreen(this.overlay, 0.6, 0.5);
    this.state = 'ConfirmedLandingZone';
    this.confirmBtnEl.style.display = 'none';
    this.declineBtnEl.style.display = 'none';
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
    this.infoPanel.style.display       = 'none';
    this.confirmBtnEl.style.display    = 'none';
    this.declineBtnEl.style.display    = 'none';
    this.launchActiveEl.style.display  = 'none';
    this.cancelBtnEl.style.display     = 'none';

    // Reset launch cover
    this.launchCoverEl.style.transform = 'none';
    this.launchCoverEl.style.opacity   = '1';

    this.rebuildHelpTextContent(line('NEWBAS001TEXT'));
    this.helpText.style.display    = 'flex';
  }

  private onCancel() {
    // Lua: cancel + launchclose + previewdissappear
    SoundManager.playUI('Intro_CancelButton');   // cancel
    SoundManager.playUI('Intro_LaunchClose');     // launchclose
    SoundManager.playUI('Intro_UIDisappear');     // previewdissappear
    this.state = 'Initial';
    this.selectedZone = null;
    this.infoPanel.style.display       = 'none';
    this.confirmBtnEl.style.display    = 'none';
    this.declineBtnEl.style.display    = 'none';
    this.launchActiveEl.style.display  = 'none';
    this.cancelBtnEl.style.display     = 'none';

    // Reset launch cover
    this.launchCoverEl.style.transform = 'none';
    this.launchCoverEl.style.opacity   = '1';

    this.rebuildHelpTextContent(line('NEWBAS001TEXT'));
    this.helpText.style.display    = 'flex';
  }

  private rebuildHelpTextContent(text: string) {
    this.helpText.textContent = '';
    const icon = this.el('span',
      `display:inline-block;width:30px;height:30px;border:2px solid #000;border-radius:50%;text-align:center;line-height:28px;font-size:22px;font-weight:700;margin-right:12px;color:#000;flex-shrink:0;`,
      '?');
    this.helpText.appendChild(icon);
    const span = this.el('span', '', text);
    this.helpText.appendChild(span);
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
    this.deployOverlay.style.opacity = '0';
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
      const stepped = Math.floor(t / STEP) * STEP / TOTAL;
      this.infoPanel.style.opacity   = String(Math.min(stepped * (TOTAL / STEP), 1));
      this.infoPanel.style.transform = `translateX(${(1 - Math.min(stepped * (TOTAL / STEP), 1)) * 30}px)`;
      if (this.inspectorTimer >= TOTAL) {
        this.inspectorTimer  = 0;
        this.inspectorActive = false;
        this.infoPanel.style.opacity   = '1';
        this.infoPanel.style.transform = 'none';
      }
    }
    this.draw();
  }

  private updateDeployAnimation() {
    const t = this.deployTime;

    // Phase 1: fade overlay in
    if (t < END_ANIM_INITIAL_DELAY) {
      this.deployOverlay.style.opacity = String(t / END_ANIM_INITIAL_DELAY);
      return;
    }
    this.deployOverlay.style.opacity = '1';

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
      return;
    }

    this.state = 'Deployed';
    if (this.selectedZone) this.onStartGame(this.selectedZone);
  }

  // ── Draw ─────────────────────────────────────────────────────────────────────

  private draw() {
    const ctx = this.canvasCtx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.galaxyImg) {
      ctx.drawImage(this.galaxyImg, this.mapX, this.mapY, this.mapSize, this.mapSize);
    }

    // Grid lines
    const cellSize = this.mapSize / INFO_MAP_SIZE;
    ctx.strokeStyle = 'rgba(223,162,0,0.1)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= INFO_MAP_SIZE; i++) {
      ctx.beginPath(); ctx.moveTo(this.mapX + i * cellSize, this.mapY); ctx.lineTo(this.mapX + i * cellSize, this.mapY + this.mapSize); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(this.mapX, this.mapY + i * cellSize); ctx.lineTo(this.mapX + this.mapSize, this.mapY + i * cellSize); ctx.stroke();
    }

    // Tutorial marker at (12, 34) — Lua: small radio_pressed icon + label beside it
    {
      const tx = this.mapX + TUTORIAL_X * cellSize + cellSize * 0.5;
      const ty = this.mapY + TUTORIAL_Y * cellSize + cellSize * 0.5;
      // Small dot marker
      ctx.fillStyle = GREEN_HEX;
      ctx.beginPath();
      ctx.arc(tx, ty, Math.max(3, cellSize * 0.3), 0, Math.PI * 2);
      ctx.fill();
      // Label to the right of the dot
      const fs = Math.max(7, cellSize * 0.6);
      ctx.font         = `bold ${fs}px monospace`;
      ctx.fillStyle    = GREEN_HEX;
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(line('UIMISC045TEXT'), tx + cellSize * 0.6, ty);
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'alphabetic';
    }

    // Hover crosshair — mirrors NewBaseLayout CursorLineHorizontal/Vertical
    if (this.state === 'Initial' && this.hoverGx >= 0 && this.hoverGx < INFO_MAP_SIZE) {
      const hx = this.mapX + (this.hoverGx + 0.5) * cellSize;
      const hy = this.mapY + (this.hoverGy + 0.5) * cellSize;

      // Full-width crosshair lines (amber)
      ctx.strokeStyle = 'rgba(223,162,0,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(this.mapX, hy); ctx.lineTo(this.mapX + this.mapSize, hy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hx, this.mapY); ctx.lineTo(hx, this.mapY + this.mapSize); ctx.stroke();

      // Coordinate label at cursor — mirrors CursorText
      ctx.font = `bold 10px monospace`;
      ctx.fillStyle = AMBER_HEX;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${this.hoverGx}`, hx, hy - 6);
      ctx.textBaseline = 'top';
      ctx.fillText(`${this.hoverGy}`, hx, hy + 6);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }

    // Selection marker
    if (this.selectedZone) {
      const sx = this.mapX + this.selectedZone.x * cellSize;
      const sy = this.mapY + this.selectedZone.y * cellSize;
      ctx.fillStyle   = 'rgba(223,162,0,0.25)';
      ctx.strokeStyle = AMBER_HEX;
      ctx.lineWidth   = 2;
      ctx.fillRect(sx, sy, cellSize, cellSize);
      ctx.strokeRect(sx, sy, cellSize, cellSize);
    }
  }

  exit() {
    this.overlay?.remove();
  }
}
