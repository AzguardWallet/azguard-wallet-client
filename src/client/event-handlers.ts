export interface IEventHandlers<T> {
    addHandler(handler: (payload: T) => void): void;
    removeHandler(handler: (payload: T) => void): void;
}

export class EventHandlers<T> implements IEventHandlers<T> {
    #handlers: Set<(payload: T) => void> = new Set();

    public addHandler(handler: (payload: T) => void) {
        this.#handlers.add(handler);
    }

    public removeHandler(handler: (payload: T) => void) {
        this.#handlers.delete(handler);
    }

    public dispatch(payload: T) {
        for (const handler of this.#handlers) {
            try { handler(payload); } catch {}
        }
    }
}
