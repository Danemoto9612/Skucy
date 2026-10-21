// Réplica local de lo que el servidor permite ver al usuario actual (GET /sync).
// Las pantallas leen de aquí (síncrono) y las acciones llaman a la API y refrescan.
import { useSyncExternalStore } from 'react';
import type { Db } from '../../shared/types';
import { api, loadTokens, NetworkError, setSessionLostHandler } from '../api/client';

const emptyDb = (): Db => ({
  version: 1,
  institutions: [],
  faculties: [],
  degrees: [],
  subjects: [],
  communities: [],
  users: [],
  follows: [],
  contents: [],
  ratings: [],
  saved: [],
  views: [],
  reports: [],
  notifications: [],
  applications: [],
  institutionRequests: [],
  audit: [],
  settings: { verificationThreshold: 1000, minFollowDaysToRate: 1 },
  sessionUserId: null,
});

export type ConnectionStatus = 'loading' | 'ready' | 'offline';

interface Snapshot {
  db: Db;
  status: ConnectionStatus;
  error: string;
}

let snapshot: Snapshot = { db: emptyDb(), status: 'loading', error: '' };
const listeners = new Set<() => void>();

function set(next: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function getState(): Db {
  return snapshot.db;
}

export function useDb(): Db {
  return useSyncExternalStore(subscribe, () => snapshot.db, () => snapshot.db);
}

export function useConnection(): { status: ConnectionStatus; error: string } {
  const s = useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
  return { status: s.status, error: s.error };
}

/** Descarga el snapshot del servidor. Devuelve false si no hubo conexión. */
export async function refresh(): Promise<boolean> {
  try {
    const db = await api.get<Db>('/sync');
    set({ db, status: 'ready', error: '' });
    return true;
  } catch (e) {
    if (snapshot.status === 'ready' && !(e instanceof NetworkError)) return false;
    set({
      status: snapshot.status === 'ready' ? 'ready' : 'offline',
      error: e instanceof Error ? e.message : 'Error desconocido',
    });
    return false;
  }
}

/** Arranque: carga los tokens guardados y la primera réplica de datos. */
export async function hydrate(): Promise<void> {
  setSessionLostHandler(() => {
    refresh();
  });
  await loadTokens();
  set({ status: 'loading', error: '' });
  await refresh();
}
