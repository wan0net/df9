/**
 * MusicSystem.ts — Dynamic background music with timer-based track rotation.
 * Mirrors SoundManager.lua: sequential tracks, MUSIC_TIME=400s cut, MUSIC_SILENCE_TIME=450s gap.
 */

import { SoundManager } from './SoundManager';

/** In-game music tracks — sequential order, Revoice variants per Lua. */
const GAME_TRACKS = [
  'Track1_Revoice',
  'Track2',
  'Track3_Revoice',
  'Track4',
  'Track5',
];
/** Menu intro track. */
const MENU_TRACK = 'Intro_GuitarTrack';

/** Lua: MUSIC_TIME = 400 — seconds before cutting current track. */
const MUSIC_TIME = 400;
/** Lua: MUSIC_SILENCE_TIME = 450 — seconds of silence between tracks. */
const MUSIC_SILENCE_TIME = 450;

/** Exterior ambience loops. */
const EXTERIOR_LOOPS = ['Ambience_A', 'Ambience_B', 'Ambience_C', 'Ambience_D', 'Ambience_E'];
/** Time per exterior ambience loop before switching (seconds). */
const AMBIENCE_ROTATE_TIME = 500;

export class MusicSystem {
  private playing = false;
  private inMenu = false;
  private currentTrackIndex = 0;
  private currentTrack: string | null = null;
  private musicTimer = 0;
  private bBetweenTracks = false;

  // Ambience state
  private ambienceActive = false;
  private currentAmbience: string | null = null;
  private ambienceTimer = 0;
  private ambienceIndex = 0;

  // Interior ambience
  private interiorAmbienceActive = false;

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
    this.currentTrackIndex = 0;
    this.musicTimer = 0;
    this.bBetweenTracks = false;

    // Stop menu track and begin rotation
    SoundManager.stopMusic();
    this.currentTrack = null;
    this.playTrack(this.currentTrackIndex);

    // Start exterior ambience
    this.startAmbience();
    // Start interior ambience
    this.startInteriorAmbience();

    // Wire track-end callback
    SoundManager.onMusicTrackEnd = () => this.onTrackEnd();
  }

  /** Stop all music. */
  stop() {
    this.playing = false;
    SoundManager.stopMusic();
    SoundManager.stopAmbience();
    SoundManager.stopAmbienceKeyed('interior_ambience');
    SoundManager.onMusicTrackEnd = null;
    this.currentTrack = null;
    this.ambienceActive = false;
    this.interiorAmbienceActive = false;
  }

  /** Update called each frame with game-scaled dt (seconds). */
  update(dt: number) {
    if (!this.playing || this.inMenu) return;

    this.musicTimer += dt;

    // Lua logic: if between tracks, wait MUSIC_SILENCE_TIME then play next
    // if playing a track, cut at MUSIC_TIME and enter gap
    if (this.bBetweenTracks) {
      if (this.musicTimer > MUSIC_SILENCE_TIME) {
        this.incrementTrack();
        this.musicTimer = 0;
      }
    } else {
      if (this.musicTimer > MUSIC_TIME) {
        this.incrementTrack();
        this.musicTimer = 0;
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

  /** Called when a track finishes naturally (via onended). */
  private onTrackEnd() {
    if (!this.playing || this.inMenu) return;
    // Track ended naturally before MUSIC_TIME — enter gap
    if (!this.bBetweenTracks) {
      SoundManager.stopMusic();
      this.bBetweenTracks = true;
      this.musicTimer = 0;
    }
  }

  /** Lua incrementTrack: toggles between playing and silence. */
  private incrementTrack() {
    if (this.bBetweenTracks) {
      // Was in silence gap — advance and play next track
      this.bBetweenTracks = false;
      if (this.currentTrackIndex >= GAME_TRACKS.length - 1) {
        this.currentTrackIndex = 0;
      } else {
        this.currentTrackIndex++;
      }
      this.playTrack(this.currentTrackIndex);
    } else {
      // Was playing — stop and enter silence
      SoundManager.stopMusic();
      this.bBetweenTracks = true;
    }
  }

  private playTrack(index: number) {
    const track = GAME_TRACKS[index];
    this.currentTrack = track;
    SoundManager.playMusic(track);
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

  private startInteriorAmbience() {
    this.interiorAmbienceActive = true;
    SoundManager.playAmbienceKeyed('InteriorAmbience', 'interior_ambience');
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

  isBetweenTracks(): boolean {
    return this.bBetweenTracks;
  }
}
