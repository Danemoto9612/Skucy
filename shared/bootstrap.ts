// Estado inicial vacío. La app arranca sin datos de ejemplo: lo único que se crea al iniciar el
// servidor es la cuenta del administrador definida en las variables de entorno (ADMIN_EMAIL).
import type { Db, User } from './types';

export const DEFAULT_SETTINGS = { verificationThreshold: 1000, minFollowDaysToRate: 1 } as const;

export function emptyDb(): Db {
  return {
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
    settings: { ...DEFAULT_SETTINGS },
    sessionUserId: null,
  };
}

/** Cuenta de administrador: no pertenece a ninguna institución del catálogo. */
export function buildAdmin(db: Db, rawEmail: string, rawName?: string): User {
  const email = rawEmail.trim().toLowerCase();
  const local = email.split('@')[0] || 'admin';
  const base = local.replace(/[^a-z0-9]/g, '') || 'admin';
  let handle = base;
  let n = 1;
  while (db.users.some((u) => u.handle === handle)) handle = `${base}${n++}`;
  return {
    id: `u_admin_${Date.now().toString(36)}`,
    email,
    handle,
    name: rawName?.trim() || local,
    bio: '',
    institutionId: '',
    facultyId: '',
    degreeId: '',
    semester: 1,
    roles: ['VIEWER', 'ADMIN'],
    status: 'ACTIVE',
    communityIds: [],
    verifiedOverride: null,
    createdAt: new Date().toISOString(),
  };
}
