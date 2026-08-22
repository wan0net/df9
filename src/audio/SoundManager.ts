/**
 * SoundManager.ts — Singleton audio manager using Web Audio API.
 * Mirrors SoundManager.lua: 4 category gains, lazy loading, volume persistence.
 */

import { AUDIO_CUES, type AudioCue } from './AudioCueData';

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
  private loadingPromises: Map<string, Promise<AudioBuffer | null>> = new Map();
  private activeSources: Map<string, AudioBufferSourceNode> = new Map();
  private initialized = false;

  /** Current zoom depth (0=zoomed out, 1=zoomed in). */
  private zoomDepth = 0;

  /** Callback when music track ends naturally. */
  onMusicTrackEnd: (() => void) | null = null;

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

  /** Play a sound effect with 3D positioning (lazy-loads if needed). */
  playSfx3D(cue: string, worldX: number, worldY: number) {
    if (!this.ctx || !this.categoryGains.sfx) return;

    const play3d = (buffer: AudioBuffer) => {
      if (!this.ctx || !this.categoryGains.sfx) return;
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;

      const cueData = AUDIO_CUES[cue];
      const panner = this.ctx.createPanner();
      panner.panningModel = 'equalpower';
      panner.distanceModel = 'linear';
      panner.refDistance = 256;
      panner.maxDistance = 1024;
      panner.rolloffFactor = 1;
      panner.setPosition(worldX, worldY, 0);

      if (cueData && cueData.volume < 1.0) {
        const vol = this.ctx.createGain();
        vol.gain.value = cueData.volume;
        source.connect(vol);
        vol.connect(panner);
      } else {
        source.connect(panner);
      }
      panner.connect(this.categoryGains.sfx!);
      source.start(0);
    };

    const buffer = this.resolveVariantBuffer(cue);
    if (buffer) {
      play3d(buffer);
    } else {
      this.ensureLoaded(cue).then(() => {
        const buf = this.resolveVariantBuffer(cue);
        if (buf) play3d(buf);
      });
    }
  }

  /** Create a looping 3D-positioned source. Returns source key for stopping. */
  playLoop3D(cue: string, worldX: number, worldY: number, sourceKey: string): void {
    if (!this.ctx || !this.categoryGains.sfx) return;
    this.stopLoop(sourceKey);

    const startLoop3d = (buffer: AudioBuffer) => {
      if (!this.ctx || !this.categoryGains.sfx) return;
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const cueData = AUDIO_CUES[cue];
      const panner = this.ctx.createPanner();
      panner.panningModel = 'equalpower';
      panner.distanceModel = 'linear';
      panner.refDistance = 256;
      panner.maxDistance = 1024;
      panner.rolloffFactor = 1;
      panner.setPosition(worldX, worldY, 0);

      if (cueData && cueData.volume < 1.0) {
        const vol = this.ctx.createGain();
        vol.gain.value = cueData.volume;
        source.connect(vol);
        vol.connect(panner);
      } else {
        source.connect(panner);
      }
      panner.connect(this.categoryGains.sfx!);
      source.start(0);
      this.activeSources.set(sourceKey, source);
    };

    const buffer = this.bufferCache.get(cue);
    if (buffer) {
      startLoop3d(buffer);
    } else {
      this.ensureLoaded(cue).then(buf => { if (buf) startLoop3d(buf); });
    }
  }

  /** Stop a loop by key. */
  stopLoopByKey(sourceKey: string) {
    this.stopLoop(sourceKey);
  }

  /** Play a music track (non-looping, fires onMusicTrackEnd when done). */
  playMusic(track: string) {
    this.playMusicTrack(track, 'music_current');
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

  /** Play an additional ambience loop on a separate key. */
  playAmbienceKeyed(loop: string, key: string) {
    this.playLoop(loop, 'ambience', key);
  }

  /** Stop a keyed ambience loop. */
  stopAmbienceKeyed(key: string) {
    this.stopLoop(key);
  }

  // ── Lazy loading ─────────────────────────────────────────────

  /** Ensure a cue's audio buffer is loaded. Returns cached or freshly loaded buffer. */
  async ensureLoaded(cueName: string): Promise<AudioBuffer | null> {
    if (!this.ctx) return null;
    const cached = this.bufferCache.get(cueName);
    if (cached) return cached;

    // Deduplicate in-flight loads
    const existing = this.loadingPromises.get(cueName);
    if (existing) return existing;

    const cue = AUDIO_CUES[cueName];
    if (!cue) return null;

    const promise = this.loadBuffer(cueName, `/assets/audio/${cue.path}`);
    const wrapped = promise.then(ok => ok ? (this.bufferCache.get(cueName) ?? null) : null);
    this.loadingPromises.set(cueName, wrapped);
    wrapped.finally(() => this.loadingPromises.delete(cueName));

    // Also preload all variants in the background
    if (cue.variants) {
      for (const vPath of cue.variants) {
        const vKey = `${cueName}__${vPath}`;
        if (!this.bufferCache.has(vKey) && !this.loadingPromises.has(vKey)) {
          this.loadBuffer(vKey, `/assets/audio/${vPath}`);
        }
      }
    }

    return wrapped;
  }

  /** Resolve a cue name to a buffer, picking a random variant if available. */
  private resolveVariantBuffer(cueName: string): AudioBuffer | null {
    const cue = AUDIO_CUES[cueName];
    if (cue?.variants && cue.variants.length > 0) {
      const vPath = cue.variants[Math.floor(Math.random() * cue.variants.length)];
      const vKey = `${cueName}__${vPath}`;
      const vBuf = this.bufferCache.get(vKey);
      if (vBuf) return vBuf;
    }
    return this.bufferCache.get(cueName) ?? null;
  }

  /** Play a one-shot, lazy-loading the buffer if needed. Picks random variant if available. */
  playOneShotLazy(cue: string, category: AudioCategory) {
    if (!this.ctx) return;
    const buffer = this.resolveVariantBuffer(cue);
    if (buffer) {
      this.playOneShotBuffer(buffer, category, cue);
    } else {
      this.ensureLoaded(cue).then(() => {
        const buf = this.resolveVariantBuffer(cue);
        if (buf) this.playOneShotBuffer(buf, category, cue);
      });
    }
  }

  /** Play a loop, lazy-loading the buffer if needed. */
  playLoopLazy(cue: string, category: AudioCategory, sourceKey: string) {
    if (!this.ctx) return;
    const buffer = this.bufferCache.get(cue);
    if (buffer) {
      this.playLoopBuffer(buffer, category, sourceKey);
    } else {
      this.ensureLoaded(cue).then(buf => { if (buf) this.playLoopBuffer(buf, category, sourceKey); });
    }
  }

  /** Batch preload cues. */
  async preloadCues(names: string[]): Promise<void> {
    await Promise.all(names.map(n => this.ensureLoaded(n)));
  }

  // ── Convenience helpers ─────────────────────────────────────

  /** Play a UI sound (lazy). */
  playUI(cue: string) {
    this.playOneShotLazy(cue, 'ui');
  }

  /** Play a SFX sound (lazy, non-positional). */
  playSfx(cue: string) {
    this.playOneShotLazy(cue, 'sfx');
  }

  /** Play a voice line at a tile position. Picks gender prefix automatically. */
  playVoice(type: 'Greeting' | 'Positive' | 'Negative' | 'Panic' | 'ShotDeath', female: boolean, worldX: number, worldY: number) {
    const prefix = female ? 'Voice_Female' : 'Voice_Male';
    const cue = `${prefix}_${type}`;
    this.playSfx3D(cue, worldX, worldY);
  }

  // ── Internal playback ─────────────────────────────────────────

  private playOneShotBuffer(buffer: AudioBuffer, category: AudioCategory, cueName?: string) {
    if (!this.ctx || !this.categoryGains[category]) return;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    // Per-cue volume
    const cueData = cueName ? AUDIO_CUES[cueName] : undefined;
    if (cueData && cueData.volume < 1.0) {
      const vol = this.ctx.createGain();
      vol.gain.value = cueData.volume;
      source.connect(vol);
      vol.connect(this.categoryGains[category]!);
    } else {
      source.connect(this.categoryGains[category]!);
    }
    source.start(0);
  }

  private playOneShot(cue: string, category: AudioCategory) {
    if (!this.ctx || !this.categoryGains[category]) return;

    const buffer = this.bufferCache.get(cue);
    if (!buffer) return; // Not loaded yet

    this.playOneShotBuffer(buffer, category, cue);
  }

  private playLoopBuffer(buffer: AudioBuffer, category: AudioCategory, sourceKey: string) {
    if (!this.ctx || !this.categoryGains[category]) return;
    this.stopLoop(sourceKey);

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(this.categoryGains[category]!);
    source.start(0);
    this.activeSources.set(sourceKey, source);
  }

  private playLoop(cue: string, category: AudioCategory, sourceKey: string) {
    if (!this.ctx || !this.categoryGains[category]) return;

    // Stop existing loop
    this.stopLoop(sourceKey);

    const buffer = this.bufferCache.get(cue);
    if (!buffer) {
      // Lazy load, then play
      this.ensureLoaded(cue).then(buf => { if (buf) this.playLoopBuffer(buf, category, sourceKey); });
      return;
    }

    this.playLoopBuffer(buffer, category, sourceKey);
  }

  /** Play a music track (non-looping) and fire onMusicTrackEnd callback when done. */
  private playMusicTrack(cue: string, sourceKey: string) {
    if (!this.ctx || !this.categoryGains.music) return;
    this.stopLoop(sourceKey);

    const startTrack = (buffer: AudioBuffer) => {
      if (!this.ctx || !this.categoryGains.music) return;
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = false;
      source.connect(this.categoryGains.music!);
      source.start(0);
      this.activeSources.set(sourceKey, source);
      source.onended = () => {
        this.activeSources.delete(sourceKey);
        this.onMusicTrackEnd?.();
      };
    };

    const buffer = this.bufferCache.get(cue);
    if (buffer) {
      startTrack(buffer);
    } else {
      this.ensureLoaded(cue).then(buf => { if (buf) startTrack(buf); });
    }
  }

  private stopLoop(sourceKey: string) {
    const source = this.activeSources.get(sourceKey);
    if (source) {
      source.onended = null;
      try { source.stop(); } catch { /* already stopped */ }
      this.activeSources.delete(sourceKey);
    }
  }

  // ── Buffer management ─────────────────────────────────────────

  /** Load an audio file into the buffer cache. */
  async loadBuffer(name: string, url: string): Promise<boolean> {
    if (!this.ctx) return false;
    if (this.bufferCache.has(name)) return true;

    // Navigation can tear down a page while large original WAV files are still
    // decoding. Abort those obsolete requests without reporting false missing-
    // asset diagnostics in the next scene or in automated play-throughs.
    const controller = new AbortController();
    const abortOnPageHide = () => controller.abort();
    window.addEventListener('pagehide', abortOnPageHide, { once: true });
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      this.bufferCache.set(name, audioBuffer);
      return true;
    } catch (e) {
      if (!controller.signal.aborted) console.warn(`Failed to load audio: ${name}`, e);
      return false;
    } finally {
      window.removeEventListener('pagehide', abortOnPageHide);
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

  getMasterVolume(): number { return this.settings.masterVolume; }
  getMusicVolume(): number { return this.settings.musicVolume; }
  getSfxVolume(): number { return this.settings.sfxVolume; }

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
    // Lua: zoom 1 (close)→sfx=1.0,music=0.65; zoom 0 (far out)→sfx=0,music=1.0
    const sfxScale = this.zoomDepth; // 0 far → 1 close
    const musicScale = 1.0 - this.zoomDepth * 0.35; // 1.0 far → 0.65 close
    this.categoryGains.music?.gain.setValueAtTime(
      this.settings.musicVolume * musicScale, ct);
    this.categoryGains.sfx?.gain.setValueAtTime(
      this.settings.sfxVolume * sfxScale, ct);
    // A-2: Lua scales exterior ambience inversely with zoom (loud far out, silent close in)
    const ambienceScale = 1.0 - this.zoomDepth; // 1.0 far → 0.0 close
    this.categoryGains.ambience?.gain.setValueAtTime(
      this.settings.ambienceVolume * ambienceScale, ct);
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
