/**
 * CircleBeacon.ts — Security squad responds to emergency beacon.
 * Mirrors Lua Utility/Tasks/CircleBeacon.lua.
 *
 * Character runs to beacon location, then patrols nearby for DURATION seconds.
 * Checks if beacon is still active; abandons task if removed.
 */

import { Task, type NeedAdvertisement } from '../Task';
import { EmergencyBeacon, MODE_TRAVELTO } from '../../combat/EmergencyBeacon';
import { SquadList } from '../../combat/SquadList';

export class CircleBeacon extends Task {
  readonly name = 'CircleBeacon';
  nJobExperience = 0;

  /** Lua: CircleBeacon.DURATION = 200 */
  static readonly DURATION = 200;

  private bGoingToBeacon = true;
  private nIdleTime = 0;
  private squadName = '';

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [
      { need: 'duty', amount: 10 },
    ];
  }

  protected onStart() {
    // Duration with ±10% randomization (Lua: randomFloat(0.9*DURATION, 1.1*DURATION))
    this.duration = CircleBeacon.DURATION * (0.9 + Math.random() * 0.2);
    this.bGoingToBeacon = true;

    // Find squad name for this character
    if (this.character) {
      const squad = SquadList.getSquadForChar(this.character.id);
      if (squad) {
        this.squadName = squad.name;
        EmergencyBeacon.charResponded(this.character.id, this.squadName);
      }
    }
  }

  protected onUpdate(dt: number) {
    if (!this.character) { this.fail(); return; }

    // Check if beacon is still active
    const beacon = EmergencyBeacon.getBeacon(this.squadName);
    if (!beacon) {
      this.complete();
      return;
    }

    if (this.bGoingToBeacon) {
      // Phase 1: Walk to beacon
      if (!this.character.moving && this.character.path.length === 0) {
        // Arrived at beacon
        this.bGoingToBeacon = false;
        EmergencyBeacon.charArrived(this.character.id, this.squadName);
        this.nIdleTime = 0.5 + Math.random();
      }
    } else {
      // Phase 2: Patrol near beacon
      this.duration -= dt;
      if (this.duration <= 0) {
        EmergencyBeacon.charAbandoned(this.character.id, this.squadName);
        this.complete();
        return;
      }

      // Idle briefly, then walk to random nearby point
      if (this.nIdleTime > 0) {
        this.nIdleTime -= dt;
      } else if (!this.character.moving && this.character.path.length === 0) {
        this.nIdleTime = 0.5 + Math.random();
      }
    }
  }
}
