/**
 * FitnessZone.ts — Fitness zone subclass.
 * Mirrors Zones/FitnessZone.lua: workout activities.
 */

import { Zone } from './Zone';
import { ZoneType } from '../world/ZoneType';

export class FitnessZone extends Zone {
  constructor() {
    super(ZoneType.FITNESS);
  }

  protected generateUniqueName(): string {
    const figures = [
      'Hercules', 'Atlas', 'Ares', 'Apollo', 'Thor',
      'Athena', 'Diana', 'Valkyrie', 'Titan', 'Spartan',
    ];
    return `Fitness Zone ${figures[Math.floor(Math.random() * figures.length)]}`;
  }
}
