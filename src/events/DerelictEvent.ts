import { Event } from './Event';

export class DerelictEvent extends Event {
  readonly name = 'Derelict';
  readonly description: string;

  private started = false;
  private resolved = false;
  private readonly onBeginExplore: () => void;

  constructor(onBeginExplore: () => void, description = 'A derelict ship has been detected nearby') {
    super();
    this.onBeginExplore = onBeginExplore;
    this.description = description;
  }

  protected onUpdate(_dt: number) {
    if (this.started) return;
    this.started = true;
    this.onBeginExplore();
  }

  resolve() {
    if (this.resolved) return;
    this.resolved = true;
    this.complete();
  }
}
