/**
 * Scene state machine replacing Phaser's Scene system.
 * States: Boot → StartMenu → NewGame → Game
 */
export interface SceneState {
  enter(context: SceneContext): void;
  update(dt: number): void;
  exit(): void;
}

export interface SceneContext {
  container: HTMLElement;
  switchTo(state: SceneState, data?: Record<string, unknown>): void;
}

export class SceneManager implements SceneContext {
  container: HTMLElement;
  private currentState: SceneState | null = null;
  private stateData: Record<string, unknown> = {};

  constructor(container: HTMLElement) {
    this.container = container;
  }

  switchTo(state: SceneState, data?: Record<string, unknown>) {
    if (this.currentState) {
      this.currentState.exit();
    }
    this.stateData = data ?? {};
    this.currentState = state;
    state.enter(this);
  }

  getData(): Record<string, unknown> {
    return this.stateData;
  }

  update(dt: number) {
    this.currentState?.update(dt);
  }
}
