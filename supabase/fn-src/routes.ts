// Tabla de rutas de la API (equivale a los controladores del antiguo backend NestJS).
import type { SupabaseClient } from '@supabase/supabase-js';
import * as A from '../../shared/actions';
import { getState } from '../../shared/engine';
import { can, type Permission } from '../../shared/permissions';
import { sessionUser } from '../../shared/selectors';
import * as auth from './auth';
import { HttpError } from './http';
import * as media from './media';
import { microsoftConfig } from './microsoft';
import { readRaw } from './runtime';
import { snapshot } from './sync';

export interface RouteCtx {
  params: Record<string, string>;
  body: any;
  client: () => SupabaseClient;
}

/** undefined = público · [] = basta con tener sesión · [...] = sesión + TODOS los permisos. */
type Access = Permission[] | undefined;

export interface Route {
  method: string;
  pattern: RegExp;
  keys: string[];
  access: Access;
  run: (c: RouteCtx) => unknown | Promise<unknown>;
}

const routes: Route[] = [];

function add(method: string, path: string, access: Access, run: Route['run']) {
  const keys: string[] = [];
  const source = path.replace(/:([A-Za-z]+)/g, (_m, k: string) => {
    keys.push(k);
    return '([^/]+)';
  });
  routes.push({ method, pattern: new RegExp(`^${source}$`), keys, access, run });
}

const ok = () => ({ ok: true });
const noPerm = (): Permission[] => [];

export function findRoute(method: string, path: string): { route: Route; params: Record<string, string> } | 'method' | null {
  let pathMatched = false;
  for (const route of routes) {
    const m = route.pattern.exec(path);
    if (!m) continue;
    pathMatched = true;
    if (route.method !== method) continue;
    const params: Record<string, string> = {};
    route.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
    return { route, params };
  }
  return pathMatched ? 'method' : null;
}

/** Equivalente al AccessGuard: exige sesión y permisos. */
export function authorize(route: Route) {
  if (!route.access) return;
  const user = sessionUser(getState());
  if (!user) throw new HttpError(401, 'Debes iniciar sesión para hacer esto.');
  for (const permission of route.access) {
    if (!can(user, permission)) throw new HttpError(403, 'No tienes permiso para realizar esta acción.');
  }
}

// ───────── sistema, lectura y autenticación ─────────
add('GET', '/sync', undefined, () => snapshot());

add('GET', '/auth/microsoft/config', undefined, () => microsoftConfig());
add('POST', '/auth/microsoft', undefined, (c) => auth.microsoftLogin(c.body ?? {}));
add('POST', '/auth/login', undefined, (c) => auth.passwordLogin(c.body ?? {}));
add('POST', '/auth/register/start', undefined, (c) => auth.registerStart(c.body ?? {}));
add('POST', '/auth/register', undefined, (c) => auth.register(c.body ?? {}));
add('POST', '/auth/refresh', undefined, (c) => auth.refresh(c.body?.refreshToken ?? ''));
add('POST', '/auth/logout', undefined, (c) => {
  auth.logout(c.body?.refreshToken ?? '');
  return ok();
});
add('GET', '/auth/me', noPerm(), () => auth.me());

// ───────── perfil y social ─────────
add('PATCH', '/profiles/me', ['profile:edit_own'], (c) => {
  A.updateProfile({ ...c.body, semester: Number(c.body?.semester) });
  return ok();
});
add('POST', '/profiles/:id/follow', ['follow:manage'], (c) => (A.followUser(c.params.id), ok()));
add('DELETE', '/profiles/:id/follow', ['follow:manage'], (c) => (A.unfollowUser(c.params.id), ok()));
add('POST', '/communities/:id/toggle-membership', ['community:join'], (c) => (A.toggleCommunity(c.params.id), ok()));
add('POST', '/content/:id/save', ['content:save'], (c) => ({ saved: A.toggleSave(c.params.id) }));

const rate = (c: RouteCtx) => {
  A.upsertRating(c.params.id, Number(c.body?.stars), c.body?.sub ?? {}, c.body?.comment);
  return ok();
};
add('POST', '/creators/:id/ratings', ['rating:create'], rate);
add('PATCH', '/creators/:id/ratings/me', ['rating:create'], rate);
add('DELETE', '/creators/:id/ratings/me', ['rating:create'], (c) => (A.deleteMyRating(c.params.id), ok()));

add('POST', '/reports', ['report:create'], (c) => {
  A.createReport(c.body?.targetType, c.body?.targetId, c.body?.reason ?? '');
  return ok();
});
add('PATCH', '/notifications/:id/read', ['notification:read'], (c) => (A.markNotificationRead(c.params.id), ok()));
add('POST', '/notifications/read-all', ['notification:read'], () => (A.markAllNotificationsRead(), ok()));

/** Público: quien no tiene institución registrada puede pedir que la agreguen. */
add('POST', '/institutions/requests', undefined, (c) => {
  const b = c.body ?? {};
  A.submitInstitutionRequest({
    requesterEmail: b.requesterEmail ?? '',
    requesterName: b.requesterName ?? '',
    name: b.name ?? '',
    domain: b.domain ?? '',
    country: b.country ?? '',
    city: b.city ?? '',
    evidence: b.evidence ?? '',
  });
  return ok();
});

// ───────── contenido y creators ─────────
add('POST', '/content', ['content:create'], (c) => ({ id: A.saveContent(c.body) }));
add('PATCH', '/content/:id', ['content:create'], (c) => ({ id: A.saveContent(c.body, c.params.id) }));
/** DRAFT/REJECTED → PROCESSING → (verificación del video en Storage) → PENDING_REVIEW. */
add('POST', '/content/:id/submit-review', ['content:submit'], async (c) => {
  A.submitForReview(c.params.id);
  await media.processContent(c.client(), c.params.id);
  return ok();
});
add('POST', '/content/:id/publish', ['content:create'], (c) => (A.publishContent(c.params.id), ok()));
add('POST', '/content/:id/archive', ['content:create'], (c) => (A.archiveOwnContent(c.params.id), ok()));
add('POST', '/content/:id/view', undefined, (c) => (A.recordView(c.params.id), ok()));
add('POST', '/creator-applications', ['creator:apply'], (c) => (A.submitCreatorApplication(c.body), ok()));

// ───────── archivos (Supabase Storage) ─────────
add('POST', '/media/upload-url', noPerm(), (c) => media.createUpload(c.client(), c.body ?? {}));
add('POST', '/media/confirm', noPerm(), (c) => media.confirmUpload(c.client(), c.body ?? {}));
add('DELETE', '/profiles/me/avatar', ['profile:edit_own'], async (c) => {
  await media.removeAvatar(c.client());
  return ok();
});
add('GET', '/content/:id/playback', undefined, (c) => media.playbackUrl(c.client(), c.params.id));

// ───────── moderación ─────────
add('PATCH', '/moderation/content/:id', ['moderation:content'], (c) => {
  A.moderateContent(c.params.id, c.body?.decision, c.body?.reason);
  return ok();
});
add('PATCH', '/moderation/creator-applications/:id', ['moderation:creator_apps'], (c) => {
  A.reviewCreatorApplication(c.params.id, c.body?.decision, c.body?.reason);
  return ok();
});
add('POST', '/moderation/creators/:userId/suspend', ['moderation:suspend_user'], (c) => {
  A.suspendCreator(c.params.userId, c.body?.reason ?? '');
  return ok();
});
add('POST', '/moderation/creators/:userId/reactivate', ['moderation:suspend_user'], (c) => {
  A.reactivateCreator(c.params.userId, c.body?.reason ?? '');
  return ok();
});
add('PATCH', '/moderation/reports/:id', ['moderation:reports'], (c) => {
  A.resolveReport(c.params.id, c.body?.status, c.body?.resolution ?? '');
  return ok();
});
add('PATCH', '/moderation/institution-requests/:id', ['moderation:institution_requests'], (c) => {
  A.reviewInstitutionRequest(c.params.id, !!c.body?.approve, c.body?.reason);
  return ok();
});
add('PATCH', '/moderation/ratings/:id', ['moderation:hide_rating'], (c) => {
  A.setRatingHidden(c.params.id, !!c.body?.hidden, c.body?.reason ?? '');
  return ok();
});

// ───────── administración ─────────
add('GET', '/admin/audit-logs', ['admin:audit'], () => readRaw().audit.slice(0, 200));
add('PATCH', '/admin/users/:id/status', ['moderation:suspend_user'], (c) => {
  A.setAccountStatus(c.params.id, c.body?.status, c.body?.reason ?? '');
  return ok();
});
add('PUT', '/admin/users/:id/roles/:role', ['admin:roles'], (c) => {
  A.setUserRole(c.params.id, c.params.role as 'CREATOR' | 'MODERATOR' | 'ADMIN', !!c.body?.grant, c.body?.reason ?? '');
  return ok();
});
add('PATCH', '/admin/users/:id/verification', ['admin:verification'], (c) => {
  A.setVerification(c.params.id, c.body?.value ?? null, c.body?.reason ?? '');
  return ok();
});
add('PATCH', '/admin/settings', ['admin:settings'], (c) => {
  A.updateSettings({
    verificationThreshold: Number(c.body?.verificationThreshold),
    minFollowDaysToRate: Number(c.body?.minFollowDaysToRate),
  });
  return ok();
});
add('DELETE', '/admin/users/:id', ['admin:users'], (c) => (A.softDeleteUser(c.params.id, c.body?.reason ?? ''), ok()));

add('POST', '/admin/catalog/institutions', ['admin:catalog'], (c) => ({
  id: A.createInstitution({ ...c.body, domains: Array.isArray(c.body?.domains) ? c.body.domains : [] }),
}));
add('POST', '/admin/catalog/faculties', ['admin:catalog'], (c) => ({ id: A.createFaculty(c.body) }));
add('POST', '/admin/catalog/degrees', ['admin:catalog'], (c) => ({
  id: A.createDegree({ ...c.body, semesters: Number(c.body?.semesters) }),
}));
add('POST', '/admin/catalog/subjects', ['admin:catalog'], (c) => ({
  id: A.createSubject({
    ...c.body,
    semester: Number(c.body?.semester),
    credits: c.body?.credits === undefined || c.body?.credits === null ? undefined : Number(c.body.credits),
  }),
}));
add('DELETE', '/admin/catalog/:kind/:id', ['admin:catalog'], (c) => {
  if (!['institution', 'faculty', 'degree', 'subject'].includes(c.params.kind)) {
    throw new Error('Tipo de catálogo inválido.');
  }
  A.deleteCatalogItem(c.params.kind as A.CatalogKind, c.params.id);
  return ok();
});
