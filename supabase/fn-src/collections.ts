// Registro de las "colecciones" del dominio y la tabla de Supabase donde se guarda cada una
// (ver supabase/schema.sql). El dominio trabaja con objetos; la base guarda cada objeto como una fila (id, data jsonb).
import type { Db } from '../../shared/types';
import type { RefreshTokenRecord } from './runtime';

export type ServerDb = Db & { refreshTokens: RefreshTokenRecord[] };

export type CollectionKey = Exclude<
  keyof ServerDb,
  'version' | 'settings' | 'sessionUserId' | 'derived'
>;

export interface CollectionDef {
  key: CollectionKey;
  table: string;
  id: (item: any) => string;
  /** Orden al cargar (las listas del dominio se mantienen "más nuevo primero" con unshift). */
  sort?: { field: string; dir: 'asc' | 'desc' };
}

const byId = (item: { id: string }) => item.id;

export const COLLECTIONS: CollectionDef[] = [
  { key: 'institutions', table: 'institutions', id: byId },
  { key: 'faculties', table: 'faculties', id: byId },
  { key: 'degrees', table: 'degrees', id: byId },
  { key: 'subjects', table: 'subjects', id: byId },
  { key: 'communities', table: 'communities', id: byId },
  { key: 'users', table: 'users', id: byId, sort: { field: 'createdAt', dir: 'asc' } },
  { key: 'follows', table: 'follows', id: (f) => `${f.followerId}:${f.followingId}`, sort: { field: 'createdAt', dir: 'asc' } },
  { key: 'contents', table: 'contents', id: byId, sort: { field: 'createdAt', dir: 'desc' } },
  { key: 'ratings', table: 'ratings', id: byId, sort: { field: 'createdAt', dir: 'asc' } },
  { key: 'saved', table: 'saved', id: (s) => `${s.userId}:${s.contentId}` },
  { key: 'views', table: 'views', id: (v) => `${v.userId}:${v.contentId}`, sort: { field: 'at', dir: 'asc' } },
  { key: 'reports', table: 'reports', id: byId, sort: { field: 'createdAt', dir: 'desc' } },
  { key: 'notifications', table: 'notifications', id: byId, sort: { field: 'createdAt', dir: 'desc' } },
  { key: 'applications', table: 'applications', id: byId, sort: { field: 'createdAt', dir: 'asc' } },
  { key: 'institutionRequests', table: 'institution_requests', id: byId, sort: { field: 'createdAt', dir: 'desc' } },
  { key: 'audit', table: 'audit_logs', id: byId, sort: { field: 'at', dir: 'desc' } },
  { key: 'refreshTokens', table: 'refresh_tokens', id: byId },
];

/** La configuración global es una sola fila. */
export const SETTINGS_TABLE = 'app_settings';
export const SETTINGS_ID = 'global';

export const ALL_TABLES = [...COLLECTIONS.map((c) => c.table), SETTINGS_TABLE];
