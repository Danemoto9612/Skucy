// Almacenamiento de filas. Producción: Supabase (2 llamadas RPC por petición). Pruebas: memoria.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './http';
import { ALL_TABLES } from './collections';

export interface Row {
  id: string;
  data: unknown;
}

export interface TableChanges {
  table: string;
  upserts: Row[];
  deletes: string[];
}

/** Otra petición modificó las mismas tablas entre la carga y el guardado: hay que repetir la petición. */
export class ConflictError extends Error {}

export interface LoadResult {
  /** Versión actual de cada tabla (sube en 1 con cada escritura). */
  versions: Record<string, number>;
  /** Solo las tablas cuya versión es distinta a la que la función ya tiene en caché. */
  tables: Record<string, unknown[]>;
}

export interface Backend {
  /** Carga incremental: devuelve las versiones y SOLO las tablas que cambiaron respecto a `known`. */
  loadChanged(known: Record<string, number>): Promise<LoadResult>;
  /** Aplica los cambios en UNA transacción si las tablas siguen en la versión `expected`; devuelve las nuevas versiones. */
  apply(changes: TableChanges[], expected: Record<string, number>): Promise<Record<string, number>>;
}

function explain(error: { message: string; code?: string }): Error {
  if (error.code === 'PGRST202' || /Could not find the function|does not exist/i.test(error.message)) {
    return new Error('Faltan las funciones de la base de datos (o están desactualizadas). Ejecuta supabase/schema.sql en el SQL Editor.');
  }
  if (/invalid api key|jwt/i.test(error.message)) {
    return new Error('Supabase rechazó la clave del servidor (SUPABASE_SERVICE_ROLE_KEY).');
  }
  return new Error(`Supabase: ${error.message}`);
}

let cached: SupabaseClient | null = null;

/** Cliente con permisos de servicio (nunca sale de la Edge Function). */
export function supabaseClient(): SupabaseClient {
  if (cached) return cached;
  const url = env('SUPABASE_URL');
  const key = env('SKUCY_SECRET_KEY') ?? env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en la función.');
  cached = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return cached;
}

export class SupabaseBackend implements Backend {
  constructor(private readonly client: SupabaseClient = supabaseClient()) {}

  async loadChanged(known: Record<string, number>): Promise<LoadResult> {
    const { data, error } = await this.client.rpc('skucy_load_changed', { known });
    if (error) throw explain(error);
    const result = (data ?? {}) as Partial<LoadResult>;
    return { versions: result.versions ?? {}, tables: result.tables ?? {} };
  }

  async apply(changes: TableChanges[], expected: Record<string, number>): Promise<Record<string, number>> {
    const { data, error } = await this.client.rpc('skucy_apply', { changes, expected });
    if (error) {
      if (error.code === '40001' || /SKUCY_CONFLICT/.test(error.message)) throw new ConflictError(error.message);
      throw explain(error);
    }
    return (data ?? {}) as Record<string, number>;
  }
}

/** Implementación en memoria (pruebas automáticas): imita las funciones SQL, incluidas las versiones por tabla. */
export class MemoryBackend implements Backend {
  readonly tables = new Map<string, Map<string, unknown>>();
  readonly versions: Record<string, number> = Object.fromEntries(ALL_TABLES.map((t) => [t, 0]));
  failNextApply = false;
  /** Fuerza que la próxima escritura choque con "otra petición" (para probar los reintentos). */
  conflictNextApply = 0;
  applyCalls = 0;
  loadCalls = 0;
  /** Tablas transferidas en total (mide cuánto se descarga). */
  tablesTransferred = 0;

  async loadChanged(known: Record<string, number>): Promise<LoadResult> {
    this.loadCalls++;
    const tables: Record<string, unknown[]> = {};
    for (const t of ALL_TABLES) {
      if (known[t] !== this.versions[t]) {
        tables[t] = Array.from(this.tables.get(t)?.values() ?? []).map((d) => JSON.parse(JSON.stringify(d)));
        this.tablesTransferred++;
      }
    }
    return { versions: { ...this.versions }, tables };
  }

  async apply(changes: TableChanges[], expected: Record<string, number>): Promise<Record<string, number>> {
    this.applyCalls++;
    if (this.failNextApply) {
      this.failNextApply = false;
      throw new Error('fallo simulado');
    }
    if (this.conflictNextApply > 0) {
      this.conflictNextApply--;
      this.versions[changes[0].table]++; // "otra petición" escribió primero
    }
    for (const c of changes) {
      if (expected[c.table] !== this.versions[c.table]) throw new ConflictError(`SKUCY_CONFLICT: ${c.table}`);
    }
    const out: Record<string, number> = {};
    for (const c of changes) {
      const t = this.tables.get(c.table) ?? new Map<string, unknown>();
      this.tables.set(c.table, t);
      for (const r of c.upserts) t.set(r.id, JSON.parse(JSON.stringify(r.data)));
      for (const id of c.deletes) t.delete(id);
      out[c.table] = ++this.versions[c.table];
    }
    return out;
  }
}
