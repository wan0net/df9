/**
 * HospitalZone.ts — Infirmary zone subclass.
 * Mirrors Zones/HospitalZone.lua: doctor tracking.
 */

import { Zone } from './Zone';
import { ZoneType } from '../world/ZoneType';

export class HospitalZone extends Zone {
  private doctors: Set<number> = new Set();

  constructor() {
    super(ZoneType.INFIRMARY);
  }

  protected generateUniqueName(): string {
    const constellations = [
      'Orion', 'Lyra', 'Aquila', 'Cygnus', 'Draco', 'Hydra',
      'Phoenix', 'Centaurus', 'Pegasus', 'Andromeda', 'Cassiopeia',
    ];
    return `Infirmary ${constellations[Math.floor(Math.random() * constellations.length)]}`;
  }

  addDoctor(charId: number) {
    this.doctors.add(charId);
  }

  removeDoctor(charId: number) {
    this.doctors.delete(charId);
  }

  doctorsOnDuty(): number {
    return this.doctors.size;
  }

  hasDoctors(): boolean {
    return this.doctors.size > 0;
  }
}
