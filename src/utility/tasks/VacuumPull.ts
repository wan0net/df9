import { Task, type NeedAdvertisement } from '../Task';

const VACUUM_PULL_DURATION = 3;
const VACUUM_PULL_SPEED = 40;

export class VacuumPull extends Task {
  readonly name = 'VacuumPull';
  nJobExperience = 0;
  vacuumMagnitude = 0;

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [];
  }

  protected onStart() {
    this.duration = VACUUM_PULL_DURATION;
  }

  protected onUpdate(dt: number) {
    if (!this.character) { this.fail(); return; }

    if (this.vacuumMagnitude > 0) {
      const scale = Math.min(1, this.vacuumMagnitude / 100) * VACUUM_PULL_SPEED;
      this.character.screenX += (this.targetX - this.character.tileX) * scale * dt;
      this.character.screenY += (this.targetY - this.character.tileY) * scale * dt;
    }

    if (this.elapsedTime >= this.duration) {
      this.complete();
    }
  }
}
