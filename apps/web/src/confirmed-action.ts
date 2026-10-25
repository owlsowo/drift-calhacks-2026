// A reducer acknowledgement can be lost after its transaction commits. The
// sender's subscribed state is the authoritative completion signal.
export function confirmedAction<State, Result>({
  snapshot,
  subscribe,
  read,
  act,
  message,
  timeoutMs = 15000,
}: {
  snapshot: () => State;
  subscribe: (check: () => void) => () => void;
  read: (state: State) => Result | undefined;
  act: () => Promise<unknown>;
  message: string;
  timeoutMs?: number;
}): Promise<Result> {
  return new Promise((resolve, reject) => {
    let finished = false;
    let unsubscribe = () => {};
    const finish = (value: Result | undefined, error?: unknown) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      unsubscribe();
      if (error !== undefined) reject(error);
      else resolve(value!);
    };
    const check = () => {
      const value = read(snapshot());
      if (value !== undefined) finish(value);
    };
    const timer = setTimeout(() => {
      check();
      if (!finished) finish(undefined, Error(message));
    }, timeoutMs);
    unsubscribe = subscribe(check);
    if (finished) unsubscribe();
    else check();
    if (finished) return;
    try {
      void act().then(check, (error) => {
        check();
        if (!finished) finish(undefined, error);
      });
    } catch (error) {
      check();
      if (!finished) finish(undefined, error);
    }
  });
}
