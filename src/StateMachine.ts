type StateDefinition<TState extends string> = {
  name: TState;
  onEnter?: () => void;
  onExit?: () => void;
  update?: (delta: number) => void;
};

export class StateMachine<TState extends string> {
  states = new Map<TState, StateDefinition<TState>>();
  currentStateName?: TState;

  addState(state: StateDefinition<TState>): this {
    this.states.set(state.name, state);
    return this;
  }

  setState(nextStateName: TState): void {
    if (this.currentStateName === nextStateName) { // if its the same state, dont bother changing state
      return;
    }
    const nextState = this.states.get(nextStateName);

    if (!nextState) {
      throw new Error(`Unknown state: ${nextStateName}`);
    }
    this.currentState?.onExit?.();

    this.currentStateName = nextStateName; // changes to newstate name and enters it
    nextState.onEnter?.();
  }

  update(delta: number): void {
    this.currentState?.update?.(delta);
  }

  get currentState(): StateDefinition<TState> | undefined { // returns the full state obj
    if (!this.currentStateName) {
      return undefined;
    }

    return this.states.get(this.currentStateName);
  }

  get current(): TState | undefined { // only used for the state name
    return this.currentStateName;
  }
}
