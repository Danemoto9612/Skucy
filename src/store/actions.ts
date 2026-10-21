// Casos de uso de la app: cada función llama a la API REST del backend y luego refresca la réplica local.
// Las reglas de negocio y permisos se validan en el servidor (mismas reglas que `shared/actions`).
import type {
  ContentInput,
  CreatorApplicationInput,
  RegistrationInput,
} from '../../shared/actions';
import type { AccountStatus, ReportTarget, SubRatings } from '../../shared/types';
import { api, getRefreshToken, putToSignedUrl, setTokens } from '../api/client';
import { getMicrosoftIdToken } from '../api/microsoft';
import { refresh } from './store';

type Done = Promise<void>;

async function run(call: () => Promise<unknown>): Done {
  await call();
  await refresh();
}

// ───────────── autenticación ─────────────

export type LoginResult =
  | { kind: 'ok' }
  | { kind: 'register'; email: string; institutionId: string; registrationToken: string; name?: string; method: 'microsoft' | 'password' }
  | { kind: 'institution_request'; email: string; domain: string };

type TokenResponse = { accessToken: string; refreshToken: string };

async function finishLogin(res: LoginResult & Partial<TokenResponse>): Promise<LoginResult> {
  if (res.kind === 'ok' && res.accessToken && res.refreshToken) {
    await setTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
    await refresh();
    return { kind: 'ok' };
  }
  return res;
}

/** HU-01 / HU-03: abre la página real de Microsoft 365 y el servidor verifica la identidad. */
export async function loginWithMicrosoft(): Promise<LoginResult> {
  return loginWithIdToken(await getMicrosoftIdToken());
}

/** Envía al servidor el ID token de Microsoft (el servidor lo verifica) y abre sesión o inicia el registro. */
export async function loginWithIdToken(idToken: string): Promise<LoginResult> {
  return finishLogin(await api.post<LoginResult & Partial<TokenResponse>>('/auth/microsoft', { idToken }, false));
}

/** HU-02: ingreso manual con el correo institucional y la contraseña de Skucy. */
export async function loginWithPassword(email: string, password: string): Promise<LoginResult> {
  return finishLogin(await api.post<LoginResult & Partial<TokenResponse>>('/auth/login', { email, password }, false));
}

/** HU-03 (manual): valida el correo institucional y devuelve el pase para crear la cuenta con contraseña. */
export const registerStart = (email: string): Promise<LoginResult> =>
  api.post<LoginResult>('/auth/register/start', { email }, false);

export async function completeRegistration(
  input: Omit<RegistrationInput, 'email' | 'institutionId' | 'credentials'> & {
    registrationToken: string;
    /** Solo en el registro manual. */
    password?: string;
  },
): Done {
  const tokens = await api.post<TokenResponse>('/auth/register', input, false);
  await setTokens({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
  await refresh();
}

export async function logout(): Done {
  const refreshToken = getRefreshToken();
  try {
    if (refreshToken) await api.post('/auth/logout', { refreshToken }, false);
  } catch {
    // Aunque falle el servidor, la sesión local se cierra.
  }
  await setTokens(null);
  await refresh();
}

export const submitInstitutionRequest = (input: {
  requesterEmail: string;
  requesterName: string;
  name: string;
  domain: string;
  country: string;
  city: string;
  evidence: string;
}): Done => run(() => api.post('/institutions/requests', input, false));

// ───────────── perfil y social ─────────────

export const updateProfile = (patch: { name: string; bio: string; semester: number; degreeId: string }): Done =>
  run(() => api.patch('/profiles/me', patch));

export const toggleCommunity = (communityId: string): Done =>
  run(() => api.post(`/communities/${communityId}/toggle-membership`));

export const followUser = (id: string): Done => run(() => api.post(`/profiles/${id}/follow`));
export const unfollowUser = (id: string): Done => run(() => api.delete(`/profiles/${id}/follow`));

export async function toggleSave(contentId: string): Promise<boolean> {
  const res = await api.post<{ saved: boolean }>(`/content/${contentId}/save`);
  await refresh();
  return res.saved;
}

export type PickedFile = { uri: string; mime: string; size?: number };

/**
 * Subida en 3 pasos: (1) la API valida permisos y emite una URL firmada, (2) la app sube el archivo directo a
 * Supabase Storage, (3) la API verifica el archivo y lo enlaza al perfil o contenido.
 */
async function uploadMedia(
  kind: 'avatar' | 'thumbnail' | 'video',
  file: PickedFile,
  contentId?: string,
  onProgress?: (f: number) => void,
): Promise<void> {
  const target = await api.post<{ uploadUrl: string; path: string }>('/media/upload-url', {
    kind,
    contentId,
    mime: file.mime,
    size: file.size,
  });
  await putToSignedUrl(target.uploadUrl, file, onProgress);
  await api.post('/media/confirm', { kind, contentId, path: target.path });
  await refresh();
}

export const uploadAvatar = (file: PickedFile): Done => uploadMedia('avatar', file);
export const removeAvatar = (): Done => run(() => api.delete('/profiles/me/avatar'));

// ───────────── solicitud de creator ─────────────

export const submitCreatorApplication = (input: CreatorApplicationInput): Done =>
  run(() => api.post('/creator-applications', input));

export const reviewCreatorApplication = (
  id: string,
  decision: 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED',
  reason?: string,
): Done => run(() => api.patch(`/moderation/creator-applications/${id}`, { decision, reason }));

export const suspendCreator = (userId: string, reason: string): Done =>
  run(() => api.post(`/moderation/creators/${userId}/suspend`, { reason }));

export const reactivateCreator = (userId: string, reason: string): Done =>
  run(() => api.post(`/moderation/creators/${userId}/reactivate`, { reason }));

// ───────────── contenido ─────────────

export async function saveContent(input: ContentInput, id?: string): Promise<string> {
  const res = id
    ? await api.patch<{ id: string }>(`/content/${id}`, input)
    : await api.post<{ id: string }>('/content', input);
  await refresh();
  return res.id;
}

export const submitForReview = (id: string): Done => run(() => api.post(`/content/${id}/submit-review`));
export const publishContent = (id: string): Done => run(() => api.post(`/content/${id}/publish`));
export const archiveOwnContent = (id: string): Done => run(() => api.post(`/content/${id}/archive`));

export const moderateContent = (
  id: string,
  decision: 'APPROVED' | 'REJECTED' | 'ARCHIVED' | 'REMOVED',
  reason?: string,
): Done => run(() => api.patch(`/moderation/content/${id}`, { decision, reason }));

/** Registra una vista; si falla no molesta al usuario. */
export async function recordView(contentId: string): Done {
  try {
    await api.post(`/content/${contentId}/view`);
    await refresh();
  } catch {
    // Las vistas son informativas.
  }
}

/** Sube el video al backend (→ Supabase Storage). Solo para contenido propio en borrador/rechazado. */
export const uploadVideo = (contentId: string, file: PickedFile, onProgress?: (f: number) => void): Done =>
  uploadMedia('video', file, contentId, onProgress);

export const uploadThumbnail = (contentId: string, file: PickedFile): Done =>
  uploadMedia('thumbnail', file, contentId);

/** URL firmada y temporal para reproducir el video (el bucket es privado). */
export const getPlaybackUrl = (contentId: string): Promise<string> =>
  api.get<{ url: string }>(`/content/${contentId}/playback`).then((r) => r.url);

// ───────────── calificaciones ─────────────

export const upsertRating = (creatorId: string, stars: number, sub: SubRatings, comment?: string): Done =>
  run(() => api.post(`/creators/${creatorId}/ratings`, { stars, sub, comment }));

export const deleteMyRating = (creatorId: string): Done => run(() => api.delete(`/creators/${creatorId}/ratings/me`));

export const setRatingHidden = (ratingId: string, hidden: boolean, reason: string): Done =>
  run(() => api.patch(`/moderation/ratings/${ratingId}`, { hidden, reason }));

// ───────────── reportes y notificaciones ─────────────

export const createReport = (targetType: ReportTarget, targetId: string, reason: string): Done =>
  run(() => api.post('/reports', { targetType, targetId, reason }));

export const resolveReport = (id: string, status: 'RESOLVED' | 'DISMISSED', resolution: string): Done =>
  run(() => api.patch(`/moderation/reports/${id}`, { status, resolution }));

export const markNotificationRead = (id: string): Done => run(() => api.patch(`/notifications/${id}/read`));
export const markAllNotificationsRead = (): Done => run(() => api.post('/notifications/read-all'));

// ───────────── moderación de instituciones y administración ─────────────

export const reviewInstitutionRequest = (id: string, approve: boolean, reason?: string): Done =>
  run(() => api.patch(`/moderation/institution-requests/${id}`, { approve, reason }));

export const setAccountStatus = (userId: string, status: AccountStatus, reason: string): Done =>
  run(() => api.patch(`/admin/users/${userId}/status`, { status, reason }));

export const setUserRole = (
  userId: string,
  role: 'CREATOR' | 'MODERATOR' | 'ADMIN',
  grant: boolean,
  reason: string,
): Done => run(() => api.put(`/admin/users/${userId}/roles/${role}`, { grant, reason }));

export const setVerification = (userId: string, value: boolean | null, reason: string): Done =>
  run(() => api.patch(`/admin/users/${userId}/verification`, { value, reason }));

export const updateSettings = (patch: { verificationThreshold: number; minFollowDaysToRate: number }): Done =>
  run(() => api.patch('/admin/settings', patch));

export const softDeleteUser = (userId: string, reason: string): Done =>
  run(() => api.delete(`/admin/users/${userId}`, { reason }));

// ───────────── catálogo académico (administrador) ─────────────

async function create(path: string, body: unknown): Promise<string> {
  const res = await api.post<{ id: string }>(path, body);
  await refresh();
  return res.id;
}

export const createInstitution = (input: { name: string; city: string; country: string; domains: string[] }): Promise<string> =>
  create('/admin/catalog/institutions', input);
export const createFaculty = (input: { institutionId: string; name: string }): Promise<string> =>
  create('/admin/catalog/faculties', input);
export const createDegree = (input: { facultyId: string; name: string; description: string; semesters: number }): Promise<string> =>
  create('/admin/catalog/degrees', input);
export const createSubject = (input: {
  degreeId: string;
  semester: number;
  code: string;
  name: string;
  description: string;
  credits?: number;
}): Done => run(() => api.post('/admin/catalog/subjects', input));
export const deleteCatalogItem = (kind: 'institution' | 'faculty' | 'degree' | 'subject', id: string): Done =>
  run(() => api.delete(`/admin/catalog/${kind}/${id}`));
