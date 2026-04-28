type EventHandler<TPayload = unknown> = (payload: TPayload) => void;

export class EventBus<TEvents extends Record<string, unknown>> {
  listeners = new Map<keyof TEvents, EventHandler[]>();

  subscribe<TKey extends keyof TEvents>(
    eventName: TKey,
    handler: EventHandler<TEvents[TKey]>,
  ): void {
    let handlers = this.listeners.get(eventName);

    if (!handlers) {
      handlers = [];
      this.listeners.set(eventName, handlers);
    }

    handlers.push(handler as EventHandler);
  }

  publish<TKey extends keyof TEvents>(
    eventName: TKey,
    payload: TEvents[TKey],
  ): void {
    const handlers = this.listeners.get(eventName);

    if (!handlers) {
      return;
    }

    for (const handler of handlers) {
      handler(payload);
    }
  }
}
