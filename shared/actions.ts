// Casos de uso del dominio. Cada acción valida permisos y reglas de negocio,
// deja rastro en auditoría cuando es sensible y es atómica (ver mutate).
import { can, hasRole, type Permission } from './permissions';
import type {
  AccountStatus,
  ApplicationStatus,
  Content,
  ContentStatus,
  ContentType,
  Db,
  ReportTarget,
  RoleName,
  SubRatings,
  User,
  Visibility,
} from './types';
import {
  contentAccess,
  findInstitutionByDomain,
  isCreatorSuspended,
  latestApplication,
  ratingEligibility,
  sessionUser,
  userById,
} from './selectors';
import { getState, mutate, nowIso, uid } from './engine';

// ───────────────────────── helpers internos ─────────────────────────

function requireUser(d: Db): User {
  const u = sessionUser(d);
  if (!u) throw new Error('Debes iniciar sesión para hacer esto.');
  return u;
}

function requirePerm(d: Db, permission: Permission): User {
  const u = requireUser(d);
  if (!can(u, permission)) throw new Error('No tienes permiso para realizar esta acción.');
  return u;
}

function audit(
  d: Db,
  actor: User,
  action: string,
  resource: string,
  resourceId: string,
  before: string,
  after: string,
  reason = '',
) {
  d.audit.unshift({
    id: uid('aud'),
    actorId: actor.id,
    action,
    resource,
    resourceId,
    before,
    after,
    reason,
    at: nowIso(),
  });
}

function notify(d: Db, userId: string, type: string, title: string, body: string) {
  d.notifications.unshift({ id: uid('n'), userId, type, title, body, read: false, createdAt: nowIso() });
}

function mustHaveReason(reason: string | undefined, min = 5): string {
  const r = (reason ?? '').trim();
  if (r.length < min) throw new Error('Debes indicar un motivo (mínimo 5 caracteres).');
  return r;
}

// ───────────────────────── autenticación ─────────────────────────

const PERSONAL_DOMAINS = ['gmail.com', 'hotmail.com', 'outlook.com', 'live.com', 'yahoo.com', 'icloud.com', 'msn.com'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface InstitutionalEmail {
  email: string;
  domain: string;
  /** Institución del catálogo que tiene ese dominio (undefined = aún no registrada). */
  institutionId?: string;
}

/** Valida que el correo sea institucional (no personal) y resuelve la institución por su dominio. */
export function checkInstitutionalEmail(rawEmail: string): InstitutionalEmail {
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new Error('Ingresa un correo válido.');
  const domain = email.split('@')[1];
  if (PERSONAL_DOMAINS.includes(domain)) {
    throw new Error('Solo se permite el correo institucional de Microsoft 365 (no cuentas personales).');
  }
  return { email, domain, institutionId: findInstitutionByDomain(getState(), domain)?.id };
}

export type RegistrationCredentials =
  | { provider: 'microsoft'; msKey: string }
  | { provider: 'password'; passwordHash: string };

export interface RegistrationInput {
  email: string;
  name: string;
  bio: string;
  institutionId: string;
  degreeId: string;
  semester: number;
  credentials: RegistrationCredentials;
}

/** Toda cuenta nueva inicia únicamente con capacidad VIEWER. */
export function completeRegistration(input: RegistrationInput): string {
  return mutate((d) => {
    const email = input.email.trim().toLowerCase();
    if (d.users.some((u) => u.email === email)) throw new Error('Ya existe una cuenta con este correo.');
    const institution = d.institutions.find((i) => i.id === input.institutionId);
    const degree = d.degrees.find((x) => x.id === input.degreeId);
    if (!institution || !degree) throw new Error('Selecciona tu institución y carrera.');
    if (degree.institutionId !== institution.id) throw new Error('La carrera no pertenece a la institución.');
    const name = input.name.trim();
    if (name.length < 3) throw new Error('Escribe tu nombre completo.');
    if (!Number.isInteger(input.semester) || input.semester < 1 || input.semester > degree.semesters) {
      throw new Error(`El semestre debe estar entre 1 y ${degree.semesters}.`);
    }
    const base = email.split('@')[0].replace(/[^a-z0-9]/g, '') || 'user';
    let handle = base;
    let n = 1;
    while (d.users.some((u) => u.handle === handle)) handle = `${base}${n++}`;
    const user: User = {
      id: uid('u'),
      email,
      handle,
      name,
      bio: input.bio.trim(),
      institutionId: institution.id,
      facultyId: degree.facultyId,
      degreeId: degree.id,
      semester: input.semester,
      roles: ['VIEWER'],
      status: 'ACTIVE',
      communityIds: [`com_${degree.id}`],
      verifiedOverride: null,
      authProvider: input.credentials.provider,
      msKey: input.credentials.provider === 'microsoft' ? input.credentials.msKey : undefined,
      passwordHash: input.credentials.provider === 'password' ? input.credentials.passwordHash : undefined,
      emailVerified: input.credentials.provider === 'microsoft',
      createdAt: nowIso(),
    };
    d.users.push(user);
    audit(d, user, 'USER_REGISTERED', 'User', user.id, '-', 'VIEWER');
    notify(d, user.id, 'WELCOME', 'Bienvenido a Skucy', 'Tu cuenta fue creada como Viewer.');
    return user.id;
  });
}

export function submitInstitutionRequest(input: {
  requesterEmail: string;
  requesterName: string;
  name: string;
  domain: string;
  country: string;
  city: string;
  evidence: string;
}): void {
  mutate((d) => {
    if (input.name.trim().length < 3) throw new Error('Escribe el nombre de la institución.');
    const domain = input.domain.trim().toLowerCase();
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) throw new Error('Dominio institucional inválido.');
    if (!input.country.trim() || !input.city.trim()) throw new Error('Indica país y ciudad.');
    if (input.evidence.trim().length < 5) throw new Error('Agrega una evidencia o referencia administrativa.');
    if (findInstitutionByDomain(d, domain)) throw new Error('Esa institución ya existe, inicia sesión de nuevo.');
    if (d.institutionRequests.some((r) => r.domain === domain && r.status === 'PENDING')) {
      throw new Error('Ya hay una solicitud pendiente para este dominio.');
    }
    d.institutionRequests.unshift({
      id: uid('ir'),
      requesterEmail: input.requesterEmail,
      requesterName: input.requesterName.trim() || input.requesterEmail,
      name: input.name.trim(),
      domain,
      country: input.country.trim(),
      city: input.city.trim(),
      evidence: input.evidence.trim(),
      status: 'PENDING',
      createdAt: nowIso(),
    });
  });
}

export function reviewInstitutionRequest(id: string, approve: boolean, reason?: string): void {
  mutate((d) => {
    const actor = requirePerm(d, 'moderation:institution_requests');
    const req = d.institutionRequests.find((r) => r.id === id);
    if (!req) throw new Error('Solicitud no encontrada.');
    if (req.status !== 'PENDING') throw new Error('La solicitud ya fue resuelta.');
    if (!approve) mustHaveReason(reason);
    const before = req.status;
    req.status = approve ? 'APPROVED' : 'REJECTED';
    req.reviewedBy = actor.id;
    req.reason = reason?.trim();
    if (approve) {
      d.institutions.push({
        id: uid('inst'),
        name: req.name,
        city: req.city,
        country: req.country,
        domains: [req.domain],
      });
    }
    audit(d, actor, approve ? 'INSTITUTION_APPROVED' : 'INSTITUTION_REJECTED', 'InstitutionRequest', id, before, req.status, reason ?? '');
  });
}

// ───────────────────────── perfil y social ─────────────────────────

export function updateProfile(patch: { name: string; bio: string; semester: number; degreeId: string }): void {
  mutate((d) => {
    const user = requirePerm(d, 'profile:edit_own');
    const me = d.users.find((u) => u.id === user.id)!;
    if (patch.name.trim().length < 3) throw new Error('Escribe tu nombre completo.');
    // Cuentas sin institución (administrador): solo nombre y biografía.
    if (!me.institutionId) {
      me.name = patch.name.trim();
      me.bio = patch.bio.trim();
      return;
    }
    const degree = d.degrees.find((x) => x.id === patch.degreeId);
    if (!degree || degree.institutionId !== me.institutionId) throw new Error('Carrera inválida para tu institución.');
    if (patch.semester < 1 || patch.semester > degree.semesters) throw new Error(`Semestre entre 1 y ${degree.semesters}.`);
    me.name = patch.name.trim();
    me.bio = patch.bio.trim();
    me.semester = patch.semester;
    if (me.degreeId !== degree.id) {
      me.degreeId = degree.id;
      me.facultyId = degree.facultyId;
      me.communityIds = [`com_${degree.id}`, ...me.communityIds.slice(1).filter((c) => c !== `com_${degree.id}`)];
    }
  });
}

/** Foto de perfil (el archivo ya está en Supabase Storage). `null` la elimina. */
export function setAvatar(avatar: { url: string; path: string } | null): void {
  mutate((d) => {
    const user = requirePerm(d, 'profile:edit_own');
    const me = d.users.find((u) => u.id === user.id)!;
    me.avatarUrl = avatar?.url;
    me.avatarPath = avatar?.path;
  });
}

export function toggleCommunity(communityId: string): void {
  mutate((d) => {
    const user = requirePerm(d, 'community:join');
    const me = d.users.find((u) => u.id === user.id)!;
    if (!d.communities.some((c) => c.id === communityId)) throw new Error('Comunidad no encontrada.');
    if (me.communityIds[0] === communityId) throw new Error('Es tu comunidad principal.');
    me.communityIds = me.communityIds.includes(communityId)
      ? me.communityIds.filter((c) => c !== communityId)
      : [...me.communityIds, communityId];
  });
}

export function followUser(targetId: string): void {
  mutate((d) => {
    const me = requirePerm(d, 'follow:manage');
    if (me.id === targetId) throw new Error('No puedes seguirte a ti mismo.');
    const target = userById(d, targetId);
    if (!target) throw new Error('Perfil no encontrado.');
    if (d.follows.some((f) => f.followerId === me.id && f.followingId === targetId)) return;
    d.follows.push({ followerId: me.id, followingId: targetId, createdAt: nowIso() });
    notify(d, targetId, 'FOLLOW', 'Nuevo seguidor', `${me.name} empezó a seguirte.`);
  });
}

export function unfollowUser(targetId: string): void {
  mutate((d) => {
    const me = requirePerm(d, 'follow:manage');
    d.follows = d.follows.filter((f) => !(f.followerId === me.id && f.followingId === targetId));
  });
}

export function toggleSave(contentId: string): boolean {
  return mutate((d) => {
    const me = requirePerm(d, 'content:save');
    const content = d.contents.find((c) => c.id === contentId);
    if (!content) throw new Error('Contenido no encontrado.');
    const idx = d.saved.findIndex((s) => s.userId === me.id && s.contentId === contentId);
    if (idx >= 0) {
      d.saved.splice(idx, 1);
      content.saves = Math.max(0, content.saves - 1);
      return false;
    }
    d.saved.push({ userId: me.id, contentId });
    content.saves += 1;
    return true;
  });
}

// ───────────────────────── solicitud de creator ─────────────────────────

export interface CreatorApplicationInput {
  communityIds: string[];
  subjectsText: string;
  experience: string;
  links: string;
  acceptedTerms: boolean;
}

export function submitCreatorApplication(input: CreatorApplicationInput): void {
  mutate((d) => {
    const me = requirePerm(d, 'creator:apply');
    if (hasRole(me, 'CREATOR')) throw new Error('Ya eres creator.');
    const last = latestApplication(d, me.id);
    if (last && (last.status === 'SUBMITTED' || last.status === 'UNDER_REVIEW')) {
      throw new Error('Ya tienes una solicitud en revisión.');
    }
    if (me.name.trim().length < 3 || me.bio.trim().length < 10) {
      throw new Error('Completa tu perfil (nombre y biografía de al menos 10 caracteres) antes de aplicar.');
    }
    if (input.communityIds.length === 0) throw new Error('Elige al menos una comunidad.');
    if (input.subjectsText.trim().length < 3) throw new Error('Indica las materias o áreas que cubrirás.');
    if (input.experience.trim().length < 20) throw new Error('Describe tu experiencia (mínimo 20 caracteres).');
    if (!input.acceptedTerms) throw new Error('Debes aceptar los términos de publicación.');
    d.applications.push({
      id: uid('app'),
      userId: me.id,
      status: 'SUBMITTED',
      communityIds: input.communityIds,
      subjectsText: input.subjectsText.trim(),
      experience: input.experience.trim(),
      links: input.links.trim(),
      acceptedTerms: true,
      history: [{ status: 'SUBMITTED', actorId: me.id, at: nowIso() }],
      createdAt: nowIso(),
    });
    audit(d, me, 'CREATOR_APPLICATION_SUBMITTED', 'CreatorApplication', me.id, '-', 'SUBMITTED');
  });
}

export function reviewCreatorApplication(
  applicationId: string,
  decision: Extract<ApplicationStatus, 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED'>,
  reason?: string,
): void {
  mutate((d) => {
    const actor = requirePerm(d, 'moderation:creator_apps');
    const app = d.applications.find((a) => a.id === applicationId);
    if (!app) throw new Error('Solicitud no encontrada.');
    if (app.userId === actor.id) throw new Error('No puedes resolver tu propia solicitud.');
    if (app.status !== 'SUBMITTED' && app.status !== 'UNDER_REVIEW') throw new Error('La solicitud ya fue resuelta.');
    if (decision === 'REJECTED') mustHaveReason(reason);
    const before = app.status;
    app.status = decision;
    app.history.push({ status: decision, actorId: actor.id, reason: reason?.trim(), at: nowIso() });
    const applicant = d.users.find((u) => u.id === app.userId)!;
    if (decision === 'APPROVED' && !applicant.roles.includes('CREATOR')) applicant.roles.push('CREATOR');
    if (decision !== 'UNDER_REVIEW') {
      notify(
        d,
        applicant.id,
        'CREATOR_DECISION',
        decision === 'APPROVED' ? '¡Ahora eres creator!' : 'Solicitud de creator rechazada',
        decision === 'APPROVED' ? 'Ya puedes crear y enviar contenido a revisión.' : `Motivo: ${reason?.trim()}`,
      );
    }
    audit(d, actor, `CREATOR_APPLICATION_${decision}`, 'CreatorApplication', app.id, before, decision, reason ?? '');
  });
}

export function suspendCreator(userId: string, reason: string): void {
  mutate((d) => {
    const actor = requirePerm(d, 'moderation:suspend_user');
    const app = latestApplication(d, userId);
    const target = d.users.find((u) => u.id === userId);
    if (!target || !hasRole(target, 'CREATOR') || !app || app.status !== 'APPROVED') {
      throw new Error('El usuario no es un creator activo.');
    }
    if (hasRole(target, 'ADMIN') || (hasRole(target, 'MODERATOR') && !hasRole(actor, 'ADMIN'))) {
      throw new Error('No puedes suspender a un usuario con rol de moderación.');
    }
    const r = mustHaveReason(reason);
    app.status = 'SUSPENDED';
    app.history.push({ status: 'SUSPENDED', actorId: actor.id, reason: r, at: nowIso() });
    notify(d, userId, 'CREATOR_SUSPENDED', 'Cuenta de creator suspendida', `Motivo: ${r}`);
    audit(d, actor, 'CREATOR_SUSPENDED', 'User', userId, 'APPROVED', 'SUSPENDED', r);
  });
}

export function reactivateCreator(userId: string, reason: string): void {
  mutate((d) => {
    const actor = requirePerm(d, 'moderation:suspend_user');
    const app = latestApplication(d, userId);
    if (!app || app.status !== 'SUSPENDED') throw new Error('El creator no está suspendido.');
    const r = mustHaveReason(reason);
    app.status = 'APPROVED';
    app.history.push({ status: 'APPROVED', actorId: actor.id, reason: r, at: nowIso() });
    notify(d, userId, 'CREATOR_REACTIVATED', 'Cuenta de creator reactivada', 'Ya puedes volver a publicar.');
    audit(d, actor, 'CREATOR_REACTIVATED', 'User', userId, 'SUSPENDED', 'APPROVED', r);
  });
}

// ───────────────────────── contenido ─────────────────────────

export interface ContentInput {
  type: ContentType;
  title: string;
  description: string;
  subjectId: string;
  communityId: string;
  tags: string[];
  visibility: Visibility;
  priceLabel?: string;
}

function assertCanPublish(d: Db, user: User) {
  if (!can(user, 'content:create')) throw new Error('Solo los creators pueden crear contenido.');
  if (isCreatorSuspended(d, user.id)) throw new Error('Tu cuenta de creator está suspendida.');
}

export function saveContent(input: ContentInput, id?: string): string {
  return mutate((d) => {
    const me = requireUser(d);
    assertCanPublish(d, me);
    if (input.title.trim().length < 4) throw new Error('El título debe tener al menos 4 caracteres.');
    if (input.description.trim().length < 10) throw new Error('La descripción debe tener al menos 10 caracteres.');
    const subject = d.subjects.find((s) => s.id === input.subjectId);
    if (!subject) throw new Error('Selecciona una materia.');
    const community = d.communities.find((c) => c.id === input.communityId);
    if (!community || community.degreeId !== subject.degreeId) {
      throw new Error('La comunidad debe corresponder a la carrera de la materia.');
    }
    const fields = {
      type: input.type,
      title: input.title.trim(),
      description: input.description.trim(),
      subjectId: subject.id,
      degreeId: subject.degreeId,
      semester: subject.semester,
      communityId: community.id,
      tags: input.tags.map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 8),
      visibility: input.visibility,
      priceLabel: input.visibility === 'PAID' ? input.priceLabel?.trim() || 'Precio por definir' : undefined,
      updatedAt: nowIso(),
    };
    if (id) {
      const c = d.contents.find((x) => x.id === id);
      if (!c || c.creatorId !== me.id) throw new Error('Contenido no encontrado.');
      if (c.status !== 'DRAFT' && c.status !== 'REJECTED') throw new Error('Solo se edita en borrador o rechazado.');
      Object.assign(c, fields);
      return c.id;
    }
    const content: Content = {
      id: uid('c'),
      creatorId: me.id,
      status: 'DRAFT',
      views: 0,
      saves: 0,
      reportsCount: 0,
      createdAt: nowIso(),
      ...fields,
    };
    d.contents.unshift(content);
    return content.id;
  });
}

/** DRAFT/REJECTED → PROCESSING. El backend verifica el video guardado y llama a finishProcessing. */
export function submitForReview(id: string): void {
  mutate((d) => {
    const me = requirePerm(d, 'content:submit');
    assertCanPublish(d, me);
    const c = d.contents.find((x) => x.id === id);
    if (!c || c.creatorId !== me.id) throw new Error('Contenido no encontrado.');
    if (c.status !== 'DRAFT' && c.status !== 'REJECTED') throw new Error('Este contenido no se puede enviar a revisión.');
    if (c.type === 'VIDEO' && !c.videoPath) throw new Error('Sube el video antes de enviar a revisión.');
    c.status = 'PROCESSING';
    c.rejectionReason = undefined;
    c.updatedAt = nowIso();
  });
}

export interface ProcessingResult {
  ok: boolean;
  error?: string;
}

/** Resultado del procesamiento (verificación del video en Storage). */
export function finishProcessing(id: string, result: ProcessingResult): void {
  mutate((d) => {
    const c = d.contents.find((x) => x.id === id);
    if (!c || c.status !== 'PROCESSING') return;
    c.updatedAt = nowIso();
    if (result.ok) {
      c.status = 'PENDING_REVIEW';
      notify(d, c.creatorId, 'CONTENT_PROCESSED', 'Contenido procesado', `"${c.title}" está en revisión.`);
    } else {
      c.status = 'REJECTED';
      c.rejectionReason = result.error ?? 'No se pudo procesar el video.';
      notify(d, c.creatorId, 'CONTENT_FAILED', 'No se pudo procesar tu contenido', c.rejectionReason);
    }
  });
}

/** Lectura: contenido propio que aún se puede modificar (para validar antes de subir archivos). */
export function editableOwnContent(id: string): Content {
  const db = getState();
  const me = sessionUser(db);
  if (!me) throw new Error('Debes iniciar sesión para hacer esto.');
  assertCanPublish(db, me);
  const c = db.contents.find((x) => x.id === id);
  if (!c || c.creatorId !== me.id) throw new Error('Contenido no encontrado.');
  if (c.status !== 'DRAFT' && c.status !== 'REJECTED') throw new Error('Solo se edita en borrador o rechazado.');
  return c;
}

export function attachVideo(id: string, video: { path: string; mime: string; sizeBytes: number }): void {
  mutate((d) => {
    const me = requirePerm(d, 'content:create');
    const c = d.contents.find((x) => x.id === id && x.creatorId === me.id);
    if (!c) throw new Error('Contenido no encontrado.');
    if (c.status !== 'DRAFT' && c.status !== 'REJECTED') throw new Error('Solo se edita en borrador o rechazado.');
    c.videoPath = video.path;
    c.videoMime = video.mime;
    c.videoSizeBytes = video.sizeBytes;
    c.updatedAt = nowIso();
  });
}

export function attachThumbnail(id: string, thumb: { path: string; url: string }): void {
  mutate((d) => {
    const me = requirePerm(d, 'content:create');
    const c = d.contents.find((x) => x.id === id && x.creatorId === me.id);
    if (!c) throw new Error('Contenido no encontrado.');
    if (c.status !== 'DRAFT' && c.status !== 'REJECTED') throw new Error('Solo se edita en borrador o rechazado.');
    c.thumbnailPath = thumb.path;
    c.thumbnailUrl = thumb.url;
    c.updatedAt = nowIso();
  });
}

export function moderateContent(
  id: string,
  decision: Extract<ContentStatus, 'APPROVED' | 'REJECTED' | 'ARCHIVED' | 'REMOVED'>,
  reason?: string,
): void {
  mutate((d) => {
    const actor = requirePerm(d, 'moderation:content');
    const c = d.contents.find((x) => x.id === id);
    if (!c) throw new Error('Contenido no encontrado.');
    if (c.creatorId === actor.id) throw new Error('No puedes moderar tu propio contenido.');
    if ((decision === 'APPROVED' || decision === 'REJECTED') && c.status !== 'PENDING_REVIEW') {
      throw new Error('Solo se aprueba o rechaza contenido en revisión.');
    }
    if (decision === 'REJECTED' || decision === 'REMOVED') mustHaveReason(reason);
    const before = c.status;
    c.status = decision;
    c.rejectionReason = decision === 'REJECTED' || decision === 'REMOVED' ? reason?.trim() : undefined;
    c.updatedAt = nowIso();
    const message: Record<string, string> = {
      APPROVED: `"${c.title}" fue aprobado. Ya puedes publicarlo.`,
      REJECTED: `"${c.title}" fue rechazado. Motivo: ${reason?.trim()}`,
      ARCHIVED: `"${c.title}" fue archivado por moderación.`,
      REMOVED: `"${c.title}" fue retirado. Motivo: ${reason?.trim()}`,
    };
    notify(d, c.creatorId, 'MODERATION', 'Decisión de moderación', message[decision]);
    audit(d, actor, `CONTENT_${decision}`, 'Content', c.id, before, decision, reason ?? '');
  });
}

/** Solo contenido APPROVED puede publicarse. */
export function publishContent(id: string): void {
  mutate((d) => {
    const me = requireUser(d);
    assertCanPublish(d, me);
    const c = d.contents.find((x) => x.id === id);
    if (!c || c.creatorId !== me.id) throw new Error('Contenido no encontrado.');
    if (c.status !== 'APPROVED') throw new Error('Solo el contenido aprobado puede publicarse.');
    c.status = 'PUBLISHED';
    c.publishedAt = nowIso();
    c.updatedAt = nowIso();
    d.follows
      .filter((f) => f.followingId === me.id)
      .forEach((f) => notify(d, f.followerId, 'CONTENT', 'Nuevo contenido', `${me.name} publicó "${c.title}".`));
  });
}

export function archiveOwnContent(id: string): void {
  mutate((d) => {
    const me = requireUser(d);
    const c = d.contents.find((x) => x.id === id);
    if (!c || c.creatorId !== me.id) throw new Error('Contenido no encontrado.');
    if (c.status !== 'PUBLISHED' && c.status !== 'APPROVED') throw new Error('No se puede archivar en este estado.');
    c.status = 'ARCHIVED';
    c.updatedAt = nowIso();
  });
}

export function recordView(contentId: string): void {
  const db = getState();
  const c = db.contents.find((x) => x.id === contentId);
  const viewer = sessionUser(db);
  if (!c || c.status !== 'PUBLISHED' || !contentAccess(db, c, viewer).ok) return;
  if (viewer && viewer.id === c.creatorId) return;
  mutate((d) => {
    const content = d.contents.find((x) => x.id === contentId)!;
    content.views += 1;
    if (viewer && !d.views.some((v) => v.userId === viewer.id && v.contentId === contentId)) {
      d.views.push({ userId: viewer.id, contentId, creatorId: content.creatorId, at: nowIso() });
    }
  });
}

// ───────────────────────── calificaciones ─────────────────────────

export function upsertRating(creatorId: string, stars: number, sub: SubRatings, comment?: string): void {
  mutate((d) => {
    const me = requirePerm(d, 'rating:create');
    const eligibility = ratingEligibility(d, me, creatorId);
    if (!eligibility.ok) throw new Error(eligibility.reason);
    const valid = (n: number) => Number.isInteger(n) && n >= 1 && n <= 5;
    if (!valid(stars)) throw new Error('La calificación debe ser de 1 a 5 estrellas.');
    (Object.keys(sub) as (keyof SubRatings)[]).forEach((k) => {
      if (sub[k] !== undefined && !valid(sub[k] as number)) throw new Error('Las subcalificaciones deben ser de 1 a 5.');
    });
    const existing = d.ratings.find((r) => r.viewerId === me.id && r.creatorId === creatorId);
    if (existing) {
      existing.stars = stars;
      existing.sub = sub;
      existing.comment = comment?.trim() || undefined;
      existing.updatedAt = nowIso();
    } else {
      d.ratings.push({
        id: uid('r'),
        viewerId: me.id,
        creatorId,
        stars,
        sub,
        comment: comment?.trim() || undefined,
        hidden: false,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
      notify(d, creatorId, 'RATING', 'Nueva calificación', `${me.name} te calificó con ${stars} estrella(s).`);
    }
  });
}

export function deleteMyRating(creatorId: string): void {
  mutate((d) => {
    const me = requirePerm(d, 'rating:create');
    d.ratings = d.ratings.filter((r) => !(r.viewerId === me.id && r.creatorId === creatorId));
  });
}

export function setRatingHidden(ratingId: string, hidden: boolean, reason: string): void {
  mutate((d) => {
    const actor = requirePerm(d, 'moderation:hide_rating');
    const r = d.ratings.find((x) => x.id === ratingId);
    if (!r) throw new Error('Calificación no encontrada.');
    const why = mustHaveReason(reason);
    const before = r.hidden ? 'HIDDEN' : 'VISIBLE';
    r.hidden = hidden;
    audit(d, actor, hidden ? 'RATING_HIDDEN' : 'RATING_RESTORED', 'Rating', r.id, before, hidden ? 'HIDDEN' : 'VISIBLE', why);
  });
}

// ───────────────────────── reportes ─────────────────────────

export function createReport(targetType: ReportTarget, targetId: string, reason: string): void {
  mutate((d) => {
    const me = requirePerm(d, 'report:create');
    if (reason.trim().length < 10) throw new Error('Describe el motivo con al menos 10 caracteres.');
    if (targetType === 'USER') {
      if (targetId === me.id) throw new Error('No puedes reportarte a ti mismo.');
      if (!userById(d, targetId)) throw new Error('Usuario no encontrado.');
    } else {
      const c = d.contents.find((x) => x.id === targetId);
      if (!c) throw new Error('Contenido no encontrado.');
      if (c.creatorId === me.id) throw new Error('No puedes reportar tu propio contenido.');
      c.reportsCount += 1;
    }
    if (d.reports.some((r) => r.reporterId === me.id && r.targetId === targetId && r.status === 'OPEN')) {
      throw new Error('Ya reportaste este elemento.');
    }
    d.reports.unshift({
      id: uid('rep'),
      reporterId: me.id,
      targetType,
      targetId,
      reason: reason.trim(),
      status: 'OPEN',
      createdAt: nowIso(),
    });
  });
}

export function resolveReport(id: string, status: 'RESOLVED' | 'DISMISSED', resolution: string): void {
  mutate((d) => {
    const actor = requirePerm(d, 'moderation:reports');
    const r = d.reports.find((x) => x.id === id);
    if (!r) throw new Error('Reporte no encontrado.');
    if (r.status !== 'OPEN') throw new Error('El reporte ya fue resuelto.');
    const why = mustHaveReason(resolution);
    r.status = status;
    r.resolution = why;
    notify(d, r.reporterId, 'REPORT', 'Tu reporte fue revisado', why);
    audit(d, actor, `REPORT_${status}`, 'Report', r.id, 'OPEN', status, why);
  });
}

// ───────────────────────── notificaciones ─────────────────────────

export function markNotificationRead(id: string): void {
  mutate((d) => {
    const me = requirePerm(d, 'notification:read');
    const n = d.notifications.find((x) => x.id === id && x.userId === me.id);
    if (n) n.read = true;
  });
}

export function markAllNotificationsRead(): void {
  mutate((d) => {
    const me = requirePerm(d, 'notification:read');
    d.notifications.forEach((n) => {
      if (n.userId === me.id) n.read = true;
    });
  });
}

// ───────────────────────── administración ─────────────────────────

export function setAccountStatus(userId: string, status: AccountStatus, reason: string): void {
  mutate((d) => {
    const actor = requirePerm(d, 'moderation:suspend_user');
    const target = userById(d, userId);
    if (!target) throw new Error('Usuario no encontrado.');
    if (target.id === actor.id) throw new Error('No puedes cambiar el estado de tu propia cuenta.');
    const isAdmin = hasRole(actor, 'ADMIN');
    const targetIsStaff = hasRole(target, 'MODERATOR') || hasRole(target, 'ADMIN');
    if (targetIsStaff && !isAdmin) throw new Error('Solo un administrador puede modificar cuentas de moderación.');
    if ((status === 'BANNED' || target.status === 'BANNED') && !isAdmin) {
      throw new Error('Solo un administrador puede banear o reactivar cuentas baneadas.');
    }
    const why = mustHaveReason(reason);
    const before = target.status;
    target.status = status;
    target.statusReason = status === 'ACTIVE' ? undefined : why;
    notify(d, userId, 'ACCOUNT', 'Estado de tu cuenta', status === 'ACTIVE' ? 'Tu cuenta fue reactivada.' : `Tu cuenta quedó ${status}. Motivo: ${why}`);
    audit(d, actor, 'ACCOUNT_STATUS_CHANGED', 'User', userId, before, status, why);
  });
}

export function setUserRole(userId: string, role: Extract<RoleName, 'CREATOR' | 'MODERATOR' | 'ADMIN'>, grant: boolean, reason: string): void {
  mutate((d) => {
    const actor = requirePerm(d, 'admin:roles');
    const target = userById(d, userId);
    if (!target) throw new Error('Usuario no encontrado.');
    const why = mustHaveReason(reason);
    if (!grant && target.id === actor.id && role === 'ADMIN') throw new Error('No puedes quitarte el rol de administrador.');
    const before = target.roles.join(',');
    if (grant && !target.roles.includes(role)) target.roles.push(role);
    if (!grant) target.roles = target.roles.filter((r) => r !== role);
    audit(d, actor, grant ? 'ROLE_GRANTED' : 'ROLE_REVOKED', 'User', userId, before, target.roles.join(','), `${role}: ${why}`);
  });
}

/** value: true/false = decisión manual del admin; null = volver a verificación automática. */
export function setVerification(userId: string, value: boolean | null, reason: string): void {
  mutate((d) => {
    const actor = requirePerm(d, 'admin:verification');
    const target = userById(d, userId);
    if (!target) throw new Error('Usuario no encontrado.');
    const why = mustHaveReason(reason);
    const before = String(target.verifiedOverride);
    target.verifiedOverride = value;
    audit(d, actor, 'VERIFICATION_CHANGED', 'User', userId, before, String(value), why);
  });
}

export function updateSettings(patch: { verificationThreshold: number; minFollowDaysToRate: number }): void {
  mutate((d) => {
    const actor = requirePerm(d, 'admin:settings');
    if (!Number.isInteger(patch.verificationThreshold) || patch.verificationThreshold < 1) {
      throw new Error('El umbral de verificación debe ser un entero positivo.');
    }
    if (!Number.isInteger(patch.minFollowDaysToRate) || patch.minFollowDaysToRate < 0) {
      throw new Error('Los días mínimos deben ser un entero mayor o igual a 0.');
    }
    const before = JSON.stringify(d.settings);
    d.settings = { ...patch };
    audit(d, actor, 'SETTINGS_UPDATED', 'Settings', 'global', before, JSON.stringify(d.settings), 'Cambio de configuración');
  });
}

export function softDeleteUser(userId: string, reason: string): void {
  mutate((d) => {
    const actor = requirePerm(d, 'admin:users');
    const target = userById(d, userId);
    if (!target) throw new Error('Usuario no encontrado.');
    if (target.id === actor.id) throw new Error('No puedes eliminar tu propia cuenta.');
    const why = mustHaveReason(reason);
    target.deletedAt = nowIso();
    audit(d, actor, 'USER_SOFT_DELETED', 'User', userId, 'ACTIVE', 'DELETED', why);
  });
}

// ───────────────────────── catálogo académico (administrador) ─────────────────────────

const DOMAIN_RE = /^[a-z0-9.-]+\.[a-z]{2,}$/;

export function createInstitution(input: { name: string; city: string; country: string; domains: string[] }): string {
  return mutate((d) => {
    const actor = requirePerm(d, 'admin:catalog');
    const name = input.name.trim();
    if (name.length < 3) throw new Error('Escribe el nombre de la institución.');
    if (!input.city.trim() || !input.country.trim()) throw new Error('Indica país y ciudad.');
    const domains = Array.from(new Set(input.domains.map((x) => x.trim().toLowerCase()).filter(Boolean)));
    if (domains.length === 0) throw new Error('Agrega al menos un dominio institucional.');
    for (const domain of domains) {
      if (!DOMAIN_RE.test(domain)) throw new Error(`Dominio inválido: ${domain}`);
      if (findInstitutionByDomain(d, domain)) throw new Error(`El dominio ${domain} ya pertenece a otra institución.`);
    }
    const inst = { id: uid('inst'), name, city: input.city.trim(), country: input.country.trim(), domains };
    d.institutions.push(inst);
    audit(d, actor, 'INSTITUTION_CREATED', 'Institution', inst.id, '-', name);
    return inst.id;
  });
}

export function createFaculty(input: { institutionId: string; name: string }): string {
  return mutate((d) => {
    const actor = requirePerm(d, 'admin:catalog');
    if (!d.institutions.some((i) => i.id === input.institutionId)) throw new Error('Institución no encontrada.');
    const name = input.name.trim();
    if (name.length < 3) throw new Error('Escribe el nombre de la facultad.');
    if (d.faculties.some((f) => f.institutionId === input.institutionId && f.name.toLowerCase() === name.toLowerCase())) {
      throw new Error('Ya existe una facultad con ese nombre.');
    }
    const fac = { id: uid('fac'), institutionId: input.institutionId, name };
    d.faculties.push(fac);
    audit(d, actor, 'FACULTY_CREATED', 'Faculty', fac.id, '-', name);
    return fac.id;
  });
}

/** Crea la carrera y su comunidad (institución + facultad + carrera). */
export function createDegree(input: { facultyId: string; name: string; description: string; semesters: number }): string {
  return mutate((d) => {
    const actor = requirePerm(d, 'admin:catalog');
    const faculty = d.faculties.find((f) => f.id === input.facultyId);
    if (!faculty) throw new Error('Facultad no encontrada.');
    const name = input.name.trim();
    if (name.length < 3) throw new Error('Escribe el nombre de la carrera.');
    if (!Number.isInteger(input.semesters) || input.semesters < 1 || input.semesters > 20) {
      throw new Error('Los semestres deben ser un entero entre 1 y 20.');
    }
    if (d.degrees.some((x) => x.facultyId === faculty.id && x.name.toLowerCase() === name.toLowerCase())) {
      throw new Error('Ya existe una carrera con ese nombre en la facultad.');
    }
    const institution = d.institutions.find((i) => i.id === faculty.institutionId)!;
    const degree = {
      id: uid('deg'),
      institutionId: faculty.institutionId,
      facultyId: faculty.id,
      name,
      description: input.description.trim(),
      semesters: input.semesters,
    };
    d.degrees.push(degree);
    d.communities.push({
      id: `com_${degree.id}`,
      institutionId: faculty.institutionId,
      facultyId: faculty.id,
      degreeId: degree.id,
      name: `${name} · ${institution.name}`,
    });
    audit(d, actor, 'DEGREE_CREATED', 'Degree', degree.id, '-', name);
    return degree.id;
  });
}

export function createSubject(input: {
  degreeId: string;
  semester: number;
  code: string;
  name: string;
  description: string;
  credits?: number;
}): string {
  return mutate((d) => {
    const actor = requirePerm(d, 'admin:catalog');
    const degree = d.degrees.find((x) => x.id === input.degreeId);
    if (!degree) throw new Error('Carrera no encontrada.');
    if (!Number.isInteger(input.semester) || input.semester < 1 || input.semester > degree.semesters) {
      throw new Error(`El semestre debe estar entre 1 y ${degree.semesters}.`);
    }
    const code = input.code.trim().toUpperCase();
    const name = input.name.trim();
    if (code.length < 2) throw new Error('Escribe el código de la materia.');
    if (name.length < 3) throw new Error('Escribe el nombre de la materia.');
    if (d.subjects.some((s) => s.degreeId === degree.id && s.code === code)) {
      throw new Error('Ya existe una materia con ese código en la carrera.');
    }
    const credits = input.credits === undefined || Number.isNaN(input.credits) ? undefined : input.credits;
    if (credits !== undefined && (!Number.isInteger(credits) || credits < 0 || credits > 30)) {
      throw new Error('Los créditos deben ser un entero entre 0 y 30.');
    }
    const subject = {
      id: uid('sub'),
      degreeId: degree.id,
      semester: input.semester,
      code,
      name,
      description: input.description.trim(),
      credits,
      active: true,
    };
    d.subjects.push(subject);
    audit(d, actor, 'SUBJECT_CREATED', 'Subject', subject.id, '-', `${code} ${name}`);
    return subject.id;
  });
}

export type CatalogKind = 'institution' | 'faculty' | 'degree' | 'subject';

/** Elimina un elemento del catálogo solo si nada depende de él. */
export function deleteCatalogItem(kind: CatalogKind, id: string): void {
  mutate((d) => {
    const actor = requirePerm(d, 'admin:catalog');
    if (kind === 'institution') {
      const inst = d.institutions.find((i) => i.id === id);
      if (!inst) throw new Error('Institución no encontrada.');
      if (d.faculties.some((f) => f.institutionId === id) || d.users.some((u) => u.institutionId === id)) {
        throw new Error('La institución tiene facultades o usuarios: no se puede eliminar.');
      }
      d.institutions = d.institutions.filter((i) => i.id !== id);
      audit(d, actor, 'INSTITUTION_DELETED', 'Institution', id, inst.name, '-');
    } else if (kind === 'faculty') {
      const fac = d.faculties.find((f) => f.id === id);
      if (!fac) throw new Error('Facultad no encontrada.');
      if (d.degrees.some((x) => x.facultyId === id)) throw new Error('La facultad tiene carreras: no se puede eliminar.');
      d.faculties = d.faculties.filter((f) => f.id !== id);
      audit(d, actor, 'FACULTY_DELETED', 'Faculty', id, fac.name, '-');
    } else if (kind === 'degree') {
      const deg = d.degrees.find((x) => x.id === id);
      if (!deg) throw new Error('Carrera no encontrada.');
      if (d.subjects.some((s) => s.degreeId === id)) throw new Error('La carrera tiene materias: elimínalas primero.');
      if (d.users.some((u) => u.degreeId === id) || d.contents.some((c) => c.degreeId === id)) {
        throw new Error('La carrera tiene usuarios o contenido: no se puede eliminar.');
      }
      d.degrees = d.degrees.filter((x) => x.id !== id);
      d.communities = d.communities.filter((c) => c.degreeId !== id);
      d.users.forEach((u) => {
        u.communityIds = u.communityIds.filter((c) => c !== `com_${id}`);
      });
      audit(d, actor, 'DEGREE_DELETED', 'Degree', id, deg.name, '-');
    } else {
      const sub = d.subjects.find((s) => s.id === id);
      if (!sub) throw new Error('Materia no encontrada.');
      if (d.contents.some((c) => c.subjectId === id)) throw new Error('La materia tiene contenido: no se puede eliminar.');
      d.subjects = d.subjects.filter((s) => s.id !== id);
      audit(d, actor, 'SUBJECT_DELETED', 'Subject', id, `${sub.code} ${sub.name}`, '-');
    }
  });
}
