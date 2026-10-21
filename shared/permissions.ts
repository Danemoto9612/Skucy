// RBAC con permisos granulares. Los roles son acumulativos (no excluyentes).
import type { RoleName, User } from './types';

export type Permission =
  | 'content:read_public'
  | 'profile:edit_own'
  | 'follow:manage'
  | 'community:join'
  | 'content:save'
  | 'rating:create'
  | 'report:create'
  | 'notification:read'
  | 'creator:apply'
  | 'content:create'
  | 'content:submit'
  | 'moderation:content'
  | 'moderation:creator_apps'
  | 'moderation:reports'
  | 'moderation:institution_requests'
  | 'moderation:suspend_user'
  | 'moderation:hide_rating'
  | 'admin:users'
  | 'admin:roles'
  | 'admin:settings'
  | 'admin:audit'
  | 'admin:verification'
  | 'admin:catalog';

const ANONYMOUS: Permission[] = ['content:read_public'];

const VIEWER: Permission[] = [
  ...ANONYMOUS,
  'profile:edit_own',
  'follow:manage',
  'community:join',
  'content:save',
  'rating:create',
  'report:create',
  'notification:read',
  'creator:apply',
];

const CREATOR: Permission[] = [...VIEWER, 'content:create', 'content:submit'];

const MODERATOR: Permission[] = [
  'moderation:content',
  'moderation:creator_apps',
  'moderation:reports',
  'moderation:institution_requests',
  'moderation:suspend_user',
  'moderation:hide_rating',
];

const ADMIN: Permission[] = [
  ...MODERATOR,
  'admin:users',
  'admin:roles',
  'admin:settings',
  'admin:audit',
  'admin:verification',
  'admin:catalog',
];

export const ROLE_PERMISSIONS: Record<RoleName | 'ANONYMOUS', Permission[]> = {
  ANONYMOUS,
  VIEWER,
  CREATOR,
  MODERATOR,
  ADMIN,
};

export const ROLE_LABEL: Record<RoleName | 'ANONYMOUS', string> = {
  ANONYMOUS: 'Anónimo',
  VIEWER: 'Viewer',
  CREATOR: 'Creator',
  MODERATOR: 'Moderador',
  ADMIN: 'Administrador',
};

export function permissionsOf(user: Pick<User, 'roles' | 'status'> | null): Set<Permission> {
  if (!user) return new Set(ROLE_PERMISSIONS.ANONYMOUS);
  const set = new Set<Permission>();
  for (const role of user.roles) {
    for (const p of ROLE_PERMISSIONS[role]) set.add(p);
  }
  // Un usuario suspendido/baneado conserva solo lectura pública.
  if (user.status !== 'ACTIVE') {
    return new Set<Permission>(['content:read_public', 'notification:read']);
  }
  return set;
}

export function can(user: Pick<User, 'roles' | 'status'> | null, permission: Permission): boolean {
  return permissionsOf(user).has(permission);
}

export function hasRole(user: Pick<User, 'roles'> | null, role: RoleName): boolean {
  return !!user && user.roles.includes(role);
}
