import { can } from '../../shared/permissions';
import {
  contentAccess,
  isCreatorSuspended,
  isVerified,
  ratingAggregate,
  sessionUser,
} from '../../shared/selectors';
import type { Content, Db, DerivedData, User } from '../../shared/types';
import { currentActorId, readRaw } from './runtime';

/**
 * Construye la vista de la base de datos que puede ver el usuario actual.
 * La app móvil guarda esta "réplica" y calcula sus pantallas sobre ella; los datos privados
 * (correos ajenos, reportes, auditoría, solicitudes de otros, vistas, notificaciones ajenas)
 * nunca salen del servidor para quien no tiene permiso.
 */
export function snapshot(): Db {
    const raw = readRaw();
    const actorId = currentActorId();
    const { refreshTokens: _omit, ...base } = raw;
    void _omit;
    const full: Db = { ...base, sessionUserId: actorId };
    const viewer = sessionUser(full);
    const isMod = can(viewer, 'moderation:content');
    const isStaff = isMod || can(viewer, 'admin:users');

    const users: User[] = full.users
      .filter((u) => !u.deletedAt)
      .map((u) => {
        // Nada de credenciales ni rutas internas sale del servidor, ni siquiera hacia el dueño de la cuenta.
        const {
          avatarPath: _ap,
          passwordHash: _ph,
          msKey: _mk,
          adminPwFp: _fp,
          failedLogins: _fl,
          lockedUntil: _lu,
          ...pub
        } = u;
        void [_ap, _ph, _mk, _fp, _fl, _lu];
        const visible = isStaff || u.id === actorId;
        return visible ? pub : { ...pub, email: '', statusReason: undefined };
      });

    const contents: Content[] = full.contents
      .filter((c) => {
        if (isMod) return true;
        if (c.creatorId === actorId) return true;
        return c.status === 'PUBLISHED' && !full.users.find((u) => u.id === c.creatorId)?.deletedAt;
      })
      .map((c) => {
        // La ruta del video (bucket privado) nunca sale del servidor: se informa solo si existe.
        const { videoPath, thumbnailPath: _tp, ...visible } = c;
        void _tp;
        if (contentAccess(full, c, viewer).ok) return { ...visible, hasVideo: !!videoPath };
        // Contenido bloqueado: se oculta todo lo que permita ver o reproducir el material.
        return { ...visible, thumbnailUrl: undefined, videoMime: undefined, videoSizeBytes: undefined, hasVideo: false };
      });

    const canHideRatings = can(viewer, 'moderation:hide_rating');
    const derived: DerivedData = { verified: {}, creatorSuspended: {}, aggregates: {} };
    for (const u of full.users) {
      derived.verified[u.id] = isVerified(full, u.id);
      derived.creatorSuspended[u.id] = isCreatorSuspended(full, u.id);
      if (u.roles.includes('CREATOR')) derived.aggregates[u.id] = ratingAggregate(full, u.id);
    }

    return {
      ...full,
      users,
      contents,
      ratings: full.ratings.filter((r) => !r.hidden || canHideRatings || r.viewerId === actorId),
      saved: full.saved.filter((s) => s.userId === actorId),
      views: full.views.filter((v) => v.userId === actorId),
      reports: can(viewer, 'moderation:reports') ? full.reports : [],
      notifications: full.notifications.filter((n) => n.userId === actorId),
      applications: can(viewer, 'moderation:creator_apps')
        ? full.applications
        : full.applications.filter((a) => a.userId === actorId),
      institutionRequests: can(viewer, 'moderation:institution_requests') ? full.institutionRequests : [],
      audit: can(viewer, 'admin:audit') ? full.audit.slice(0, 200) : [],
      derived,
    };
  }
