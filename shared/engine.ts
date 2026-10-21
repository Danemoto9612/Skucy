// Punto de unión entre las acciones de dominio y el entorno donde corren.
// El backend (Edge Function de Supabase) registra su motor con `registerEngine`; la app móvil no ejecuta
// acciones de dominio (las pide a la API), por eso aquí no hay una implementación por defecto.
import type { Db } from './types';

export interface Engine {
  /** Estado actual; `sessionUserId` es el usuario que ejecuta la petición. */
  getState(): Db;
  /** Ejecuta `fn` sobre una copia del estado y confirma el cambio si no lanza error. */
  mutate<T>(fn: (draft: Db) => T): T;
}

let engine: Engine | null = null;

export function registerEngine(e: Engine) {
  engine = e;
}

function current(): Engine {
  if (!engine) throw new Error('El motor de dominio no está inicializado.');
  return engine;
}

export const getState = (): Db => current().getState();
export const mutate = <T>(fn: (draft: Db) => T): T => current().mutate(fn);

export function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
