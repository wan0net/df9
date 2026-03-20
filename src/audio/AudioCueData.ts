/**
 * AudioCueData.ts — Maps cue names to file paths and metadata.
 * Mirrors SoundManager.lua cue registry.
 *
 * Paths point to WAV files extracted from FMOD banks by tools/extract_fmod.py.
 * Fallback procedural sounds are used when files are missing.
 */

import type { AudioCategory } from './SoundManager';

export interface AudioCue {
  path: string;
  volume: number;
  loop: boolean;
  category: AudioCategory;
  /** Whether this sound should be spatially positioned. */
  spatial: boolean;
  /** Variant paths for random selection. If set, path is ignored and a random variant is picked. */
  variants?: string[];
}

/**
 * Audio cue registry.
 * Paths are relative to public/assets/audio/.
 */
export const AUDIO_CUES: Record<string, AudioCue> = {
  // ── UI sounds ─────────────────────────────────────────────────
  UI_Select:        { path: 'ui/NewSelect_1.wav',          volume: 0.8, loop: false, category: 'ui', spatial: false },
  UI_Confirm:       { path: 'ui/UI_Confirm.wav',           volume: 0.9, loop: false, category: 'ui', spatial: false },
  UI_Disallow:      { path: 'ui/UI_DisallowTemp.wav',      volume: 0.7, loop: false, category: 'ui', spatial: false },
  UI_Expand:        { path: 'ui/UI_Expand2.wav',           volume: 0.6, loop: false, category: 'ui', spatial: false },
  UI_Hilight:       { path: 'ui/UI_Hilight1.wav',          volume: 0.4, loop: false, category: 'ui', spatial: false },
  UI_GridShow:      { path: 'ui/UI_GridShow.wav',          volume: 0.7, loop: false, category: 'ui', spatial: false },
  UI_BuildScroll:   { path: 'ui/UI_Drag2.wav',             volume: 0.5, loop: false, category: 'ui', spatial: false },
  UI_MatterScroll:  { path: 'ui/UI_MatterScroll.wav',      volume: 0.5, loop: false, category: 'ui', spatial: false },
  UI_PlaceBeacon:   { path: 'ui/Spacebase_PlaceBeacon.wav', volume: 0.8, loop: false, category: 'ui', spatial: false },
  UI_InspectorShow: { path: 'ui/UI_InspectorShow.wav',     volume: 0.6, loop: false, category: 'ui', spatial: false },
  UI_InspectorFolder: { path: 'ui/UI_InspectorFolder.wav', volume: 0.5, loop: false, category: 'ui', spatial: false },
  UI_InspectorDuty: { path: 'ui/UI_InspectorJobSelect.wav', volume: 0.5, loop: false, category: 'ui', spatial: false },
  UI_MapScreen:     { path: 'ui/UI_MapScreen.wav',         volume: 0.6, loop: false, category: 'ui', spatial: false },
  UI_ShortStatic:   { path: 'ui/UI_ShortStatic.wav',       volume: 0.5, loop: false, category: 'ui', spatial: false },
  degauss:          { path: 'ui/UI_ShortStatic2.wav',      volume: 0.4, loop: false, category: 'ui', spatial: false },
  selectdegauss:    { path: 'ui/UI_ShortStatic.wav',       volume: 0.5, loop: false, category: 'ui', spatial: false },
  // Lua SFX name aliases (Lua uses lowercase names, our code uses UI_ prefix)
  select:           { path: 'ui/NewSelect_1.wav',          volume: 0.8, loop: false, category: 'ui', spatial: false },
  confirm:          { path: 'ui/UI_Confirm.wav',           volume: 0.9, loop: false, category: 'ui', spatial: false },
  hilight:          { path: 'ui/UI_Hilight1.wav',          volume: 0.4, loop: false, category: 'ui', spatial: false },
  disallow:         { path: 'ui/UI_DisallowTemp.wav',      volume: 0.7, loop: false, category: 'ui', spatial: false },
  placebeacon:      { path: 'ui/Spacebase_PlaceBeacon.wav', volume: 0.8, loop: false, category: 'ui', spatial: false },
  buildscroll:      { path: 'ui/UI_Drag2.wav',             volume: 0.5, loop: false, category: 'ui', spatial: false },
  mattercounter:    { path: 'ui/UI_MatterScroll.wav',      volume: 0.5, loop: false, category: 'ui', spatial: false },
  vaporize:         { path: 'sfx/Vaporize_1.wav',          volume: 0.8, loop: false, category: 'sfx', spatial: false },
  UI_DoorLock:      { path: 'ui/UI_InspectorDoorLock_PDown.wav', volume: 0.5, loop: false, category: 'ui', spatial: false },

  // ── Object placement sounds (Lua EnvObjectData placeSound) ────
  placeairlock:        { path: 'ui/PlaceAirlock2.wav',          volume: 0.7, loop: false, category: 'sfx', spatial: false },
  placebar:            { path: 'ui/PlaceBar1.wav',              volume: 0.7, loop: false, category: 'sfx', spatial: false },
  placebed:            { path: 'ui/PlaceBed1.wav',              volume: 0.7, loop: false, category: 'sfx', spatial: false },
  placedoor:           { path: 'ui/PlaceDoor1.wav',             volume: 0.7, loop: false, category: 'sfx', spatial: false },
  placedresser:        { path: 'ui/PlaceDresser2.wav',          volume: 0.7, loop: false, category: 'sfx', spatial: false },
  placefoodreplicator: { path: 'ui/PlaceFoodReplicator_1.wav',  volume: 0.7, loop: false, category: 'sfx', spatial: false },
  placefridge:         { path: 'ui/PlaceFridge_1.wav',          volume: 0.7, loop: false, category: 'sfx', spatial: false },
  placehydroplant:     { path: 'ui/PlaceHydroPlant_1.wav',      volume: 0.7, loop: false, category: 'sfx', spatial: false },
  placemonitor:        { path: 'ui/PlaceMonitor2.wav',          volume: 0.7, loop: false, category: 'sfx', spatial: false },
  placeneon:           { path: 'ui/PlaceNeon_2.wav',            volume: 0.7, loop: false, category: 'sfx', spatial: false },
  placeoxygenfilter:   { path: 'ui/PlaceOxygenFilter1.wav',     volume: 0.7, loop: false, category: 'sfx', spatial: false },
  placeplant:          { path: 'ui/PlacePlant2.wav',            volume: 0.7, loop: false, category: 'sfx', spatial: false },
  placereactor:        { path: 'ui/PlaceReactor1.wav',          volume: 0.7, loop: false, category: 'sfx', spatial: false },
  placerecycler:       { path: 'ui/PlaceRecycler1.wav',         volume: 0.7, loop: false, category: 'sfx', spatial: false },
  placerefinery:       { path: 'ui/PlaceRefinery1.wav',         volume: 0.7, loop: false, category: 'sfx', spatial: false },
  placerug:            { path: 'ui/PlaceRug2.wav',              volume: 0.7, loop: false, category: 'sfx', spatial: false },
  placespacesuitlocker:{ path: 'ui/PlaceSpaceSuitLocker2.wav',  volume: 0.7, loop: false, category: 'sfx', spatial: false },
  placestove:          { path: 'ui/PlaceStove_1.wav',           volume: 0.7, loop: false, category: 'sfx', spatial: false },
  placetable:          { path: 'ui/PlaceTable_1.wav',           volume: 0.7, loop: false, category: 'sfx', spatial: false },

  // ── Menu sounds ───────────────────────────────────────────────
  Intro_AcceptButton: { path: 'ui/Intro_AcceptButton.wav',         volume: 0.9, loop: false, category: 'ui', spatial: false },
  Intro_CancelButton: { path: 'ui/Intro_CancelButton.wav',         volume: 0.7, loop: false, category: 'ui', spatial: false },
  Intro_LaunchButton: { path: 'ui/Intro_ProperTimedLaunchButton.wav', volume: 1.0, loop: false, category: 'ui', spatial: false },
  Intro_LaunchOpen:   { path: 'ui/Intro_LaunchOpen.wav',            volume: 0.8, loop: false, category: 'ui', spatial: false },
  Intro_LaunchClose:  { path: 'ui/Intro_LaunchClose.wav',           volume: 0.8, loop: false, category: 'ui', spatial: false },
  Intro_UIAppear:     { path: 'ui/Intro_UIAppearRetimed.wav',       volume: 0.7, loop: false, category: 'ui', spatial: false },
  Intro_UIDisappear:  { path: 'ui/Intro_NewUIDissappear.wav',       volume: 0.6, loop: false, category: 'ui', spatial: false },
  Intro_LaunchScreen: { path: 'ui/Intro_LaunchScreenAppear.wav',    volume: 0.7, loop: false, category: 'ui', spatial: false },

  // ── Placement sounds ──────────────────────────────────────────
  PlaceDoor:       { path: 'ui/PlaceDoor1.wav',            volume: 0.8, loop: false, category: 'sfx', spatial: false },
  PlaceBed:        { path: 'ui/PlaceBed1.wav',             volume: 0.7, loop: false, category: 'sfx', spatial: false },
  PlaceReactor:    { path: 'ui/PlaceReactor1.wav',         volume: 0.9, loop: false, category: 'sfx', spatial: false },
  PlaceOxygen:     { path: 'ui/PlaceOxygenFilter1.wav',    volume: 0.8, loop: false, category: 'sfx', spatial: false },
  PlaceTable:      { path: 'ui/PlaceTable_1.wav',          volume: 0.6, loop: false, category: 'sfx', spatial: false },
  PlacePlant:      { path: 'ui/PlacePlant1.wav',           volume: 0.5, loop: false, category: 'sfx', spatial: false },
  PlaceBar:        { path: 'ui/PlaceBar1.wav',             volume: 0.7, loop: false, category: 'sfx', spatial: false },
  PlaceDresser:    { path: 'ui/PlaceDresser1.wav',         volume: 0.6, loop: false, category: 'sfx', spatial: false },
  PlaceFridge:     { path: 'ui/PlaceFridge_1.wav',         volume: 0.7, loop: false, category: 'sfx', spatial: false },
  PlaceStove:      { path: 'ui/PlaceStove_1.wav',          volume: 0.7, loop: false, category: 'sfx', spatial: false },
  PlaceRug:        { path: 'ui/PlaceRug1.wav',             volume: 0.5, loop: false, category: 'sfx', spatial: false },
  PlaceNeon:       { path: 'ui/PlaceNeon_1.wav',           volume: 0.7, loop: false, category: 'sfx', spatial: false },
  PlaceRefinery:   { path: 'ui/PlaceRefinery1.wav',        volume: 0.8, loop: false, category: 'sfx', spatial: false },
  PlaceRecycler:   { path: 'ui/PlaceRecycler1.wav',        volume: 0.8, loop: false, category: 'sfx', spatial: false },
  PlaceSpacesuitLocker: { path: 'ui/PlaceSpaceSuitLocker1.wav', volume: 0.7, loop: false, category: 'sfx', spatial: false },
  PlaceMonitor:    { path: 'ui/PlaceMonitor1.wav',         volume: 0.6, loop: false, category: 'sfx', spatial: false },
  PlaceAirlock:    { path: 'ui/PlaceAirlock1.wav',         volume: 0.8, loop: false, category: 'sfx', spatial: false },
  PlaceReactorTile: { path: 'ui/PlaceReactorTile1.wav',    volume: 0.7, loop: false, category: 'sfx', spatial: false },
  PlaceFireExtinguisher: { path: 'ui/PlaceFireExtinguisher1.wav', volume: 0.7, loop: false, category: 'sfx', spatial: false },
  PlaceFoodReplicator: { path: 'ui/PlaceFoodReplicator_1.wav', volume: 0.7, loop: false, category: 'sfx', spatial: false },
  PlaceHydroPlant: { path: 'ui/PlaceHydroPlant_1.wav',     volume: 0.5, loop: false, category: 'sfx', spatial: false },

  // ── Zone sounds ───────────────────────────────────────────────
  BuildZone:     { path: 'sfx/BuildZone_6.wav',           volume: 0.8, loop: false, category: 'sfx', spatial: false },
  NewBuildZone:  { path: 'sfx/NewBuildZone1.wav',         volume: 0.8, loop: false, category: 'sfx', spatial: false },
  Claim_A:       { path: 'ui/Spacebase_Claim_A.wav',      volume: 0.8, loop: false, category: 'ui', spatial: false },
  Unclaim_A:     { path: 'ui/Spacebase_Unclaim_A.wav',    volume: 0.7, loop: false, category: 'ui', spatial: false },
  ClearBeacon:   { path: 'ui/Spacebase_ClearBeacon.wav',  volume: 0.8, loop: false, category: 'ui', spatial: false },

  // ── Alarm sounds ──────────────────────────────────────────────
  Alarm_Alert:      { path: 'sfx/Spacebase_Alarm_Alert.wav',    volume: 1.0, loop: false, category: 'sfx', spatial: false },
  Alarm_Breach:     { path: 'sfx/Spacebase_Alarm_Breach.wav',   volume: 1.0, loop: false, category: 'sfx', spatial: false },
  Alarm_Fire:       { path: 'sfx/Spacebase_Alarm_Fire.wav',     volume: 1.0, loop: false, category: 'sfx', spatial: false },
  Alarm_LowOxygen:  { path: 'sfx/Spacebase_Alarm_Low_O2.wav',  volume: 1.0, loop: false, category: 'sfx', spatial: false },

  // ── SFX (spatial) ─────────────────────────────────────────────
  DoorOpen:         { path: 'sfx/DoorOpen1_Short.wav',          volume: 0.7, loop: false, category: 'sfx', spatial: true,
                      variants: ['sfx/DoorOpen1_Short.wav', 'sfx/DoorOpen2_Short.wav', 'sfx/DoorOpen3_Short.wav'] },
  DoorClose:        { path: 'sfx/DoorClose1.wav',               volume: 0.7, loop: false, category: 'sfx', spatial: true,
                      variants: ['sfx/DoorClose1.wav', 'sfx/DoorClose2.wav', 'sfx/DoorClose3.wav'] },
  AirlockOpen:      { path: 'sfx/AirlockOpen_Short.wav',        volume: 0.8, loop: false, category: 'sfx', spatial: true },
  AirlockClose:     { path: 'sfx/AirlockClose_Short.wav',       volume: 0.8, loop: false, category: 'sfx', spatial: true },
  ReactorLoop:      { path: 'sfx/ReactorLoop.wav',              volume: 0.4, loop: true,  category: 'sfx', spatial: true },
  RefineryLoop:     { path: 'sfx/RefineryLoop.wav',             volume: 0.4, loop: true,  category: 'sfx', spatial: true },
  OxygenRecyclerLoop: { path: 'sfx/OxygenRecyclerLoop.wav',     volume: 0.3, loop: true,  category: 'sfx', spatial: true },
  FireLoop:         { path: 'sfx/FireLoop.wav',                  volume: 0.6, loop: true,  category: 'sfx', spatial: true },
  FireStartExtra:   { path: 'sfx/FireStart.wav',                 volume: 0.8, loop: false, category: 'sfx', spatial: true },
  FireOut:          { path: 'sfx/FireOut.wav',                    volume: 0.7, loop: false, category: 'sfx', spatial: true },
  FireExtinguish:   { path: 'sfx/NewFireExtinguish1.wav',        volume: 0.8, loop: false, category: 'sfx', spatial: true },
  BuildObject:      { path: 'sfx/BuildObject_1.wav',             volume: 0.7, loop: false, category: 'sfx', spatial: true },
  Vaporize:         { path: 'sfx/Vaporize_1.wav',                volume: 0.9, loop: false, category: 'sfx', spatial: true },
  MineOre:          { path: 'sfx/NewMineOre1.wav',               volume: 0.7, loop: false, category: 'sfx', spatial: true },
  WallExplode:      { path: 'sfx/WallExplode1.wav',              volume: 1.0, loop: false, category: 'sfx', spatial: true },
  MeteorAppear:     { path: 'sfx/MeteorAppear.wav',              volume: 0.8, loop: false, category: 'sfx', spatial: false },
  MeteorImpact:     { path: 'sfx/MeteorExplode1.wav',            volume: 1.0, loop: false, category: 'sfx', spatial: true },
  SpaceSuitEquip:   { path: 'sfx/SpaceSuitEquip1.wav',           volume: 0.8, loop: false, category: 'sfx', spatial: true },
  FridgeOpen:       { path: 'sfx/FridgeOpen.wav',                volume: 0.5, loop: false, category: 'sfx', spatial: true },
  FridgeClose:      { path: 'sfx/FrideClose.wav',                volume: 0.5, loop: false, category: 'sfx', spatial: true },
  OutofBed:         { path: 'sfx/OutofBed_1.wav',                volume: 0.5, loop: false, category: 'sfx', spatial: true },
  DoctorScan:       { path: 'sfx/Citizen_DoctorScan.wav',        volume: 0.6, loop: false, category: 'sfx', spatial: true },
  TechMaintain:     { path: 'sfx/Citizen_TechnicianMaintain.wav', volume: 0.5, loop: false, category: 'sfx', spatial: true },
  PowerDown:        { path: 'sfx/Spacebase_PowerDown_A.wav',     volume: 0.7, loop: false, category: 'sfx', spatial: false },
  PowerUp:          { path: 'sfx/Spacebase_PowerUp_A.wav',       volume: 0.7, loop: false, category: 'sfx', spatial: false },
  TimeWarp:         { path: 'sfx/Spacebase_TimeWarpA.wav',       volume: 0.5, loop: false, category: 'sfx', spatial: false },

  // ── Gun sounds ────────────────────────────────────────────────
  GunShot:          { path: 'sfx/GunShot1.wav',                  volume: 0.9, loop: false, category: 'sfx', spatial: true,
                      variants: ['sfx/GunShot1.wav', 'sfx/GunShot2.wav', 'sfx/GunShot3.wav', 'sfx/GunShot4.wav'] },
  TurretFire:       { path: 'sfx/Spacebase_TurretGuns_Fire_A.wav', volume: 0.8, loop: false, category: 'sfx', spatial: true },
  TurretRotate:     { path: 'sfx/Spacebase_TurretGuns_Rotate_A.wav', volume: 0.5, loop: false, category: 'sfx', spatial: true },

  // ── Combat sounds ─────────────────────────────────────────────
  Brawl_Impact:     { path: 'ambience/Spacebase_Brawllmpact_A.wav', volume: 0.8, loop: false, category: 'sfx', spatial: true,
                      variants: ['ambience/Spacebase_Brawllmpact_A.wav', 'ambience/Spacebase_Brawllmpact_B.wav',
                                 'ambience/Spacebase_Brawllmpact_C.wav', 'ambience/Spacebase_Brawllmpact_D.wav',
                                 'ambience/Spacebase_Brawllmpact_E.wav', 'ambience/Spacebase_Brawllmpact_F.wav',
                                 'ambience/Spacebase_Brawllmpact_G.wav', 'ambience/Spacebase_Brawllmpact_H.wav',
                                 'ambience/Spacebase_Brawllmpact_I.wav', 'ambience/Spacebase_Brawllmpact_J.wav'] },
  Laser_Impact:     { path: 'ambience/Spacebase_Laserlmpact_A.wav', volume: 0.9, loop: false, category: 'sfx', spatial: true },
  Taser_Impact:     { path: 'ambience/Spacebase_Taserlmpact_A.wav', volume: 0.7, loop: false, category: 'sfx', spatial: true },
  Citizen_Drink:    { path: 'sfx/Citizen_Drink1.wav',             volume: 0.5, loop: false, category: 'sfx', spatial: true },
  Citizen_FireDeath: { path: 'sfx/Citizen_FireDeath.wav',          volume: 0.8, loop: false, category: 'sfx', spatial: true },
  Citizen_ShotDeath: { path: 'sfx/Citizen_ShotDeath.wav',          volume: 0.8, loop: false, category: 'sfx', spatial: true },
  Citizen_EmergencyDraw: { path: 'sfx/Citizen_EmergencyDraw.wav',  volume: 0.7, loop: false, category: 'sfx', spatial: true },
  MonsterAttack:    { path: 'sfx/Monster_NewHitReact.wav',         volume: 0.8, loop: false, category: 'sfx', spatial: true },
  MonsterScream:    { path: 'sfx/Monster_Scream.wav',              volume: 0.9, loop: false, category: 'sfx', spatial: true },
  BadAlien_Attack:  { path: 'sfx/Spacebase_BadAlien_Attack_A.wav', volume: 0.8, loop: false, category: 'sfx', spatial: true },
  Killbot_Attack:   { path: 'sfx/Spacebase_Killbot_Attack.wav',    volume: 0.9, loop: false, category: 'sfx', spatial: true },
  Killbot_Death:    { path: 'sfx/Spacebase_Killbot_Death.wav',     volume: 0.8, loop: false, category: 'sfx', spatial: true },
  Killbot_Idle:     { path: 'sfx/Spacebase_Killbot_Idle.wav',      volume: 0.4, loop: true,  category: 'sfx', spatial: true },
  Killbot_Walk:     { path: 'sfx/Spacebase_Killbot_Walk.wav',      volume: 0.4, loop: false, category: 'sfx', spatial: true },
  DropOffBody:      { path: 'sfx/Spacebase_Citizen_DropOffBody.wav', volume: 0.6, loop: false, category: 'sfx', spatial: true },
  Firefight_Stomp:  { path: 'sfx/Citizen_Firefight_Stomp.wav',     volume: 0.7, loop: false, category: 'sfx', spatial: true },

  // ── Event sounds ──────────────────────────────────────────────
  Raider_Docking:   { path: 'sfx/Spacebase_RaiderDocking.wav',    volume: 0.8, loop: false, category: 'sfx', spatial: false },
  Raider_Drill:     { path: 'sfx/Spacebase_RaiderDrill.wav',      volume: 0.9, loop: false, category: 'sfx', spatial: false },
  Raider_Engine:    { path: 'sfx/Spacebase_RaiderEngineLoop.wav',  volume: 0.6, loop: true,  category: 'sfx', spatial: false },
  SpaceTaxi:        { path: 'sfx/SpaceTaxi.wav',                   volume: 0.6, loop: false, category: 'sfx', spatial: false },
  SpaceTaxi_Arrive: { path: 'sfx/Spacebase_Spacetaxi_Arrive.wav',  volume: 0.7, loop: false, category: 'sfx', spatial: false },
  SpaceTaxi_Depart: { path: 'sfx/Spacebase_Spacetaxi_Depart.wav',  volume: 0.7, loop: false, category: 'sfx', spatial: false },
  DerelictDocking:  { path: 'sfx/Spacebase_DerelictDocking.wav',    volume: 0.8, loop: false, category: 'sfx', spatial: false },

  // ── Music tracks ──────────────────────────────────────────────
  Intro_GuitarTrack:  { path: 'music/LaunchScreenGuitar_Rev1.wav',    volume: 0.6, loop: false, category: 'music', spatial: false },
  Track1:             { path: 'music/SpaceBase_Track1.wav',            volume: 0.5, loop: false, category: 'music', spatial: false },
  Track1_Revoice:     { path: 'music/SpaceBase_Track1_Revoice.wav',    volume: 0.5, loop: false, category: 'music', spatial: false },
  Track2:             { path: 'music/SpaceBase_Track2.wav',            volume: 0.5, loop: false, category: 'music', spatial: false },
  Track3:             { path: 'music/SpaceBase_Track3.wav',            volume: 0.5, loop: false, category: 'music', spatial: false },
  Track3_Revoice:     { path: 'music/SpaceBase_Track3_Revoice.wav',    volume: 0.5, loop: false, category: 'music', spatial: false },
  Track4:             { path: 'music/SpaceBase_Track4.wav',            volume: 0.5, loop: false, category: 'music', spatial: false },
  Track5:             { path: 'music/SpaceBase_Track5.wav',            volume: 0.5, loop: false, category: 'music', spatial: false },

  // ── Ambience loops ────────────────────────────────────────────
  Ambience_A:       { path: 'ambience/Ambience_A.wav',              volume: 0.4, loop: true, category: 'ambience', spatial: false },
  Ambience_B:       { path: 'ambience/Ambience_B.wav',              volume: 0.4, loop: true, category: 'ambience', spatial: false },
  Ambience_C:       { path: 'ambience/Ambience_C.wav',              volume: 0.4, loop: true, category: 'ambience', spatial: false },
  Ambience_D:       { path: 'ambience/Ambience_D.wav',              volume: 0.4, loop: true, category: 'ambience', spatial: false },
  Ambience_E:       { path: 'ambience/Ambience_E.wav',              volume: 0.4, loop: true, category: 'ambience', spatial: false },
  Ambience_A_Reson: { path: 'ambience/Ambience_A_Reson.wav',        volume: 0.3, loop: true, category: 'ambience', spatial: false },
  InteriorAmbience: { path: 'ambience/Spacebase_InteriorDefaultAmbience_5.wav', volume: 0.3, loop: true, category: 'ambience', spatial: false },
  WallaPos:         { path: 'ambience/Spacebase_WallaLayers2_Pos1.wav', volume: 0.2, loop: true, category: 'ambience', spatial: false },
  WallaNeg:         { path: 'ambience/Spacebase_WallaLayers2_Neg1.wav', volume: 0.2, loop: true, category: 'ambience', spatial: false },

  // ── Jukebox ───────────────────────────────────────────────────
  Jukebox_Music:    { path: 'music/SpaceBase_Track2.wav',            volume: 0.5, loop: true,  category: 'sfx', spatial: true },

  // ── Voice (Male) ─────────────────────────────────────────────
  Voice_Male_Greeting:  { path: 'voice/Greeting_1.wav', volume: 0.5, loop: false, category: 'sfx', spatial: true,
    variants: ['voice/Greeting_1.wav', 'voice/Greeting_2.wav', 'voice/Greeting_3.wav', 'voice/Greeting_4.wav', 'voice/Greeting_5.wav'] },
  Voice_Male_Positive:  { path: 'voice/Positive_1.wav', volume: 0.4, loop: false, category: 'sfx', spatial: true,
    variants: ['voice/Positive_1.wav', 'voice/Positive_2.wav', 'voice/Positive_3.wav', 'voice/Positive_4.wav', 'voice/Positive_5.wav',
               'voice/Positive_6.wav', 'voice/Positive_7.wav', 'voice/Positive_8.wav', 'voice/Positive_9.wav', 'voice/Positive_10.wav', 'voice/Positive_11.wav'] },
  Voice_Male_Negative:  { path: 'voice/Negative_1.wav', volume: 0.5, loop: false, category: 'sfx', spatial: true,
    variants: ['voice/Negative_1.wav', 'voice/Negative_2.wav', 'voice/Negative_3.wav', 'voice/Negative_4.wav', 'voice/Negative_5.wav',
               'voice/Negative_6.wav', 'voice/Negative_7.wav'] },
  Voice_Male_Panic:     { path: 'voice/Panic_1.wav', volume: 0.6, loop: false, category: 'sfx', spatial: true,
    variants: ['voice/Panic_1.wav', 'voice/Panic_2.wav', 'voice/Panic_3.wav', 'voice/Panic_4.wav', 'voice/Panic_5.wav', 'voice/Panic_6.wav'] },
  Voice_Male_ShotDeath: { path: 'voice/ShotDeath_1.wav', volume: 0.7, loop: false, category: 'sfx', spatial: true,
    variants: ['voice/ShotDeath_1.wav', 'voice/ShotDeath_2.wav', 'voice/ShotDeath_3.wav', 'voice/ShotDeath_4.wav', 'voice/ShotDeath_5.wav', 'voice/ShotDeath_6.wav'] },

  // ── Voice (Female) ───────────────────────────────────────────
  Voice_Female_Greeting:  { path: 'voice/FemaleGreeting_1.wav', volume: 0.5, loop: false, category: 'sfx', spatial: true,
    variants: ['voice/FemaleGreeting_1.wav', 'voice/FemaleGreeting_2.wav', 'voice/FemaleGreeting_3.wav',
               'voice/FemaleGreeting_4.wav', 'voice/FemaleGreeting_5.wav', 'voice/FemaleGreeting_6.wav'] },
  Voice_Female_Positive:  { path: 'voice/FemalePositive_1.wav', volume: 0.4, loop: false, category: 'sfx', spatial: true,
    variants: ['voice/FemalePositive_1.wav', 'voice/FemalePositive_2.wav', 'voice/FemalePositive_3.wav', 'voice/FemalePositive_4.wav',
               'voice/FemalePositive_5.wav', 'voice/FemalePositive_6.wav', 'voice/FemalePositive_7.wav', 'voice/FemalePositive_8.wav', 'voice/FemalePositive_9.wav'] },
  Voice_Female_Negative:  { path: 'voice/FemaleNegative_1.wav', volume: 0.5, loop: false, category: 'sfx', spatial: true,
    variants: ['voice/FemaleNegative_1.wav', 'voice/FemaleNegative_2.wav', 'voice/FemaleNegative_3.wav', 'voice/FemaleNegative_4.wav',
               'voice/FemaleNegative_5.wav', 'voice/FemaleNegative_6.wav', 'voice/FemaleNegative_7.wav'] },
  Voice_Female_Panic:     { path: 'voice/FemalePanic_1.wav', volume: 0.6, loop: false, category: 'sfx', spatial: true,
    variants: ['voice/FemalePanic_1.wav', 'voice/FemalePanic_2.wav', 'voice/FemalePanic_3.wav'] },
  Voice_Female_ShotDeath: { path: 'voice/FemaleShotDeath_1.wav', volume: 0.7, loop: false, category: 'sfx', spatial: true,
    variants: ['voice/FemaleShotDeath_1.wav', 'voice/FemaleShotDeath_2.wav', 'voice/FemaleShotDeath_3.wav', 'voice/FemaleShotDeath_4.wav',
               'voice/FemaleShotDeath_5.wav', 'voice/FemaleShotDeath_6.wav', 'voice/FemaleShotDeath_7.wav'] },
};
