/**
 * FieldScanAndHeal.ts — Doctor scans and heals a wounded character.
 * Mirrors Activities/FieldScanAndHeal.lua.
 */

import { Task, type NeedAdvertisement } from '../Task';
import type { Character } from '../../characters/Character';
import { HEAL_RATE, STARTING_HIT_POINTS } from '../../characters/CharacterConstants';
import { Malady } from '../../malady/Malady';

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

  protected onUpdate(_dt: number) {
    if (this.elapsedTime >= this.duration) {
      if (this.patient.isAlive()) {
        // Heal HP
        const healAmount = STARTING_HIT_POINTS * HEAL_RATE * this.duration;
        this.patient.tStats.nHP = Math.min(
          this.patient.tStats.nMaxHP,
          this.patient.tStats.nHP + healAmount,
        );
        // M-2: Diagnose undiagnosed maladies (Lua FieldScanAndHeal._performScanOn)
        let undiagnosed = Malady.getNextUndiagnosedMalady(this.patient);
        while (undiagnosed) {
          Malady.diagnoseMalady(undiagnosed);
          undiagnosed = Malady.getNextUndiagnosedMalady(this.patient);
        }
        // M-2: Cure the next curable malady (Lua: rPatient:cure via getNextCurableMalady)
        const skillLevel = this.character?.getEffectiveCompetency() ?? 0;
        const curable = Malady.getNextCurableMalady(this.patient, skillLevel);
        if (curable) {
          Malady.cureMalady(this.patient, curable);
        }
      }
      this.complete();
    }
  }
}
