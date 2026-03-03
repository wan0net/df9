/**
 * FieldScanAndHeal.ts — Doctor scans and heals a wounded character.
 * Mirrors Activities/FieldScanAndHeal.lua.
 */

import { Task, type NeedAdvertisement } from '../Task';
import type { Character } from '../../characters/Character';
import { HEAL_RATE, STARTING_HIT_POINTS } from '../../characters/CharacterConstants';

export class FieldScanAndHeal extends Task {
  readonly name = 'FieldScanAndHeal';
  nJobExperience = 25;

  private patient: Character;

  constructor(patient: Character) {
    super();
    this.patient = patient;
  }

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [{ need: 'duty', amount: 16 }];
  }

  protected onStart() {
    this.duration = 20;
  }

  protected onUpdate(dt: number) {
    if (this.elapsedTime >= this.duration) {
      // Heal the patient
      if (this.patient.isAlive()) {
        const healAmount = STARTING_HIT_POINTS * HEAL_RATE * this.duration;
        this.patient.tStats.nHP = Math.min(
          this.patient.tStats.nMaxHP,
          this.patient.tStats.nHP + healAmount,
        );
      }
      this.complete();
    }
  }
}
