// Estado por petición. Cada petición:
//   1) carga TODA la base con una sola llamada (skucy_load_all),
//   2) ejecuta las acciones de dominio en memoria sobre esa copia,
//   3) al terminar guarda solo las filas que cambiaron con una sola transacción (skucy_apply).
// Si el guardado falla, la petición responde 503 y no queda nada a medias.
import { AsyncLocalStorage } from 'node:async_hooks';
import { emptyDb } from '../../shared/bootstrap';
import { registerEngine } from '../../shared/engine';
import type { Db } from '../../shared/types';
import { ConflictError, type Backend, type Row, type TableChanges } from './backend';
import { COLLECTIONS, SETTINGS_ID, SETTINGS_TABLE, type CollectionDef, type ServerDb } from './collections';

export type { ServerDb } from './collections';

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  familyId: string;
  hash: string;
  expiresAt: string;
  revokedAt?: string;
}

export class StorageWriteError extends Error {}

interface Ctx {
  actorId: string | null;
  state: ServerDb;
  /** Lo que la base de datos tenía al cargar: tabla → (id → JSON de la fila). */
  loaded: Map<string, Map<string, string>>;
}

const als = new AsyncLocalStorage<Ctx>();

function ctx(): Ctx {
  const c = als.getStore();
  if (!c) throw new Error('No hay una petición en curso.');
  return c;
}

const items = (db: ServerDb, def: CollectionDef): any[] => db[def.key] as any[];

function rowsOf(db: ServerDb): { table: string; rows: Map<string, { json: string; data: unknown }> }[] {
  const out = COLLECTIONS.map((def) => {
    const rows = new Map<string, { json: string; data: unknown }>();
    for (const item of items(db, def)) rows.set(def.id(item), { json: JSON.stringify(item), data: item });
    return { table: def.table, rows };
  });
  out.push({
    table: SETTINGS_TABLE,
    rows: new Map([[SETTINGS_ID, { json: JSON.stringify(db.settings), data: db.settings }]]),
  });
  return out;
}

function toIndex(db: ServerDb): Map<string, Map<string, string>> {
  const index = new Map<string, Map<string, string>>();
  for (const { table, rows } of rowsOf(db)) {
    index.set(table, new Map(Array.from(rows.entries()).map(([id, r]) => [id, r.json])));
  }
  return index;
}

/** Filas nuevas, modificadas o eliminadas respecto a lo que se cargó. */
export function diffAgainst(index: Map<string, Map<string, string>>, db: ServerDb): TableChanges[] {
  const changes: TableChanges[] = [];
  for (const { table, rows } of rowsOf(db)) {
    const before = index.get(table) ?? new Map<string, string>();
    const upserts: Row[] = [];
    for (const [id, r] of rows) {
      if (before.get(id) !== r.json) upserts.push({ id, data: r.data });
    }
    const deletes = Array.from(before.keys()).filter((id) => !rows.has(id));
    if (upserts.length || deletes.length) changes.push({ table, upserts, deletes });
  }
  return changes;
}

function buildState(data: Record<string, unknown[]>): ServerDb {
  const db: ServerDb = { ...emptyDb(), refreshTokens: [] };
  for (const def of COLLECTIONS) {
    const list = [...((data[def.table] ?? []) as any[])];
    if (def.sort) {
      const { field, dir } = def.sort;
      list.sort((a, b) => {
        const cmp = String(a[field] ?? '').localeCompare(String(b[field] ?? ''));
        return dir === 'asc' ? cmp : -cmp;
      });
    }
    (db as any)[def.key] = list;
  }
  const settings = (data[SETTINGS_TABLE] ?? [])[0];
  if (settings) db.settings = { ...db.settings, ...(settings as object) };
  return db;
}

/** Objetos de una tabla tal como se guardan en la base (para refrescar la caché tras escribir). */
function rawTable(db: ServerDb, table: string): unknown[] {
  if (table === SETTINGS_TABLE) return [db.settings];
  const def = COLLECTIONS.find((c) => c.table === table)!;
  return items(db, def);
}

// ───────────── caché por instancia ─────────────
// Cada tabla tiene un número de versión en la base. En cada petición se pregunta (1 sola llamada, muy liviana)
// qué versiones cambiaron y se descargan SOLO esas tablas; si nada cambió no se descarga ningún dato.
interface Cache {
  versions: Record<string, number>;
  tables: Record<string, unknown[]>;
  state?: ServerDb;
  index?: Map<string, Map<string, string>>;
}

const caches = new WeakMap<Backend, Cache>();
const MAX_ATTEMPTS = 4;

async function loadState(backend: Backend) {
  let cache = caches.get(backend);
  if (!cache) {
    cache = { versions: {}, tables: {} };
    caches.set(backend, cache);
  }
  const res = await backend.loadChanged(cache.versions);
  const changed = Object.keys(res.tables);
  for (const t of changed) cache.tables[t] = res.tables[t];
  cache.versions = res.versions;
  if (!cache.state || !cache.index || changed.length) {
    cache.state = buildState(cache.tables);
    cache.index = toIndex(cache.state);
  }
  // El estado en caché es de solo lectura: las acciones siempre trabajan sobre una copia (mutateServer).
  return { cache, state: cache.state, index: cache.index, versions: res.versions };
}

/**
 * Ejecuta una petición: sincroniza la caché, corre `fn` y guarda solo las filas que cambiaron en una transacción.
 * Si otra petición cambió las mismas tablas mientras tanto (conflicto de versión), repite la petición desde cero.
 */
export async function runRequest<T>(
  backend: Backend,
  fn: (setActor: (id: string | null) => void) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const { cache, state, index, versions } = await loadState(backend);
    const context: Ctx = { actorId: null, state, loaded: index };
    const outcome = await als.run(context, async () => {
      let result: T | undefined;
      let failure: unknown;
      let failed = false;
      try {
        result = await fn((id) => {
          context.actorId = id;
        });
      } catch (e) {
        failed = true;
        failure = e;
      }
      return { result, failure, failed };
    });

    // Lo que sí se alcanzó a cambiar se guarda aunque la petición termine en error de negocio
    // (por ejemplo, revocar una sesión comprometida o contar un intento fallido, y luego responder 401).
    const changes = diffAgainst(index, context.state);
    if (changes.length) {
      const expected: Record<string, number> = {};
      for (const c of changes) expected[c.table] = versions[c.table] ?? 0;
      try {
        const updated = await backend.apply(changes, expected);
        for (const c of changes) {
          cache.tables[c.table] = rawTable(context.state, c.table);
          cache.versions[c.table] = updated[c.table];
        }
        cache.state = undefined; // se reconstruye desde las tablas en la próxima petición
        cache.index = undefined;
      } catch (e) {
        if (e instanceof ConflictError && attempt < MAX_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, 20 * attempt + Math.random() * 40));
          continue;
        }
        const reason =
          e instanceof ConflictError ? 'hay demasiada actividad simultánea, intenta de nuevo' : e instanceof Error ? e.message : String(e);
        throw new StorageWriteError(`No se pudo guardar en Supabase: ${reason}`);
      }
    }
    if (outcome.failed) throw outcome.failure;
    return outcome.result as T;
  }
}

// ───────────── acceso al estado (lo usan las acciones de dominio y los servicios) ─────────────

export const currentActorId = (): string | null => ctx().actorId;
export const readRaw = (): ServerDb => ctx().state;

function getState(): Db {
  const c = ctx();
  // Copia superficial: las acciones de lectura no deben mutarla.
  return { ...c.state, sessionUserId: c.actorId };
}

export function mutateServer<T>(fn: (draft: ServerDb) => T): T {
  const c = ctx();
  const draft: ServerDb = JSON.parse(JSON.stringify(c.state));
  draft.sessionUserId = c.actorId;
  const result = fn(draft);
  draft.sessionUserId = null;
  c.state = draft; // solo si `fn` no lanzó error: atomicidad por acción
  return result;
}

registerEngine({ getState, mutate: mutateServer as <T>(fn: (d: Db) => T) => T });
