/**
 * BuildEnvObject.ts — Build ghost/queued environment objects.
 * Character walks to an unbuilt object and constructs it.
 */

import { Task, type NeedAdvertisement } from '../Task';
import { CommandQueue } from '../../core/CommandQueue';
import { Base } from '../../core/Base';
import type { EnvObject } from '../../envobjects/EnvObject';

export class BuildEnvObject extends Task {
  readonly name = 'BuildEnvObject';
  private targetObj: EnvObject;
  private commandId: number;

  constructor(targetObj: EnvObject, commandId: number) {
    super();
    this.targetObj = targetObj;
    this.commandId = commandId;
  }

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [{ need: 'duty', amount: 25 }];
  }

  protected onStart() {
    this.duration = 10;

    // Verify object is still unbuilt
    if (this.targetObj.bBuilt) {
      CommandQueue.complete(this.commandId);
      this.fail();
      return;
    }

    // Claim the command
    if (this.character) {
      if (!CommandQueue.claim(this.commandId, this.character.id)) {
        this.fail();
        return;
      }
    }
  }

  protected onUpdate(dt: number) {
    if (this.elapsedTime >= this.duration) {
      this.complete();
    }
  }

  protected onComplete() {
    super.onComplete(); // Satisfy needs

    // Build the object
    this.targetObj.markBuilt();
    if (this.character) {
      this.targetObj.sBuilderName = this.character.getName();
    }
    CommandQueue.complete(this.commandId);

    Base.addAlert('build', `${this.character?.getName() ?? 'Builder'} built ${this.targetObj.tData.friendlyName}`);
  }
}
