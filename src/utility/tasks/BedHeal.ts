/**
 * BedHeal.ts — Doctor heals patient in hospital bed.
 * Mirrors Lua BedHeal: Duty=16, Doctor job, nJobExperience=20.
 */

import { Task, type NeedAdvertisement } from '../Task';
import type { Character } from '../../characters/Character';

export class BedHeal extends Task {
  readonly name = 'BedHeal';
  nJobExperience = 20;
  private patient: Character;

  constructor(patient: Character) {
    super();
    this.patient = patient;
  }

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [
      { need: 'duty', amount: 16 },
    ];
  }

  protected onStart() {
    this.duration = 12;
  }

  protected onUpdate(dt: number) {
    if (!this.character || !this.patient.isAlive()) {
      this.fail();
      return;
    }

    // Heal patient over duration
    if (this.elapsedTime >= this.duration) {
      const healAmount = 30 + this.character.getEffectiveCompetency() * 20;
      this.patient.tStats.nHP = Math.min(
        this.patient.tStats.nMaxHP,
        this.patient.tStats.nHP + healAmount,
      );
      this.complete();
    }
  }
}
