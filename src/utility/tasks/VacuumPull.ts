import { Task, type NeedAdvertisement } from '../Task';
import { screenToTile } from '../../world/IsometricUtils';

const MAX_VEL = 100;
const VEL_SCALAR = 6;
const MIN_VEL = 6;

export class VacuumPull extends Task {
  readonly name = 'VacuumPull';
  nJobExperience = 0;
  vacuumVx = 0;
  vacuumVy = 0;
  vacuumMagnitude = 0;

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [];
  }

  protected onStart() {
    this.duration = 9999 * 5;
    if (this.character) {
      this.character.moving = false;
      this.character.path = [];
    }
  }

  protected onUpdate(dt: number) {
    if (!this.character) { this.fail(); return; }
    if (this.vacuumMagnitude < MIN_VEL) { this.complete(); return; }

    const mag = Math.min(this.vacuumMagnitude, MAX_VEL);
    this.character.screenX += this.vacuumVx * VEL_SCALAR * dt;
    this.character.screenY += this.vacuumVy * VEL_SCALAR * dt;

    const nextTile = screenToTile(this.character.screenX, this.character.screenY);
    this.character.tileX = nextTile.x;
    this.character.tileY = nextTile.y;

    if (mag < MIN_VEL || this.elapsedTime >= this.duration) {
      this.complete();
    }
  }
}
