// Consultas derivadas (solo lectura) sobre el estado.
import { can, hasRole } from './permissions';
import type {
  Content,
  CreatorApplication,
  Db,
  Rating,
  RatingAggregateData,
  SubRatings,
  User,
} from './types';

export const PAGE_SIZE = 6;

export function userById(db: Db, id: string | null | undefined): User | undefined {
  return id ? db.users.find((u) => u.id === id && !u.deletedAt) : undefined;
}

export function sessionUser(db: Db): User | null {
  return userById(db, db.sessionUserId) ?? null;
}

export function userByHandle(db: Db, handle: string): User | undefined {
  return db.users.find((u) => u.handle === handle && !u.deletedAt);
}

export function followersCount(db: Db, userId: string): number {
  return db.follows.filter((f) => f.followingId === userId).length;
}

export function followingCount(db: Db, userId: string): number {
  return db.follows.filter((f) => f.followerId === userId).length;
}

export function isFollowing(db: Db, followerId: string | undefined, followingId: string): boolean {
  return !!followerId && db.follows.some((f) => f.followerId === followerId && f.followingId === followingId);
}

export function latestApplication(db: Db, userId: string): CreatorApplication | undefined {
  return db.applications
    .filter((a) => a.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

/** Un creator suspendido no puede publicar ni recibir nuevos pagos. */
export function isCreatorSuspended(db: Db, userId: string): boolean {
  const flag = db.derived?.creatorSuspended[userId];
  if (flag !== undefined) return flag;
  return latestApplication(db, userId)?.status === 'SUSPENDED';
}

export function canPublish(db: Db, user: User | null): boolean {
  return !!user && can(user, 'content:create') && !isCreatorSuspended(db, user.id);
}

/** Verificación: manual (admin) o automática por umbral + cuenta activa y sin suspensión. */
export function isVerified(db: Db, userId: string): boolean {
  const derived = db.derived?.verified[userId];
  if (derived !== undefined) return derived;
  const user = db.users.find((u) => u.id === userId);
  if (!user) return false;
  if (user.verifiedOverride !== null) return user.verifiedOverride;
  return (
    hasRole(user, 'CREATOR') &&
    user.status === 'ACTIVE' &&
    !isCreatorSuspended(db, userId) &&
    followersCount(db, userId) >= db.settings.verificationThreshold
  );
}

export type RatingAggregate = RatingAggregateData;

/** Promedio ponderado: la calificación de quien consumió contenido del creator pesa 1.5. */
export function ratingAggregate(db: Db, creatorId: string): RatingAggregate {
  const precomputed = db.derived?.aggregates[creatorId];
  if (precomputed) return precomputed;
  const visible = db.ratings.filter((r) => r.creatorId === creatorId && !r.hidden);
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as RatingAggregate['distribution'];
  let weightedSum = 0;
  let weightTotal = 0;
  const subSums: Record<keyof SubRatings, { s: number; n: number }> = {
    video: { s: 0, n: 0 },
    clarity: { s: 0, n: 0 },
    activities: { s: 0, n: 0 },
    resources: { s: 0, n: 0 },
  };
  for (const r of visible) {
    distribution[r.stars as 1 | 2 | 3 | 4 | 5] += 1;
    const consumed = db.views.some((v) => v.userId === r.viewerId && v.creatorId === creatorId);
    const w = consumed ? 1.5 : 1;
    weightedSum += r.stars * w;
    weightTotal += w;
    (Object.keys(subSums) as (keyof SubRatings)[]).forEach((k) => {
      const v = r.sub[k];
      if (v) {
        subSums[k].s += v;
        subSums[k].n += 1;
      }
    });
  }
  const sub: SubRatings = {};
  (Object.keys(subSums) as (keyof SubRatings)[]).forEach((k) => {
    if (subSums[k].n) sub[k] = Math.round((subSums[k].s / subSums[k].n) * 10) / 10;
  });
  return {
    average: weightTotal ? Math.round((weightedSum / weightTotal) * 10) / 10 : 0,
    count: visible.length,
    distribution,
    sub,
  };
}

export function myRating(db: Db, viewerId: string | undefined, creatorId: string): Rating | undefined {
  return viewerId ? db.ratings.find((r) => r.viewerId === viewerId && r.creatorId === creatorId) : undefined;
}

/** Solo se puede calificar tras seguir al creator N días o haber consumido contenido suyo. */
export function ratingEligibility(
  db: Db,
  viewer: User | null,
  creatorId: string,
): { ok: boolean; reason?: string } {
  if (!viewer) return { ok: false, reason: 'Inicia sesión para calificar.' };
  if (!can(viewer, 'rating:create')) return { ok: false, reason: 'Tu cuenta no puede calificar.' };
  if (viewer.id === creatorId) return { ok: false, reason: 'No puedes calificarte a ti mismo.' };
  const creator = db.users.find((u) => u.id === creatorId);
  if (!creator || !hasRole(creator, 'CREATOR')) return { ok: false, reason: 'Este perfil no es creator.' };
  const consumed = db.views.some((v) => v.userId === viewer.id && v.creatorId === creatorId);
  if (consumed) return { ok: true };
  const follow = db.follows.find((f) => f.followerId === viewer.id && f.followingId === creatorId);
  if (follow) {
    const days = (Date.now() - new Date(follow.createdAt).getTime()) / 86400000;
    if (days >= db.settings.minFollowDaysToRate) return { ok: true };
    return {
      ok: false,
      reason: `Debes seguir al creator al menos ${db.settings.minFollowDaysToRate} día(s) o ver contenido suyo.`,
    };
  }
  return { ok: false, reason: 'Sigue al creator o mira contenido suyo para poder calificar.' };
}

/** Reglas de visibilidad de un contenido para el usuario actual. */
export function contentAccess(
  db: Db,
  content: Content,
  viewer: User | null,
): { ok: boolean; reason?: string } {
  const isOwner = viewer?.id === content.creatorId;
  const isMod = can(viewer, 'moderation:content');
  if (isOwner || isMod) return { ok: true };
  if (content.status !== 'PUBLISHED') return { ok: false, reason: 'Este contenido no está publicado.' };
  if (content.visibility === 'PUBLIC') return { ok: true };
  if (content.visibility === 'FOLLOWERS') {
    return isFollowing(db, viewer?.id, content.creatorId)
      ? { ok: true }
      : { ok: false, reason: 'Contenido exclusivo para seguidores del creator.' };
  }
  return { ok: false, reason: 'Contenido de pago único. Los pagos no están disponibles en esta versión.' };
}

/** Contenido que cualquiera puede listar (publicado y no retirado). */
export function publicContents(db: Db): Content[] {
  return db.contents
    .filter((c) => c.status === 'PUBLISHED')
    .filter((c) => !db.users.find((u) => u.id === c.creatorId)?.deletedAt)
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));
}

export function feedFor(db: Db, user: User | null): Content[] {
  const all = publicContents(db);
  if (!user) return all;
  const followedUsers = new Set(db.follows.filter((f) => f.followerId === user.id).map((f) => f.followingId));
  const communities = new Set(user.communityIds);
  const mine = all.filter((c) => followedUsers.has(c.creatorId) || communities.has(c.communityId));
  return mine.length ? mine : all;
}

export interface SearchResults {
  people: User[];
  institutions: Db['institutions'];
  degrees: Db['degrees'];
  subjects: Db['subjects'];
  communities: Db['communities'];
  contents: Content[];
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function search(db: Db, query: string): SearchResults {
  const q = norm(query.trim());
  const empty: SearchResults = { people: [], institutions: [], degrees: [], subjects: [], communities: [], contents: [] };
  if (!q) return empty;
  const has = (...fields: (string | undefined)[]) => fields.some((f) => f && norm(f).includes(q));
  return {
    people: db.users.filter((u) => !u.deletedAt && has(u.name, u.handle)),
    institutions: db.institutions.filter((i) => has(i.name, i.city)),
    degrees: db.degrees.filter((d) => has(d.name, d.description)),
    subjects: db.subjects.filter((s) => has(s.name, s.code)),
    communities: db.communities.filter((c) => has(c.name)),
    contents: publicContents(db).filter((c) => has(c.title, c.description, ...c.tags)),
  };
}

export function institutionName(db: Db, id: string): string {
  return db.institutions.find((i) => i.id === id)?.name ?? '';
}

export function degreeName(db: Db, id: string): string {
  return db.degrees.find((d) => d.id === id)?.name ?? '';
}

export function subjectName(db: Db, id: string): string {
  return db.subjects.find((s) => s.id === id)?.name ?? '';
}

export function unreadCount(db: Db, userId: string | undefined): number {
  return userId ? db.notifications.filter((n) => n.userId === userId && !n.read).length : 0;
}

export function findInstitutionByDomain(db: Db, domain: string) {
  const d = domain.toLowerCase();
  return db.institutions.find((i) => i.domains.some((x) => d === x || d.endsWith(`.${x}`)));
}

export function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}
