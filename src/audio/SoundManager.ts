/**
 * SoundManager.ts — Singleton audio manager using Web Audio API.
 * Mirrors SoundManager.lua: 4 category gains, lazy loading, volume persistence.
 */

export type AudioCategory = 'music' | 'sfx' | 'ambience' | 'ui';

interface AudioSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  ambienceVolume: number;
  uiVolume: number;
  muted: boolean;
}

const DEFAULT_SETTINGS: AudioSettings = {
  masterVolume: 0.8,
  musicVolume: 0.7,
  sfxVolume: 0.8,
  ambienceVolume: 0.6,
  uiVolume: 0.9,
  muted: false,
};

const SETTINGS_KEY = 'df9_audio_settings';

class SoundManagerClass {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private categoryGains: Record<AudioCategory, GainNode | null> = {
    music: null,
    sfx: null,
    ambience: null,
    ui: null,
  };

  private settings: AudioSettings = { ...DEFAULT_SETTINGS };
  private bufferCache: Map<string, AudioBuffer> = new Map();
  private activeSources: Map<string, AudioBufferSourceNode> = new Map();
  private initialized = false;

  /** Current zoom depth (0=zoomed out, 1=zoomed in). */
  private zoomDepth = 0;

  /** Initialize Web Audio context. Must be called after user interaction. */
  init() {
    if (this.initialized) return;

    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);

      // Create category gain nodes
      for (const cat of ['music', 'sfx', 'ambience', 'ui'] as AudioCategory[]) {
        const gain = this.ctx.createGain();
        gain.connect(this.masterGain);
        this.categoryGains[cat] = gain;
      }

      this.loadSettings();
      this.applyVolumes();
      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio API not available:', e);
    }
  }

  /** Resume audio context (required after user interaction in some browsers). */
  resume() {
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume();
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  // ── Playback ──────────────────────────────────────────────────

  /** Play a UI sound effect (non-positional). */
  playUI(cue: string) {
    this.playOneShot(cue, 'ui');
  }

  /** Play a sound effect (non-positional). */
  playSfx(cue: string) {
    this.playOneShot(cue, 'sfx');
  }

  /** Play a sound effect with 3D positioning. */
  playSfx3D(cue: string, worldX: number, worldY: number) {
    if (!this.ctx || !this.categoryGains.sfx) return;

    const buffer = this.bufferCache.get(cue);
    if (!buffer) {
      // Lazy load would go here — for now, just skip
      return;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const panner = this.ctx.createPanner();
    panner.panningModel = 'equalpower';
    panner.distanceModel = 'linear';
    panner.refDistance = 256;
    panner.maxDistance = 1024;
    panner.rolloffFactor = 1;
    panner.setPosition(worldX, worldY, 0);

    source.connect(panner);
    panner.connect(this.categoryGains.sfx);
    source.start(0);
  }

  /** Play a music track (looping). */
  playMusic(track: string) {
    this.playLoop(track, 'music', 'music_current');
  }

  /** Stop current music. */
  stopMusic() {
    this.stopLoop('music_current');
  }

  /** Play an ambience loop. */
  playAmbience(loop: string) {
    this.playLoop(loop, 'ambience', 'ambience_current');
  }

  /** Stop current ambience. */
  stopAmbience() {
    this.stopLoop('ambience_current');
  }

  // ── Internal playback ─────────────────────────────────────────

  private playOneShot(cue: string, category: AudioCategory) {
    if (!this.ctx || !this.categoryGains[category]) return;

    const buffer = this.bufferCache.get(cue);
    if (!buffer) return; // Not loaded yet

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.categoryGains[category]!);
    source.start(0);
  }

  private playLoop(cue: string, category: AudioCategory, sourceKey: string) {
    if (!this.ctx || !this.categoryGains[category]) return;

    // Stop existing loop
    this.stopLoop(sourceKey);

    const buffer = this.bufferCache.get(cue);
    if (!buffer) return;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(this.categoryGains[category]!);
    source.start(0);
    this.activeSources.set(sourceKey, source);
  }

  private stopLoop(sourceKey: string) {
    const source = this.activeSources.get(sourceKey);
    if (source) {
      try { source.stop(); } catch { /* already stopped */ }
      this.activeSources.delete(sourceKey);
    }
  }

  // ── Buffer management ─────────────────────────────────────────

  /** Load an audio file into the buffer cache. */
  async loadBuffer(name: string, url: string): Promise<boolean> {
    if (!this.ctx) return false;
    if (this.bufferCache.has(name)) return true;

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      this.bufferCache.set(name, audioBuffer);
      return true;
    } catch (e) {
      console.warn(`Failed to load audio: ${name}`, e);
      return false;
    }
  }

  /** Register a pre-decoded buffer. */
  registerBuffer(name: string, buffer: AudioBuffer) {
    this.bufferCache.set(name, buffer);
  }

  /** Generate a simple procedural beep for fallback UI sounds. */
  generateBeep(name: string, frequency = 440, duration = 0.1, type: OscillatorType = 'sine') {
    if (!this.ctx) return;
    if (this.bufferCache.has(name)) return;

    const sampleRate = this.ctx.sampleRate;
    const length = Math.ceil(sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const envelope = Math.min(1, (length - i) / (sampleRate * 0.02)); // Quick fade out
      let sample = 0;
      switch (type) {
        case 'sine': sample = Math.sin(2 * Math.PI * frequency * t); break;
        case 'square': sample = Math.sin(2 * Math.PI * frequency * t) > 0 ? 1 : -1; break;
        case 'triangle': sample = 2 * Math.abs(2 * (frequency * t - Math.floor(frequency * t + 0.5))) - 1; break;
        default: sample = Math.sin(2 * Math.PI * frequency * t);
      }
      data[i] = sample * 0.3 * envelope;
    }

    this.bufferCache.set(name, buffer);
  }

  /** Generate procedural fallback sounds for all UI cues. */
  generateFallbackSounds() {
    this.generateBeep('UI_Select', 660, 0.05, 'sine');
    this.generateBeep('UI_Confirm', 880, 0.08, 'sine');
    this.generateBeep('UI_Disallow', 220, 0.15, 'square');
    this.generateBeep('UI_Expand', 550, 0.06, 'sine');
    this.generateBeep('UI_Hilight', 770, 0.03, 'sine');
    this.generateBeep('UI_GridShow', 440, 0.1, 'triangle');
    this.generateBeep('UI_BuildScroll', 500, 0.04, 'sine');
    this.generateBeep('Intro_AcceptButton', 880, 0.1, 'sine');
    this.generateBeep('Intro_CancelButton', 330, 0.1, 'square');
    this.generateBeep('Intro_LaunchButton', 1100, 0.15, 'sine');
    this.generateBeep('PlaceDoor', 440, 0.12, 'triangle');
    this.generateBeep('PlaceBed', 380, 0.1, 'triangle');
    this.generateBeep('PlaceReactor', 300, 0.15, 'square');
    this.generateBeep('Alarm_Alert', 600, 0.3, 'square');
    this.generateBeep('Alarm_Breach', 200, 0.5, 'square');
    this.generateBeep('Alarm_Fire', 400, 0.4, 'square');
    this.generateBeep('Alarm_LowOxygen', 300, 0.5, 'sine');
  }

  // ── Volume controls ───────────────────────────────────────────

  setMasterVolume(v: number) {
    this.settings.masterVolume = Math.max(0, Math.min(1, v));
    this.applyVolumes();
    this.saveSettings();
  }

  setMusicVolume(v: number) {
    this.settings.musicVolume = Math.max(0, Math.min(1, v));
    this.applyVolumes();
    this.saveSettings();
  }

  setSfxVolume(v: number) {
    this.settings.sfxVolume = Math.max(0, Math.min(1, v));
    this.applyVolumes();
    this.saveSettings();
  }

  setAmbienceVolume(v: number) {
    this.settings.ambienceVolume = Math.max(0, Math.min(1, v));
    this.applyVolumes();
    this.saveSettings();
  }

  setUiVolume(v: number) {
    this.settings.uiVolume = Math.max(0, Math.min(1, v));
    this.applyVolumes();
    this.saveSettings();
  }

  toggleMute() {
    this.settings.muted = !this.settings.muted;
    this.applyVolumes();
    this.saveSettings();
  }

  isMuted(): boolean {
    return this.settings.muted;
  }

  getSettings(): Readonly<AudioSettings> {
    return this.settings;
  }

  /** Set zoom depth for ambience/music mixing (0=zoomed out, 1=zoomed in). */
  setZoomDepth(depth: number) {
    this.zoomDepth = Math.max(0, Math.min(1, depth));
    this.applyVolumes();
  }

  /** Update listener position (camera position) for 3D audio. */
  setListenerPosition(x: number, y: number) {
    if (!this.ctx) return;
    const listener = this.ctx.listener;
    if (listener.positionX) {
      listener.positionX.value = x;
      listener.positionY.value = y;
      listener.positionZ.value = 0;
    }
  }

  private applyVolumes() {
    const master = this.settings.muted ? 0 : this.settings.masterVolume;
    this.masterGain?.gain.setValueAtTime(master, this.ctx?.currentTime ?? 0);

    const ct = this.ctx?.currentTime ?? 0;
    this.categoryGains.music?.gain.setValueAtTime(
      this.settings.musicVolume * (1 - this.zoomDepth * 0.2), ct);
    this.categoryGains.sfx?.gain.setValueAtTime(this.settings.sfxVolume, ct);
    this.categoryGains.ambience?.gain.setValueAtTime(this.settings.ambienceVolume, ct);
    this.categoryGains.ui?.gain.setValueAtTime(this.settings.uiVolume, ct);
  }

  // ── Persistence ───────────────────────────────────────────────

  private saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch { /* ignore */ }
  }

  private loadSettings() {
    try {
      const json = localStorage.getItem(SETTINGS_KEY);
      if (json) {
        const saved = JSON.parse(json);
        Object.assign(this.settings, saved);
      }
    } catch { /* ignore */ }
  }
}

export const SoundManager = new SoundManagerClass();
