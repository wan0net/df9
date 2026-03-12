/**
 * DialogSystem.ts — Event dialog UI for player choices.
 * Mirrors Lua EventData.lua + ImmigrationEvent.dialogTick():
 *   Step 1: Show request dialog (accept/reject)
 *   Step 2: Based on player choice and nChanceObey, show one of three responses:
 *     - accepted → acceptedResponse
 *     - rejected + obeyed → rejectedResponse
 *     - rejected + ignored → screwYouResponse (spawn anyway)
 */

import { line } from '../localization/Localization';

// ── Dialog data structures ─────────────────────────────────────────

export interface DialogSet {
  title: string;
  request: string;
  acceptButton: string;
  rejectButton: string;
  acceptedResponse: string;
  acceptedResponseButton: string;
  rejectedResponse: string;
  rejectedResponseButton: string;
  /** Dialog shown when immigrants ignore the player's rejection. */
  screwYouResponse: string;
  /** Button text for screwYouResponse dialog. */
  screwYouResponseButton: string;
}

// ── Immigration dialogs (Lua EventData.immigrationEvents) ─────────

function getImmigrationDialogs(): DialogSet[] {
  return [
    { // kessel runner (EVENT002)
      title: line('EVENT002TEXT01'), request: line('EVENT002TEXT02'),
      acceptButton: line('EVENT002TEXT03'), rejectButton: line('EVENT002TEXT04'),
      acceptedResponse: line('EVENT002TEXT05'), acceptedResponseButton: line('EVENT002TEXT06'),
      rejectedResponse: line('EVENT002TEXT07'), rejectedResponseButton: line('EVENT002TEXT08'),
      screwYouResponse: line('EVENT002TEXT09'), screwYouResponseButton: line('EVENT002TEXT10'),
    },
    { // lister (EVENT003)
      title: line('EVENT003TEXT01'), request: line('EVENT003TEXT02'),
      acceptButton: line('EVENT003TEXT03'), rejectButton: line('EVENT003TEXT04'),
      acceptedResponse: line('EVENT003TEXT05'), acceptedResponseButton: line('EVENT003TEXT06'),
      rejectedResponse: line('EVENT003TEXT07'), rejectedResponseButton: line('EVENT003TEXT08'),
      screwYouResponse: line('EVENT003TEXT09'), screwYouResponseButton: line('EVENT003TEXT10'),
    },
    { // holiday confusion (EVENT004)
      title: line('EVENT004TEXT01'), request: line('EVENT004TEXT02'),
      acceptButton: line('EVENT004TEXT03'), rejectButton: line('EVENT004TEXT04'),
      acceptedResponse: line('EVENT004TEXT05'), acceptedResponseButton: line('EVENT004TEXT06'),
      rejectedResponse: line('EVENT004TEXT07'), rejectedResponseButton: line('EVENT004TEXT08'),
      screwYouResponse: line('EVENT004TEXT09'), screwYouResponseButton: line('EVENT004TEXT10'),
    },
    { // Dark Side of the Moon (EVENT005)
      title: line('EVENT005TEXT01'), request: line('EVENT005TEXT02'),
      acceptButton: line('EVENT005TEXT03'), rejectButton: line('EVENT005TEXT04'),
      acceptedResponse: line('EVENT005TEXT05'), acceptedResponseButton: line('EVENT005TEXT06'),
      rejectedResponse: line('EVENT005TEXT07'), rejectedResponseButton: line('EVENT005TEXT08'),
      screwYouResponse: line('EVENT005TEXT09'), screwYouResponseButton: line('EVENT005TEXT10'),
    },
    { // Hitchhikers Guide (EVENT006)
      title: line('EVENT006TEXT01'), request: line('EVENT006TEXT02'),
      acceptButton: line('EVENT006TEXT03'), rejectButton: line('EVENT006TEXT04'),
      acceptedResponse: line('EVENT006TEXT05'), acceptedResponseButton: line('EVENT006TEXT06'),
      rejectedResponse: line('EVENT006TEXT07'), rejectedResponseButton: line('EVENT006TEXT08'),
      screwYouResponse: line('EVENT006TEXT09'), screwYouResponseButton: line('EVENT006TEXT10'),
    },
    { // Bad thing happened (EVENT009)
      title: line('EVENT009TEXT01'), request: line('EVENT009TEXT02'),
      acceptButton: line('EVENT009TEXT03'), rejectButton: line('EVENT009TEXT04'),
      acceptedResponse: line('EVENT009TEXT05'), acceptedResponseButton: line('EVENT009TEXT06'),
      rejectedResponse: line('EVENT009TEXT07'), rejectedResponseButton: line('EVENT009TEXT08'),
      screwYouResponse: line('EVENT009TEXT09'), screwYouResponseButton: line('EVENT009TEXT10'),
    },
    { // anti-janitors (EVENT021)
      title: line('EVENT021TEXT01'), request: line('EVENT021TEXT02'),
      acceptButton: line('EVENT021TEXT03'), rejectButton: line('EVENT021TEXT04'),
      acceptedResponse: line('EVENT021TEXT05'), acceptedResponseButton: line('EVENT021TEXT06'),
      rejectedResponse: line('EVENT021TEXT07'), rejectedResponseButton: line('EVENT021TEXT08'),
      screwYouResponse: line('EVENT021TEXT09'), screwYouResponseButton: line('EVENT021TEXT10'),
    },
    { // Grishnak escaped survivors (EVENT023)
      title: line('EVENT023TEXT01'), request: line('EVENT023TEXT02'),
      acceptButton: line('EVENT023TEXT03'), rejectButton: line('EVENT023TEXT04'),
      acceptedResponse: line('EVENT023TEXT05'), acceptedResponseButton: line('EVENT023TEXT06'),
      rejectedResponse: line('EVENT023TEXT07'), rejectedResponseButton: line('EVENT023TEXT08'),
      screwYouResponse: line('EVENT023TEXT09'), screwYouResponseButton: line('EVENT023TEXT10'),
    },
    { // Grishnak: Defectors (EVENT024)
      title: line('EVENT024TEXT01'), request: line('EVENT024TEXT02'),
      acceptButton: line('EVENT024TEXT03'), rejectButton: line('EVENT024TEXT04'),
      acceptedResponse: line('EVENT024TEXT05'), acceptedResponseButton: line('EVENT024TEXT06'),
      rejectedResponse: line('EVENT024TEXT07'), rejectedResponseButton: line('EVENT024TEXT08'),
      screwYouResponse: line('EVENT024TEXT09'), screwYouResponseButton: line('EVENT024TEXT10'),
    },
    { // Grishnak: Fleeing miners (EVENT025)
      title: line('EVENT025TEXT01'), request: line('EVENT025TEXT02'),
      acceptButton: line('EVENT025TEXT03'), rejectButton: line('EVENT025TEXT04'),
      acceptedResponse: line('EVENT025TEXT05'), acceptedResponseButton: line('EVENT025TEXT06'),
      rejectedResponse: line('EVENT025TEXT07'), rejectedResponseButton: line('EVENT025TEXT08'),
      screwYouResponse: line('EVENT025TEXT09'), screwYouResponseButton: line('EVENT025TEXT10'),
    },
    { // Grishnak: Escape pod (EVENT026)
      title: line('EVENT026TEXT01'), request: line('EVENT026TEXT02'),
      acceptButton: line('EVENT026TEXT03'), rejectButton: line('EVENT026TEXT04'),
      acceptedResponse: line('EVENT026TEXT05'), acceptedResponseButton: line('EVENT026TEXT06'),
      rejectedResponse: line('EVENT026TEXT07'), rejectedResponseButton: line('EVENT026TEXT08'),
      screwYouResponse: line('EVENT026TEXT09'), screwYouResponseButton: line('EVENT026TEXT10'),
    },
    { // Grishnak: Abandoned slave ship (EVENT027)
      title: line('EVENT027TEXT01'), request: line('EVENT027TEXT02'),
      acceptButton: line('EVENT027TEXT03'), rejectButton: line('EVENT027TEXT04'),
      acceptedResponse: line('EVENT027TEXT05'), acceptedResponseButton: line('EVENT027TEXT06'),
      rejectedResponse: line('EVENT027TEXT07'), rejectedResponseButton: line('EVENT027TEXT08'),
      screwYouResponse: line('EVENT027TEXT09'), screwYouResponseButton: line('EVENT027TEXT10'),
    },
    { // Grishnak: Old Colleague (EVENT028)
      title: line('EVENT028TEXT01'), request: line('EVENT028TEXT02'),
      acceptButton: line('EVENT028TEXT03'), rejectButton: line('EVENT028TEXT04'),
      acceptedResponse: line('EVENT028TEXT05'), acceptedResponseButton: line('EVENT028TEXT06'),
      rejectedResponse: line('EVENT028TEXT07'), rejectedResponseButton: line('EVENT028TEXT08'),
      screwYouResponse: line('EVENT028TEXT09'), screwYouResponseButton: line('EVENT028TEXT10'),
    },
    { // Grishnak: Wreckage (EVENT029)
      title: line('EVENT029TEXT01'), request: line('EVENT029TEXT02'),
      acceptButton: line('EVENT029TEXT03'), rejectButton: line('EVENT029TEXT04'),
      acceptedResponse: line('EVENT029TEXT05'), acceptedResponseButton: line('EVENT029TEXT06'),
      rejectedResponse: line('EVENT029TEXT07'), rejectedResponseButton: line('EVENT029TEXT08'),
      screwYouResponse: line('EVENT029TEXT09'), screwYouResponseButton: line('EVENT029TEXT10'),
    },
    { // Grishnak: Desperate workers (EVENT030)
      title: line('EVENT030TEXT01'), request: line('EVENT030TEXT02'),
      acceptButton: line('EVENT030TEXT03'), rejectButton: line('EVENT030TEXT04'),
      acceptedResponse: line('EVENT030TEXT05'), acceptedResponseButton: line('EVENT030TEXT06'),
      rejectedResponse: line('EVENT030TEXT07'), rejectedResponseButton: line('EVENT030TEXT08'),
      screwYouResponse: line('EVENT030TEXT09'), screwYouResponseButton: line('EVENT030TEXT10'),
    },
  ];
}

// ── Hostile immigration dialogs (Lua EventData.hostileImmigrationEvents) ──

function getHostileImmigrationDialogs(): DialogSet[] {
  return [
    { // hero trap (EVENT008)
      title: line('EVENT008TEXT01'), request: line('EVENT008TEXT02'),
      acceptButton: line('EVENT008TEXT03'), rejectButton: line('EVENT008TEXT04'),
      acceptedResponse: line('EVENT008TEXT05'), acceptedResponseButton: line('EVENT008TEXT06'),
      rejectedResponse: line('EVENT008TEXT07'), rejectedResponseButton: line('EVENT008TEXT08'),
      screwYouResponse: line('EVENT008TEXT09'), screwYouResponseButton: line('EVENT008TEXT10'),
    },
    { // fifty shades (EVENT012)
      title: line('EVENT012TEXT01'), request: line('EVENT012TEXT02'),
      acceptButton: line('EVENT012TEXT03'), rejectButton: line('EVENT012TEXT04'),
      acceptedResponse: line('EVENT012TEXT05'), acceptedResponseButton: line('EVENT012TEXT06'),
      rejectedResponse: line('EVENT012TEXT07'), rejectedResponseButton: line('EVENT012TEXT08'),
      screwYouResponse: line('EVENT012TEXT09'), screwYouResponseButton: line('EVENT012TEXT10'),
    },
    { // balls of (EVENT013)
      title: line('EVENT013TEXT01'), request: line('EVENT013TEXT02'),
      acceptButton: line('EVENT013TEXT03'), rejectButton: line('EVENT013TEXT04'),
      acceptedResponse: line('EVENT013TEXT05'), acceptedResponseButton: line('EVENT013TEXT06'),
      rejectedResponse: line('EVENT013TEXT07'), rejectedResponseButton: line('EVENT013TEXT08'),
      screwYouResponse: line('EVENT013TEXT09'), screwYouResponseButton: line('EVENT013TEXT10'),
    },
    { // black hole (EVENT014)
      title: line('EVENT014TEXT01'), request: line('EVENT014TEXT02'),
      acceptButton: line('EVENT014TEXT03'), rejectButton: line('EVENT014TEXT04'),
      acceptedResponse: line('EVENT014TEXT05'), acceptedResponseButton: line('EVENT014TEXT06'),
      rejectedResponse: line('EVENT014TEXT07'), rejectedResponseButton: line('EVENT014TEXT08'),
      screwYouResponse: line('EVENT014TEXT09'), screwYouResponseButton: line('EVENT014TEXT10'),
    },
    { // Grishnak: You Are Intruders! (EVENT031)
      title: line('EVENT031TEXT01'), request: line('EVENT031TEXT02'),
      acceptButton: line('EVENT031TEXT03'), rejectButton: line('EVENT031TEXT04'),
      acceptedResponse: line('EVENT031TEXT05'), acceptedResponseButton: line('EVENT031TEXT06'),
      rejectedResponse: line('EVENT031TEXT07'), rejectedResponseButton: line('EVENT031TEXT08'),
      screwYouResponse: line('EVENT031TEXT09'), screwYouResponseButton: line('EVENT031TEXT10'),
    },
    { // Grishnak: DEATH OR VICTORY (EVENT032)
      title: line('EVENT032TEXT01'), request: line('EVENT032TEXT02'),
      acceptButton: line('EVENT032TEXT03'), rejectButton: line('EVENT032TEXT04'),
      acceptedResponse: line('EVENT032TEXT05'), acceptedResponseButton: line('EVENT032TEXT06'),
      rejectedResponse: line('EVENT032TEXT07'), rejectedResponseButton: line('EVENT032TEXT08'),
      screwYouResponse: line('EVENT032TEXT09'), screwYouResponseButton: line('EVENT032TEXT10'),
    },
    { // Grishnak: My Life For My Power (EVENT033)
      title: line('EVENT033TEXT01'), request: line('EVENT033TEXT02'),
      acceptButton: line('EVENT033TEXT03'), rejectButton: line('EVENT033TEXT04'),
      acceptedResponse: line('EVENT033TEXT05'), acceptedResponseButton: line('EVENT033TEXT06'),
      rejectedResponse: line('EVENT033TEXT07'), rejectedResponseButton: line('EVENT033TEXT08'),
      screwYouResponse: line('EVENT033TEXT09'), screwYouResponseButton: line('EVENT033TEXT10'),
    },
    { // Grishnak: Die in Diaspora (EVENT034)
      title: line('EVENT034TEXT01'), request: line('EVENT034TEXT02'),
      acceptButton: line('EVENT034TEXT03'), rejectButton: line('EVENT034TEXT04'),
      acceptedResponse: line('EVENT034TEXT05'), acceptedResponseButton: line('EVENT034TEXT06'),
      rejectedResponse: line('EVENT034TEXT07'), rejectedResponseButton: line('EVENT034TEXT08'),
      screwYouResponse: line('EVENT034TEXT09'), screwYouResponseButton: line('EVENT034TEXT10'),
    },
    { // Grishnak: Transmission from the General (EVENT035)
      title: line('EVENT035TEXT01'), request: line('EVENT035TEXT02'),
      acceptButton: line('EVENT035TEXT03'), rejectButton: line('EVENT035TEXT04'),
      acceptedResponse: line('EVENT035TEXT05'), acceptedResponseButton: line('EVENT035TEXT06'),
      rejectedResponse: line('EVENT035TEXT07'), rejectedResponseButton: line('EVENT035TEXT08'),
      screwYouResponse: line('EVENT035TEXT09'), screwYouResponseButton: line('EVENT035TEXT10'),
    },
    { // Grishnak: Subversion of event 24 (EVENT040)
      title: line('EVENT040TEXT01'), request: line('EVENT040TEXT02'),
      acceptButton: line('EVENT040TEXT03'), rejectButton: line('EVENT040TEXT04'),
      acceptedResponse: line('EVENT040TEXT05'), acceptedResponseButton: line('EVENT040TEXT06'),
      rejectedResponse: line('EVENT040TEXT07'), rejectedResponseButton: line('EVENT040TEXT08'),
      screwYouResponse: line('EVENT040TEXT09'), screwYouResponseButton: line('EVENT040TEXT10'),
    },
    { // Grishnak: Subversion of event 30 (EVENT041)
      title: line('EVENT041TEXT01'), request: line('EVENT041TEXT02'),
      acceptButton: line('EVENT041TEXT03'), rejectButton: line('EVENT041TEXT04'),
      acceptedResponse: line('EVENT041TEXT05'), acceptedResponseButton: line('EVENT041TEXT06'),
      rejectedResponse: line('EVENT041TEXT07'), rejectedResponseButton: line('EVENT041TEXT08'),
      screwYouResponse: line('EVENT041TEXT09'), screwYouResponseButton: line('EVENT041TEXT10'),
    },
  ];
}

// ── Docking event dialogs (Lua EventData.dockingEvents) ───────────

function getDockingAmbiguousDialogs(): DialogSet[] {
  return [
    { // banu (EVENT018)
      title: line('EVENT018TEXT01'), request: line('EVENT018TEXT02'),
      acceptButton: line('EVENT018TEXT03'), rejectButton: line('EVENT018TEXT04'),
      acceptedResponse: line('EVENT018TEXT05'), acceptedResponseButton: line('EVENT018TEXT06'),
      rejectedResponse: line('EVENT018TEXT07'), rejectedResponseButton: line('EVENT018TEXT08'),
      screwYouResponse: line('EVENT018TEXT09'), screwYouResponseButton: line('EVENT018TEXT10'),
    },
    { // notsure (EVENT019)
      title: line('EVENT019TEXT01'), request: line('EVENT019TEXT02'),
      acceptButton: line('EVENT019TEXT03'), rejectButton: line('EVENT019TEXT04'),
      acceptedResponse: line('EVENT019TEXT05'), acceptedResponseButton: line('EVENT019TEXT06'),
      rejectedResponse: line('EVENT019TEXT07'), rejectedResponseButton: line('EVENT019TEXT08'),
      screwYouResponse: line('EVENT019TEXT09'), screwYouResponseButton: line('EVENT019TEXT10'),
    },
    { // murke (EVENT020)
      title: line('EVENT020TEXT01'), request: line('EVENT020TEXT02'),
      acceptButton: line('EVENT020TEXT03'), rejectButton: line('EVENT020TEXT04'),
      acceptedResponse: line('EVENT020TEXT05'), acceptedResponseButton: line('EVENT020TEXT06'),
      rejectedResponse: line('EVENT020TEXT07'), rejectedResponseButton: line('EVENT020TEXT08'),
      screwYouResponse: line('EVENT020TEXT09'), screwYouResponseButton: line('EVENT020TEXT10'),
    },
    { // Grishnak superspace transmission (EVENT036)
      title: line('EVENT036TEXT01'), request: line('EVENT036TEXT02'),
      acceptButton: line('EVENT036TEXT03'), rejectButton: line('EVENT036TEXT04'),
      acceptedResponse: line('EVENT036TEXT05'), acceptedResponseButton: line('EVENT036TEXT06'),
      rejectedResponse: line('EVENT036TEXT07'), rejectedResponseButton: line('EVENT036TEXT08'),
      screwYouResponse: line('EVENT036TEXT09'), screwYouResponseButton: line('EVENT036TEXT10'),
    },
  ];
}

function getDockingHostileDialogs(): DialogSet[] {
  return [
    { // hostile construction fleet (EVENT007)
      title: line('EVENT007TEXT01'), request: line('EVENT007TEXT02'),
      acceptButton: line('EVENT007TEXT03'), rejectButton: line('EVENT007TEXT04'),
      acceptedResponse: line('EVENT007TEXT05'), acceptedResponseButton: line('EVENT007TEXT06'),
      rejectedResponse: line('EVENT007TEXT07'), rejectedResponseButton: line('EVENT007TEXT08'),
      screwYouResponse: line('EVENT007TEXT09'), screwYouResponseButton: line('EVENT007TEXT10'),
    },
    { // Unknown delivery (EVENT010)
      title: line('EVENT010TEXT01'), request: line('EVENT010TEXT02'),
      acceptButton: line('EVENT010TEXT03'), rejectButton: line('EVENT010TEXT04'),
      acceptedResponse: line('EVENT010TEXT05'), acceptedResponseButton: line('EVENT010TEXT06'),
      rejectedResponse: line('EVENT010TEXT07'), rejectedResponseButton: line('EVENT010TEXT08'),
      screwYouResponse: line('EVENT010TEXT09'), screwYouResponseButton: line('EVENT010TEXT10'),
    },
    { // emlins (EVENT015)
      title: line('EVENT015TEXT01'), request: line('EVENT015TEXT02'),
      acceptButton: line('EVENT015TEXT03'), rejectButton: line('EVENT015TEXT04'),
      acceptedResponse: line('EVENT015TEXT05'), acceptedResponseButton: line('EVENT015TEXT06'),
      rejectedResponse: line('EVENT015TEXT07'), rejectedResponseButton: line('EVENT015TEXT08'),
      screwYouResponse: line('EVENT015TEXT09'), screwYouResponseButton: line('EVENT015TEXT10'),
    },
    { // pirates (EVENT016)
      title: line('EVENT016TEXT01'), request: line('EVENT016TEXT02'),
      acceptButton: line('EVENT016TEXT03'), rejectButton: line('EVENT016TEXT04'),
      acceptedResponse: line('EVENT016TEXT05'), acceptedResponseButton: line('EVENT016TEXT06'),
      rejectedResponse: line('EVENT016TEXT07'), rejectedResponseButton: line('EVENT016TEXT08'),
      screwYouResponse: line('EVENT016TEXT09'), screwYouResponseButton: line('EVENT016TEXT10'),
    },
    { // sheriff (EVENT017)
      title: line('EVENT017TEXT01'), request: line('EVENT017TEXT02'),
      acceptButton: line('EVENT017TEXT03'), rejectButton: line('EVENT017TEXT04'),
      acceptedResponse: line('EVENT017TEXT05'), acceptedResponseButton: line('EVENT017TEXT06'),
      rejectedResponse: line('EVENT017TEXT07'), rejectedResponseButton: line('EVENT017TEXT08'),
      screwYouResponse: line('EVENT017TEXT09'), screwYouResponseButton: line('EVENT017TEXT10'),
    },
    { // Grishnak: Red Grixyl Raider (EVENT037)
      title: line('EVENT037TEXT01'), request: line('EVENT037TEXT02'),
      acceptButton: line('EVENT037TEXT03'), rejectButton: line('EVENT037TEXT04'),
      acceptedResponse: line('EVENT037TEXT05'), acceptedResponseButton: line('EVENT037TEXT06'),
      rejectedResponse: line('EVENT037TEXT07'), rejectedResponseButton: line('EVENT037TEXT08'),
      screwYouResponse: line('EVENT037TEXT09'), screwYouResponseButton: line('EVENT037TEXT10'),
    },
    { // Grishnak: Hyde Skenner (EVENT038)
      title: line('EVENT038TEXT01'), request: line('EVENT038TEXT02'),
      acceptButton: line('EVENT038TEXT03'), rejectButton: line('EVENT038TEXT04'),
      acceptedResponse: line('EVENT038TEXT05'), acceptedResponseButton: line('EVENT038TEXT06'),
      rejectedResponse: line('EVENT038TEXT07'), rejectedResponseButton: line('EVENT038TEXT08'),
      screwYouResponse: line('EVENT038TEXT09'), screwYouResponseButton: line('EVENT038TEXT10'),
    },
    { // Grishnak: Collision course (EVENT039)
      title: line('EVENT039TEXT01'), request: line('EVENT039TEXT02'),
      acceptButton: line('EVENT039TEXT03'), rejectButton: line('EVENT039TEXT04'),
      acceptedResponse: line('EVENT039TEXT05'), acceptedResponseButton: line('EVENT039TEXT06'),
      rejectedResponse: line('EVENT039TEXT07'), rejectedResponseButton: line('EVENT039TEXT08'),
      screwYouResponse: line('EVENT039TEXT09'), screwYouResponseButton: line('EVENT039TEXT10'),
    },
    { // Grishnak: Subversion of event 29 (EVENT042)
      title: line('EVENT042TEXT01'), request: line('EVENT042TEXT02'),
      acceptButton: line('EVENT042TEXT03'), rejectButton: line('EVENT042TEXT04'),
      acceptedResponse: line('EVENT042TEXT05'), acceptedResponseButton: line('EVENT042TEXT06'),
      rejectedResponse: line('EVENT042TEXT07'), rejectedResponseButton: line('EVENT042TEXT08'),
      screwYouResponse: line('EVENT042TEXT09'), screwYouResponseButton: line('EVENT042TEXT10'),
    },
  ];
}

// ── Compound event dialogs (Lua EventData.CompoundEvent) ─────────

function getCompoundEventDialogs(): DialogSet[] {
  return [
    { // Smuggler's Incorporated (EVENT001)
      title: line('EVENT001TEXT01'), request: line('EVENT001TEXT02'),
      acceptButton: line('EVENT001TEXT03'), rejectButton: line('EVENT001TEXT04'),
      acceptedResponse: line('EVENT001TEXT05'), acceptedResponseButton: line('EVENT001TEXT06'),
      rejectedResponse: line('EVENT001TEXT07'), rejectedResponseButton: line('EVENT001TEXT06'),
      screwYouResponse: line('EVENT001TEXT07'), screwYouResponseButton: line('EVENT001TEXT06'),
    },
    { // EVENT022
      title: line('EVENT022TEXT01'), request: line('EVENT022TEXT02'),
      acceptButton: line('EVENT022TEXT03'), rejectButton: line('EVENT022TEXT04'),
      acceptedResponse: line('EVENT022TEXT05'), acceptedResponseButton: line('EVENT022TEXT06'),
      rejectedResponse: line('EVENT022TEXT07'), rejectedResponseButton: line('EVENT022TEXT06'),
      screwYouResponse: line('EVENT022TEXT07'), screwYouResponseButton: line('EVENT022TEXT06'),
    },
  ];
}

// ── Trader dialog (Lua EventData.traderEvents) ──────────────────

function getTraderDialogs(): DialogSet[] {
  return [
    { // vacuum trader
      title: line('TRADE001TEXT'), request: line('TRADE002TEXT'),
      acceptButton: line('TRADE003TEXT'), rejectButton: line('TRADE004TEXT'),
      acceptedResponse: line('TRADE005TEXT'), acceptedResponseButton: line('TRADE006TEXT'),
      rejectedResponse: line('TRADE007TEXT'), rejectedResponseButton: line('TRADE008TEXT'),
      screwYouResponse: line('TRADE009TEXT'), screwYouResponseButton: line('TRADE010TEXT'),
    },
  ];
}

// ── Dialog System ──────────────────────────────────────────────────

/**
 * Result of a dialog interaction, incorporating nChanceObey logic.
 * - accepted: player clicked accept
 * - rejected: player clicked reject AND immigrants obeyed
 * - ignored: player clicked reject BUT immigrants ignored refusal (screwYou)
 */
export type DialogResult = 'accepted' | 'rejected' | 'ignored';
export type DialogCallback = (result: DialogResult) => void;

interface ActiveDialog {
  dialog: DialogSet;
  callback: DialogCallback;
  element: HTMLDivElement;
  nChanceObey: number;
}

export class DialogSystem {
  private container: HTMLElement;
  private activeDialog: ActiveDialog | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /** Show an immigration dialog with nChanceObey logic. */
  showImmigrationDialog(nChanceObey: number, callback: DialogCallback) {
    const pool = getImmigrationDialogs();
    const dialog = pool[Math.floor(Math.random() * pool.length)];
    this.showDialog(dialog, nChanceObey, callback);
  }

  /** Show a hostile immigration dialog with nChanceObey logic. */
  showHostileImmigrationDialog(nChanceObey: number, callback: DialogCallback) {
    const pool = getHostileImmigrationDialogs();
    const dialog = pool[Math.floor(Math.random() * pool.length)];
    this.showDialog(dialog, nChanceObey, callback);
  }

  /** Show a docking event dialog (ambiguous or hostile). */
  showDockingDialog(hostile: boolean, nChanceObey: number, callback: DialogCallback) {
    const pool = hostile ? getDockingHostileDialogs() : getDockingAmbiguousDialogs();
    const dialog = pool[Math.floor(Math.random() * pool.length)];
    this.showDialog(dialog, nChanceObey, callback);
  }

  /** Show compound event dialog. */
  showCompoundEventDialog(nChanceObey: number, callback: DialogCallback) {
    const pool = getCompoundEventDialogs();
    const dialog = pool[Math.floor(Math.random() * pool.length)];
    this.showDialog(dialog, nChanceObey, callback);
  }

  /** Show trader event dialog. */
  showTraderDialog(nChanceObey: number, callback: DialogCallback) {
    const pool = getTraderDialogs();
    const dialog = pool[Math.floor(Math.random() * pool.length)];
    this.showDialog(dialog, nChanceObey, callback);
  }

  /** Is a dialog currently open? */
  isOpen(): boolean {
    return this.activeDialog !== null;
  }

  /** Close any active dialog. */
  close() {
    if (this.activeDialog) {
      this.activeDialog.element.remove();
      this.activeDialog = null;
    }
  }

  private showDialog(dialog: DialogSet, nChanceObey: number, callback: DialogCallback) {
    // Close any existing dialog
    this.close();

    const el = document.createElement('div');
    el.style.cssText = `
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: rgba(10, 15, 30, 0.95); border: 2px solid #4488ff;
      padding: 24px; border-radius: 8px; z-index: 1000;
      font-family: 'Dosis', sans-serif; color: #cceeff; text-align: center;
      min-width: 400px; max-width: 550px; box-shadow: 0 0 30px rgba(68, 136, 255, 0.3);
      overflow: hidden;
    `;

    const stripesTop = document.createElement('img');
    stripesTop.src = 'assets/ui/dialog/ui_dialog_docking_stripesTop.png';
    stripesTop.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:auto;image-rendering:pixelated;display:block;pointer-events:none;';
    el.appendChild(stripesTop);

    const stripesBottom = document.createElement('img');
    stripesBottom.src = 'assets/ui/dialog/ui_dialog_docking_stripesBottom.png';
    stripesBottom.style.cssText =
      'position:absolute;bottom:0;left:0;width:100%;height:auto;image-rendering:pixelated;display:block;pointer-events:none;';
    el.appendChild(stripesBottom);

    const title = document.createElement('div');
    title.textContent = dialog.title;
    title.style.cssText = 'font-size: 32px; font-weight: 500; color: #ffaa00; margin-bottom: 16px;'; /* Lua dosismedium32 */
    el.appendChild(title);

    const request = document.createElement('div');
    request.textContent = dialog.request;
    request.style.cssText = 'font-size: 26px; line-height: 1.5; margin-bottom: 20px;'; /* Lua dosissemibold26 */
    el.appendChild(request);

    const btnContainer = document.createElement('div');
    btnContainer.style.cssText = 'display: flex; gap: 12px; justify-content: center;';

    const acceptBtn = this.createButton(dialog.acceptButton, '#44aa44');
    const rejectBtn = this.createButton(dialog.rejectButton, '#aa4444');

    acceptBtn.addEventListener('click', () => {
      this.showResponse(dialog.acceptedResponse, dialog.acceptedResponseButton, () => {
        callback('accepted');
      });
    });

    rejectBtn.addEventListener('click', () => {
      // Lua dialogTick: if math.random() > rClass.nChanceObey then ignoreRefusal = true
      const ignoreRefusal = Math.random() > nChanceObey;
      if (ignoreRefusal) {
        // They ignore the rejection — show screwYouResponse, spawn anyway
        this.showResponse(dialog.screwYouResponse, dialog.screwYouResponseButton, () => {
          callback('ignored');
        });
      } else {
        // They obey the rejection
        this.showResponse(dialog.rejectedResponse, dialog.rejectedResponseButton, () => {
          callback('rejected');
        });
      }
    });

    btnContainer.appendChild(acceptBtn);
    btnContainer.appendChild(rejectBtn);
    el.appendChild(btnContainer);

    this.container.appendChild(el);
    this.activeDialog = { dialog, callback, element: el, nChanceObey };
  }

  private showResponse(text: string, buttonText: string, onClose: () => void) {
    if (!this.activeDialog) return;
    const el = this.activeDialog.element;

    // Clear children safely (no innerHTML)
    while (el.firstChild) el.removeChild(el.firstChild);

    const response = document.createElement('div');
    response.textContent = text;
    response.style.cssText = 'font-size: 26px; line-height: 1.5; margin-bottom: 20px; font-family: "Dosis", sans-serif; color: #cceeff;'; /* Lua dosissemibold26 */
    el.appendChild(response);

    const btn = this.createButton(buttonText, '#4488ff');
    btn.addEventListener('click', () => {
      this.close();
      onClose();
    });
    el.appendChild(btn);
  }

  private createButton(text: string, color: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = `
      font-family: 'Dosis', sans-serif; font-size: 30px; padding: 8px 18px; /* Lua dosissemibold30 */
      background: ${color}33; border: 1px solid ${color}; color: #fff;
      cursor: pointer; border-radius: 4px; transition: background 0.2s;
    `;
    btn.addEventListener('mouseenter', () => { btn.style.background = `${color}66`; });
    btn.addEventListener('mouseleave', () => { btn.style.background = `${color}33`; });
    return btn;
  }
}
