/**
 * AudioCueData.ts — Maps cue names to file paths and metadata.
 * Mirrors SoundManager.lua cue registry.
 */

import type { AudioCategory } from './SoundManager';

export interface AudioCue {
  path: string;
  volume: number;
  loop: boolean;
  category: AudioCategory;
  /** Whether this sound should be spatially positioned. */
  spatial: boolean;
}

/**
 * Audio cue registry.
 * Paths are relative to public/assets/audio/.
 * When actual audio files are extracted, these paths will resolve.
 * Fallback procedural sounds are used when files are missing.
 */
export const AUDIO_CUES: Record<string, AudioCue> = {
  // ── UI sounds ─────────────────────────────────────────────────
  UI_Select:        { path: 'ui/select.ogg',        volume: 0.8, loop: false, category: 'ui', spatial: false },
  UI_Confirm:       { path: 'ui/confirm.ogg',       volume: 0.9, loop: false, category: 'ui', spatial: false },
  UI_Disallow:      { path: 'ui/disallow.ogg',      volume: 0.7, loop: false, category: 'ui', spatial: false },
  UI_Expand:        { path: 'ui/expand.ogg',        volume: 0.6, loop: false, category: 'ui', spatial: false },
  UI_Hilight:       { path: 'ui/hilight.ogg',       volume: 0.4, loop: false, category: 'ui', spatial: false },
  UI_GridShow:      { path: 'ui/grid_show.ogg',     volume: 0.7, loop: false, category: 'ui', spatial: false },
  UI_BuildScroll:   { path: 'ui/build_scroll.ogg',  volume: 0.5, loop: false, category: 'ui', spatial: false },
  UI_MatterScroll:  { path: 'ui/matter_scroll.ogg', volume: 0.5, loop: false, category: 'ui', spatial: false },
  UI_PlaceBeacon:   { path: 'ui/place_beacon.ogg',  volume: 0.8, loop: false, category: 'ui', spatial: false },
  UI_InspectorShow: { path: 'ui/inspector_show.ogg',   volume: 0.6, loop: false, category: 'ui', spatial: false },
  UI_InspectorFolder: { path: 'ui/inspector_folder.ogg', volume: 0.5, loop: false, category: 'ui', spatial: false },
  UI_InspectorDuty: { path: 'ui/inspector_duty.ogg',   volume: 0.5, loop: false, category: 'ui', spatial: false },

  // ── Menu sounds ───────────────────────────────────────────────
  Intro_AcceptButton: { path: 'ui/intro_accept.ogg', volume: 0.9, loop: false, category: 'ui', spatial: false },
  Intro_CancelButton: { path: 'ui/intro_cancel.ogg', volume: 0.7, loop: false, category: 'ui', spatial: false },
  Intro_LaunchButton: { path: 'ui/intro_launch.ogg', volume: 1.0, loop: false, category: 'ui', spatial: false },

  // ── Placement sounds ──────────────────────────────────────────
  PlaceDoor:      { path: 'ui/place_door.ogg',      volume: 0.8, loop: false, category: 'sfx', spatial: false },
  PlaceBed:       { path: 'ui/place_bed.ogg',       volume: 0.7, loop: false, category: 'sfx', spatial: false },
  PlaceReactor:   { path: 'ui/place_reactor.ogg',   volume: 0.9, loop: false, category: 'sfx', spatial: false },
  PlaceOxygen:    { path: 'ui/place_oxygen.ogg',    volume: 0.8, loop: false, category: 'sfx', spatial: false },
  PlaceTable:     { path: 'ui/place_table.ogg',     volume: 0.6, loop: false, category: 'sfx', spatial: false },
  PlacePlant:     { path: 'ui/place_plant.ogg',     volume: 0.5, loop: false, category: 'sfx', spatial: false },

  // ── Alarm sounds ──────────────────────────────────────────────
  Alarm_Alert:      { path: 'sfx/alarm_alert.ogg',      volume: 1.0, loop: false, category: 'sfx', spatial: false },
  Alarm_Breach:     { path: 'sfx/alarm_breach.ogg',     volume: 1.0, loop: false, category: 'sfx', spatial: false },
  Alarm_Fire:       { path: 'sfx/alarm_fire.ogg',       volume: 1.0, loop: false, category: 'sfx', spatial: false },
  Alarm_LowOxygen:  { path: 'sfx/alarm_low_oxygen.ogg', volume: 1.0, loop: false, category: 'sfx', spatial: false },

  // ── SFX (spatial) ─────────────────────────────────────────────
  DoorOpen:         { path: 'sfx/door_open.ogg',        volume: 0.7, loop: false, category: 'sfx', spatial: true },
  DoorClose:        { path: 'sfx/door_close.ogg',       volume: 0.7, loop: false, category: 'sfx', spatial: true },
  ReactorLoop:      { path: 'sfx/reactor_loop.ogg',     volume: 0.4, loop: true,  category: 'sfx', spatial: true },
  RefineryLoop:     { path: 'sfx/refinery_loop.ogg',    volume: 0.4, loop: true,  category: 'sfx', spatial: true },
  OxygenRecyclerLoop: { path: 'sfx/oxygen_recycler.ogg', volume: 0.3, loop: true, category: 'sfx', spatial: true },
  FireLoop:         { path: 'sfx/fire_loop.ogg',        volume: 0.6, loop: true,  category: 'sfx', spatial: true },
  FireStartExtra:   { path: 'sfx/fire_start.ogg',       volume: 0.8, loop: false, category: 'sfx', spatial: true },
  WallExplode:      { path: 'sfx/wall_explode.ogg',     volume: 1.0, loop: false, category: 'sfx', spatial: true },
  MeteorAppear:     { path: 'sfx/meteor_appear.ogg',    volume: 0.8, loop: false, category: 'sfx', spatial: false },
  MeteorImpact:     { path: 'sfx/meteor_impact.ogg',    volume: 1.0, loop: false, category: 'sfx', spatial: true },

  // ── Combat sounds ─────────────────────────────────────────────
  Brawl_Impact:     { path: 'sfx/brawl_impact.ogg',     volume: 0.8, loop: false, category: 'sfx', spatial: true },
  Laser_Impact:     { path: 'sfx/laser_impact.ogg',     volume: 0.9, loop: false, category: 'sfx', spatial: true },
  Taser_Impact:     { path: 'sfx/taser_impact.ogg',     volume: 0.7, loop: false, category: 'sfx', spatial: true },

  // ── Event sounds ──────────────────────────────────────────────
  Raider_Docking:   { path: 'sfx/raider_docking.ogg',   volume: 0.8, loop: false, category: 'sfx', spatial: false },
  SpaceTaxi:        { path: 'sfx/space_taxi.ogg',       volume: 0.6, loop: false, category: 'sfx', spatial: false },

  // ── Music tracks ──────────────────────────────────────────────
  Intro_GuitarTrack:  { path: 'music/intro.ogg',   volume: 0.6, loop: false, category: 'music', spatial: false },
  Track1:             { path: 'music/track1.ogg',   volume: 0.5, loop: false, category: 'music', spatial: false },
  Track2:             { path: 'music/track2.ogg',   volume: 0.5, loop: false, category: 'music', spatial: false },
  Track3:             { path: 'music/track3.ogg',   volume: 0.5, loop: false, category: 'music', spatial: false },
  Track4:             { path: 'music/track4.ogg',   volume: 0.5, loop: false, category: 'music', spatial: false },
  Track5:             { path: 'music/track5.ogg',   volume: 0.5, loop: false, category: 'music', spatial: false },

  // ── Ambience loops ────────────────────────────────────────────
  Ambience_A:       { path: 'ambience/exterior_a.ogg', volume: 0.4, loop: true, category: 'ambience', spatial: false },
  Ambience_B:       { path: 'ambience/exterior_b.ogg', volume: 0.4, loop: true, category: 'ambience', spatial: false },
  Ambience_C:       { path: 'ambience/exterior_c.ogg', volume: 0.4, loop: true, category: 'ambience', spatial: false },
  Ambience_D:       { path: 'ambience/exterior_d.ogg', volume: 0.4, loop: true, category: 'ambience', spatial: false },
  Ambience_E:       { path: 'ambience/exterior_e.ogg', volume: 0.4, loop: true, category: 'ambience', spatial: false },
  InteriorAmbience: { path: 'ambience/interior.ogg',   volume: 0.3, loop: true, category: 'ambience', spatial: false },

  // ── Jukebox ───────────────────────────────────────────────────
  Jukebox_Music:    { path: 'sfx/jukebox_music.ogg',    volume: 0.5, loop: true,  category: 'sfx', spatial: true },
};
