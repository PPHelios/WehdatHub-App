import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

/**
 * The busy rule (plan 12): while any server call runs, the control that started it shows its spinner and every other
 * button, field, switch and list row on the screen is disabled. Calls are counted, so two calls at once keep the screen
 * locked until the last one ends. A failsafe frees the screen if a call never reports back.
 */
interface BusyValue {
  /** True while at least one server call runs. */
  busy: boolean;
  /** Marks a call as started; call the returned function when it ends (success or failure). */
  begin: () => () => void;
}

const FAILSAFE_MS = 60_000;
const Ctx = createContext<BusyValue>({ busy: false, begin: () => () => undefined });

export function BusyProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  const begin = useCallback(() => {
    let done = false;
    const end = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (alive.current) setCount((c) => Math.max(0, c - 1));
    };
    const timer = setTimeout(end, FAILSAFE_MS);
    setCount((c) => c + 1);
    return end;
  }, []);
  const value = useMemo(() => ({ busy: count > 0, begin }), [count, begin]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useBusy = () => useContext(Ctx);

/** For a control that is not a Button (a switch, a field, a row): true while another call runs, so it should be disabled. */
export const useBusyDisabled = () => useContext(Ctx).busy;

/** Wraps a server call so the whole screen is locked while it runs: `const run = useServerCall(); await run(() => api.save())`. */
export function useServerCall() {
  const { begin } = useBusy();
  return useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    const end = begin();
    try {
      return await fn();
    } finally {
      end();
    }
  }, [begin]);
}
