import type { SceneContext, SceneState } from '../renderer/SceneManager';
import { getTexture } from '../renderer/AssetLoader';
import { SoundManager } from '../audio/SoundManager';

const AMBER_HEX = '#dfa200';
const GREEN_HEX = '#a5d318';
const RED_HEX = '#ff3d00';

const MAP_GRID = 16;
const END_ANIM_INITIAL_DELAY = 2.0;
const END_ANIM_ZOOM_TIME = 2.5;
const END_ANIM_YEARS_DELAY = 0.5;
const END_ANIM_BEFORE_COUNTDOWN_DELAY = 2.0;
const END_ANIM_COUNTDOWN_TIME = 2.5;
const END_ANIM_FADE_OUT_TIME = 0.5;
const MAX_YEARS = 358042;

type GameState = 'Initial' | 'SelectedLandingZone' | 'ConfirmedLandingZone' | 'Deploying' | 'Deployed';

interface LandingZone {
  x: number;
  y: number;
  density: number;
  threat: number;
  distance: number;
}

/**
 * Galaxy map landing zone selection + deployment animation.
 * Pure HTML/Canvas implementation replacing NewGameScene.ts.
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

  private onStartGame: (landingZone: LandingZone) => void;
  private onBack: () => void;

  // UI elements
  private infoPanel!: HTMLDivElement;
  private confirmBtn!: HTMLButtonElement;
  private declineBtn!: HTMLButtonElement;
  private deployBtn!: HTMLButtonElement;
  private cancelBtn!: HTMLButtonElement;
  private helpText!: HTMLDivElement;
  private deployOverlay!: HTMLDivElement;

  private galaxyImg: HTMLImageElement | null = null;

  constructor(handlers: {
    onStartGame: (landingZone: LandingZone) => void;
    onBack: () => void;
  }) {
    this.onStartGame = handlers.onStartGame;
    this.onBack = handlers.onBack;
  }

  enter(ctx: SceneContext) {
    this.ctx = ctx;
    this.state = 'Initial';
    this.selectedZone = null;
    this.deployTime = 0;

    // Load galaxy map image
    const galaxyTex = getTexture('galaxy_map');
    if (galaxyTex?.image instanceof HTMLImageElement) {
      this.galaxyImg = galaxyTex.image;
    }

    this.overlay = document.createElement('div');
    this.overlay.id = 'new-game';
    this.overlay.style.cssText = `
      position:absolute;top:0;left:0;width:100%;height:100%;
      background:#000;z-index:100;font-family:monospace;
    `;

    // Canvas for galaxy map
    this.canvas = document.createElement('canvas');
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;';
    this.canvasCtx = this.canvas.getContext('2d')!;
    this.overlay.appendChild(this.canvas);

    // Calculate map position
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.mapSize = Math.min(w, h) * 0.7;
    this.mapX = (w - this.mapSize) / 2;
    this.mapY = (h - this.mapSize) / 2 - 20;

    // Title
    const title = document.createElement('div');
    title.textContent = 'SELECT LANDING ZONE';
    title.style.cssText = `
      position:absolute;top:24px;width:100%;text-align:center;
      color:${AMBER_HEX};font-size:24px;font-weight:bold;z-index:1;
    `;
    this.overlay.appendChild(title);

    // Help text
    this.helpText = document.createElement('div');
    this.helpText.textContent = 'Click a region on the galaxy map';
    this.helpText.style.cssText = `
      position:absolute;bottom:40px;width:100%;text-align:center;
      color:${AMBER_HEX};font-size:18px;z-index:1;
    `;
    this.overlay.appendChild(this.helpText);

    // Info panel (right side)
    const panelX = this.mapX + this.mapSize + 20;
    this.infoPanel = document.createElement('div');
    this.infoPanel.style.cssText = `
      position:absolute;left:${panelX}px;top:${this.mapY}px;
      width:220px;padding:14px;background:rgba(0,0,0,0.85);
      border:1px solid rgba(223,162,0,0.5);color:${AMBER_HEX};
      font-size:15px;line-height:2;z-index:1;display:none;
    `;
    this.overlay.appendChild(this.infoPanel);

    // Confirm / Decline buttons
    this.confirmBtn = this.createButton('Confirm', GREEN_HEX, () => this.onConfirm());
    this.confirmBtn.style.cssText += `position:absolute;left:${panelX}px;top:${this.mapY + 240}px;display:none;z-index:1;`;
    this.overlay.appendChild(this.confirmBtn);

    this.declineBtn = this.createButton('Decline', RED_HEX, () => this.onDecline());
    this.declineBtn.style.cssText += `position:absolute;left:${panelX + 120}px;top:${this.mapY + 240}px;display:none;z-index:1;`;
    this.overlay.appendChild(this.declineBtn);

    // Deploy / Cancel (centered)
    this.deployBtn = this.createButton('DEPLOY', GREEN_HEX, () => this.onDeploy());
    this.deployBtn.style.cssText += `position:absolute;left:50%;top:50%;transform:translate(-50%,30px);display:none;z-index:2;font-size:36px;padding:14px 40px;`;
    this.overlay.appendChild(this.deployBtn);

    this.cancelBtn = this.createButton('Cancel', RED_HEX, () => this.onDecline());
    this.cancelBtn.style.cssText += `position:absolute;left:50%;top:50%;transform:translate(-50%,90px);display:none;z-index:2;font-size:16px;`;
    this.overlay.appendChild(this.cancelBtn);

    // Deploy animation overlay
    this.deployOverlay = document.createElement('div');
    this.deployOverlay.style.cssText = `
      position:absolute;top:0;left:0;width:100%;height:100%;
      background:#000;z-index:50;display:none;
      font-family:monospace;color:${AMBER_HEX};
    `;
    this.overlay.appendChild(this.deployOverlay);

    // Back button
    const backBtn = document.createElement('div');
    backBtn.textContent = '< Back';
    backBtn.style.cssText = `
      position:absolute;bottom:40px;left:20px;color:#888;font-size:16px;
      cursor:pointer;z-index:1;
    `;
    backBtn.addEventListener('click', this.onBack);
    this.overlay.appendChild(backBtn);

    // Mouse events
    this.canvas.addEventListener('click', (e) => this.onMapClick(e));
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));

    ctx.container.appendChild(this.overlay);
    this.draw();
  }

  private createButton(label: string, color: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = `
      background:${color};color:#000;border:none;
      font-family:monospace;font-weight:bold;font-size:18px;
      padding:8px 14px;cursor:pointer;
    `;
    btn.addEventListener('click', onClick);
    return btn;
  }

  private onMapClick(e: MouseEvent) {
    if (this.state !== 'Initial') return;

    const rect = this.canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const cellSize = this.mapSize / MAP_GRID;
    const gx = Math.floor((px - this.mapX) / cellSize);
    const gy = Math.floor((py - this.mapY) / cellSize);
    if (gx < 0 || gx >= MAP_GRID || gy < 0 || gy >= MAP_GRID) return;

    const seed = gx * 73 + gy * 137;
    this.selectedZone = {
      x: gx, y: gy,
      density: ((seed * 2654435761) >>> 0) / 4294967296,
      threat: ((seed * 340573321) >>> 0) / 4294967296,
      distance: (((seed + 7) * 1103515245) >>> 0) / 4294967296,
    };

    this.state = 'SelectedLandingZone';
    this.helpText.textContent = 'Review region and confirm';
    SoundManager.playUI('UI_Select');

    const z = this.selectedZone;
    this.infoPanel.innerHTML = `
      Region (${gx}, ${gy})<br><br>
      Density: ${label3(z.density)}<br>
      Distance: ${label3(z.distance)}<br>
      Threat: ${label3(z.threat)}<br>
      Asteroids: ${Math.floor(z.density * 100)}%
    `;
    this.infoPanel.style.display = 'block';
    this.confirmBtn.style.display = 'block';
    this.declineBtn.style.display = 'block';
  }

  private onMouseMove(e: MouseEvent) {
    if (this.state !== 'Initial') return;
    const rect = this.canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const cellSize = this.mapSize / MAP_GRID;
    this.hoverGx = Math.floor((px - this.mapX) / cellSize);
    this.hoverGy = Math.floor((py - this.mapY) / cellSize);

    if (this.hoverGx >= 0 && this.hoverGx < MAP_GRID && this.hoverGy >= 0 && this.hoverGy < MAP_GRID) {
      const seed = this.hoverGx * 73 + this.hoverGy * 137;
      const density = ((seed * 2654435761) >>> 0) / 4294967296;
      const threat = ((seed * 340573321) >>> 0) / 4294967296;
      const distance = (((seed + 7) * 1103515245) >>> 0) / 4294967296;

      this.infoPanel.innerHTML = `
        Region (${this.hoverGx}, ${this.hoverGy})<br><br>
        Density: ${label3(density)}<br>
        Distance: ${label3(distance)}<br>
        Threat: ${label3(threat)}<br>
        Asteroids: ${Math.floor(density * 100)}%
      `;
      this.infoPanel.style.display = 'block';
    } else {
      this.infoPanel.style.display = 'none';
    }
  }

  private onConfirm() {
    if (this.state !== 'SelectedLandingZone') return;
    SoundManager.playUI('UI_Confirm');
    this.state = 'ConfirmedLandingZone';
    this.confirmBtn.style.display = 'none';
    this.declineBtn.style.display = 'none';
    this.helpText.style.display = 'none';
    this.deployBtn.style.display = 'block';
    this.cancelBtn.style.display = 'block';
  }

  private onDecline() {
    SoundManager.playUI('Intro_CancelButton');
    this.state = 'Initial';
    this.selectedZone = null;
    this.infoPanel.style.display = 'none';
    this.confirmBtn.style.display = 'none';
    this.declineBtn.style.display = 'none';
    this.deployBtn.style.display = 'none';
    this.cancelBtn.style.display = 'none';
    this.helpText.textContent = 'Click a region on the galaxy map';
    this.helpText.style.display = 'block';
  }

  private onDeploy() {
    if (this.state !== 'ConfirmedLandingZone') return;
    SoundManager.playUI('Intro_LaunchButton');
    this.state = 'Deploying';
    this.deployTime = 0;
    this.deployBtn.style.display = 'none';
    this.cancelBtn.style.display = 'none';
    this.infoPanel.style.display = 'none';
    this.deployOverlay.style.display = 'flex';
    this.deployOverlay.style.flexDirection = 'column';
    this.deployOverlay.style.alignItems = 'center';
    this.deployOverlay.style.justifyContent = 'center';
    this.deployOverlay.innerHTML = '';
  }

  update(dt: number) {
    if (this.state === 'Deploying') {
      this.deployTime += dt;
      this.updateDeployAnimation();
    }
    this.draw();
  }

  private updateDeployAnimation() {
    const t = this.deployTime;
    const w = window.innerWidth;

    // Phase 1: Fade to black
    if (t < END_ANIM_INITIAL_DELAY) {
      this.deployOverlay.style.opacity = String(Math.min(1, t / END_ANIM_INITIAL_DELAY));
      return;
    }

    this.deployOverlay.style.opacity = '1';

    // Phase 2: "Seed Pod Deployed"
    const t2 = t - END_ANIM_INITIAL_DELAY;
    if (t2 < END_ANIM_ZOOM_TIME) {
      if (this.deployOverlay.children.length === 0) {
        const name = this.selectedZone ? `Region (${this.selectedZone.x}, ${this.selectedZone.y})` : 'Unknown';
        this.deployOverlay.innerHTML = `<div style="font-size:22px;margin-bottom:20px;">Seed Pod Deployed to ${name}</div>`;
      }
      return;
    }

    // Phase 3: "Estimated arrival"
    const t3 = t2 - END_ANIM_ZOOM_TIME - END_ANIM_YEARS_DELAY;
    if (t3 < END_ANIM_BEFORE_COUNTDOWN_DELAY) {
      if (this.deployOverlay.children.length < 3) {
        this.deployOverlay.innerHTML += `
          <div style="font-size:18px;margin-bottom:20px;">Estimated arrival in...</div>
          <div id="years-text" style="font-size:48px;font-weight:bold;">${MAX_YEARS} YEARS</div>
        `;
      }
      return;
    }

    // Phase 4: Countdown
    const t4 = t3 - END_ANIM_BEFORE_COUNTDOWN_DELAY;
    if (t4 < END_ANIM_COUNTDOWN_TIME) {
      const years = Math.floor(MAX_YEARS * (1 - t4 / END_ANIM_COUNTDOWN_TIME));
      const yearsEl = this.deployOverlay.querySelector('#years-text');
      if (yearsEl) yearsEl.textContent = `${years} YEARS`;
      return;
    }

    // Phase 5: Fade out
    const t5 = t4 - END_ANIM_COUNTDOWN_TIME;
    if (t5 < END_ANIM_FADE_OUT_TIME) {
      const yearsEl = this.deployOverlay.querySelector('#years-text');
      if (yearsEl) yearsEl.textContent = '0 YEARS';
      const alpha = 1 - t5 / END_ANIM_FADE_OUT_TIME;
      for (const child of this.deployOverlay.children) {
        (child as HTMLElement).style.opacity = String(alpha);
      }
      return;
    }

    // Done
    this.state = 'Deployed';
    if (this.selectedZone) {
      this.onStartGame(this.selectedZone);
    }
  }

  private draw() {
    const ctx = this.canvasCtx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Galaxy map image
    if (this.galaxyImg) {
      ctx.drawImage(this.galaxyImg, this.mapX, this.mapY, this.mapSize, this.mapSize);
    }

    // Grid overlay
    ctx.strokeStyle = `rgba(223,162,0,0.15)`;
    ctx.lineWidth = 1;
    const cellSize = this.mapSize / MAP_GRID;
    for (let i = 0; i <= MAP_GRID; i++) {
      const x = this.mapX + i * cellSize;
      const y = this.mapY + i * cellSize;
      ctx.beginPath();
      ctx.moveTo(x, this.mapY);
      ctx.lineTo(x, this.mapY + this.mapSize);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(this.mapX, y);
      ctx.lineTo(this.mapX + this.mapSize, y);
      ctx.stroke();
    }

    // Crosshair (hover)
    if (this.state === 'Initial' && this.hoverGx >= 0 && this.hoverGx < MAP_GRID) {
      ctx.strokeStyle = `rgba(223,162,0,0.5)`;
      ctx.lineWidth = 1;
      const hx = this.mapX + (this.hoverGx + 0.5) * cellSize;
      const hy = this.mapY + (this.hoverGy + 0.5) * cellSize;
      ctx.beginPath();
      ctx.moveTo(hx, this.mapY);
      ctx.lineTo(hx, this.mapY + this.mapSize);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(this.mapX, hy);
      ctx.lineTo(this.mapX + this.mapSize, hy);
      ctx.stroke();
    }

    // Selection marker
    if (this.selectedZone) {
      ctx.strokeStyle = AMBER_HEX;
      ctx.fillStyle = `rgba(223,162,0,0.3)`;
      ctx.lineWidth = 2;
      const sx = this.mapX + this.selectedZone.x * cellSize;
      const sy = this.mapY + this.selectedZone.y * cellSize;
      ctx.fillRect(sx, sy, cellSize, cellSize);
      ctx.strokeRect(sx, sy, cellSize, cellSize);
    }
  }

  exit() {
    this.overlay?.remove();
  }
}

function label3(v: number): string {
  if (v > 0.66) return 'High';
  if (v > 0.33) return 'Medium';
  return 'Low';
}
