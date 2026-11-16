import React, { useCallback, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * The busy rule (plan 12): while any server write runs, the control that started it shows its spinner and every other
 * button, field, switch and list row on the screen is disabled. Calls are counted, so two calls at once keep the screen
 * locked until the last one ends. A failsafe frees the screen if a call never reports back.
 *
 * The count lives in one store, so the API client (src/api.ts) can lock the screen for every write without each screen
 * asking. Buttons, fields (Field) and switches (BusySwitch) read it to look disabled; a transparent layer in BusyProvider
 * catches touches on everything else (rows, cards, tabs), so nothing can be tapped while a write runs.
 */
interface BusyValue {
  /** True while at least one server write runs. */
  busy: boolean;
  /** Marks a call as started; call the returned function when it ends (success or failure). */
  begin: () => () => void;
}

const FAILSAFE_MS = 60_000;

let count = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const snapshot = () => count > 0;

/** Starts a busy call; returns the function that ends it (safe to call twice). */
export function beginBusy(): () => void {
  let done = false;
  const end = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    count = Math.max(0, count - 1);
    emit();
  };
  const timer = setTimeout(end, FAILSAFE_MS);
  count += 1;
  emit();
  return end;
}

/** For tests: frees the screen whatever is still counted. */
export function resetBusy() {
  count = 0;
  emit();
}

/** Writes that must never lock the screen: the app talking to the server on its own, not because of a tap. */
export const BACKGROUND_WRITE = /^\/(devices|client-error|auth\/logout|ask\/action)(\/|$)/;

const value = (busy: boolean): BusyValue => ({ busy, begin: beginBusy });

/** Wraps the app: catches touches while a write runs so no row, card or tab can be tapped. */
export function BusyProvider({ children }: { children: React.ReactNode }) {
  const busy = useSyncExternalStore(subscribe, snapshot);
  return (
    <View style={styles.fill}>
      {children}
      {busy ? <View testID="busy-layer" style={styles.layer} /> : null}
    </View>
  );
}

export const useBusy = (): BusyValue => value(useSyncExternalStore(subscribe, snapshot));

/** For a control that is not a Button (a switch, a field, a row): true while another call runs, so it should be disabled. */
export const useBusyDisabled = () => useSyncExternalStore(subscribe, snapshot);

/** Wraps a server call so the whole screen is locked while it runs: `const run = useServerCall(); await run(() => api.save())`. */
export function useServerCall() {
  return useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    const end = beginBusy();
    try {
      return await fn();
    } finally {
      end();
    }
  }, []);
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  layer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, elevation: 1000 },
});
