// Estado de UI efímero: modo invitado (anónimo explorando contenido público).
import { useSyncExternalStore } from 'react';

let guest = false;
const listeners = new Set<() => void>();

export function setGuest(value: boolean) {
  guest = value;
  listeners.forEach((l) => l());
}

export function useGuest(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => guest,
    () => guest,
  );
}
