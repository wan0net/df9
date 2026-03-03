/**
 * MusicSystem.ts — Dynamic background music with crossfading and ambience.
 * Mirrors SoundManager.lua music rotation: 5 tracks, gaps, crossfade.
 */

import { SoundManager } from './SoundManager';

/** In-game music tracks. */
const GAME_TRACKS = ['Track1', 'Track2', 'Track3', 'Track4', 'Track5'];
/** Menu intro track. */
const MENU_TRACK = 'Intro_GuitarTrack';
/** Minimum silence gap between tracks in seconds. */
const MIN_GAP = 6;
/** Maximum silence gap between tracks in seconds. */
const MAX_GAP = 15;

/** Exterior ambience loops. */
const EXTERIOR_LOOPS = ['Ambience_A', 'Ambience_B', 'Ambience_C', 'Ambience_D', 'Ambience_E'];
/** Time per exterior ambience loop before switching (seconds). */
const AMBIENCE_ROTATE_TIME = 500;

export class MusicSystem {
  private playing = false;
  private inMenu = false;
  private trackQueue: string[] = [];
  private currentTrack: string | null = null;
  private gapTimer = 0;
  private waitingForGap = false;

  // Ambience state
  private ambienceActive = false;
  private currentAmbience: string | null = null;
  private ambienceTimer = 0;
  private ambienceIndex = 0;

  /** Start menu music. */
  startMenu() {
    this.inMenu = true;
    this.playing = true;
    SoundManager.playMusic(MENU_TRACK);
    this.currentTrack = MENU_TRACK;
  }

  /** Start in-game music rotation. */
  startGame() {
    this.inMenu = false;
    this.playing = true;
    this.shuffleTracks();
    this.waitingForGap = false;
    // Stop menu track and begin rotation
    SoundManager.stopMusic();
    this.currentTrack = null;
    this.playNextTrack();
    // Start ambience
    this.startAmbience();
  }

  /** Stop all music. */
  stop() {
    this.playing = false;
    SoundManager.stopMusic();
    SoundManager.stopAmbience();
    this.currentTrack = null;
    this.ambienceActive = false;
  }

  /** Update called each frame with game-scaled dt. */
  update(dt: number) {
    if (!this.playing || this.inMenu) return;

    // Music track rotation
    if (this.waitingForGap) {
      this.gapTimer -= dt;
      if (this.gapTimer <= 0) {
        this.waitingForGap = false;
        this.playNextTrack();
      }
    }

    // Ambience rotation
    if (this.ambienceActive) {
      this.ambienceTimer += dt;
      if (this.ambienceTimer >= AMBIENCE_ROTATE_TIME) {
        this.ambienceTimer = 0;
        this.rotateAmbience();
      }
    }
  }

  /** Called when a track finishes playing (wired externally). */
  onTrackEnd() {
    if (!this.playing || this.inMenu) return;
    this.waitingForGap = true;
    this.gapTimer = MIN_GAP + Math.random() * (MAX_GAP - MIN_GAP);
  }

  private playNextTrack() {
    if (this.trackQueue.length === 0) {
      this.shuffleTracks();
    }
    const track = this.trackQueue.shift()!;
    this.currentTrack = track;
    SoundManager.playMusic(track);
  }

  private shuffleTracks() {
    this.trackQueue = [...GAME_TRACKS];
    // Fisher-Yates shuffle
    for (let i = this.trackQueue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.trackQueue[i], this.trackQueue[j]] = [this.trackQueue[j], this.trackQueue[i]];
    }
  }

  private startAmbience() {
    this.ambienceActive = true;
    this.ambienceIndex = Math.floor(Math.random() * EXTERIOR_LOOPS.length);
    this.currentAmbience = EXTERIOR_LOOPS[this.ambienceIndex];
    SoundManager.playAmbience(this.currentAmbience);
    this.ambienceTimer = 0;
  }

  private rotateAmbience() {
    this.ambienceIndex = (this.ambienceIndex + 1) % EXTERIOR_LOOPS.length;
    this.currentAmbience = EXTERIOR_LOOPS[this.ambienceIndex];
    SoundManager.playAmbience(this.currentAmbience);
  }

  getCurrentTrack(): string | null {
    return this.currentTrack;
  }

  getCurrentAmbience(): string | null {
    return this.currentAmbience;
  }

  isPlaying(): boolean {
    return this.playing;
  }
}
