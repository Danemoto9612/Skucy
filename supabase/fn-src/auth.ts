// Autenticación: Microsoft Entra ID real (ID token verificado), correo + contraseña, y tokens propios (access 15 min, refresh rotativo).
import { randomBytes } from 'node:crypto';
import { checkInstitutionalEmail, completeRegistration, type RegistrationInput } from '../../shared/actions';
import { env, HttpError } from './http';
import { verifyMicrosoftIdToken } from './microsoft';
import { burnPasswordCheck, hashPassword, passwordProblem, verifyPassword } from './passwords';
import { currentActorId, mutateServer, readRaw } from './runtime';
import { hashToken, signToken, verifyToken } from './tokens';

const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_DAYS = 30;
const REGISTRATION_TTL_SECONDS = 10 * 60;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export type LoginResponse =
  | ({ kind: 'ok' } & TokenPair)
  | { kind: 'register'; email: string; institutionId: string; registrationToken: string; name?: string; method: 'microsoft' | 'password' }
  | { kind: 'institution_request'; email: string; domain: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

function secret(): string {
  const value = env('JWT_SECRET');
  if (!value || value.length < 16) {
    throw new HttpError(500, 'Falta el secreto JWT_SECRET en la función (supabase secrets set JWT_SECRET=...).');
  }
  return value;
}

function activeUserByEmail(email: string) {
  return readRaw().users.find((u) => u.email === email && !u.deletedAt);
}

function assertNotBanned(status: string) {
  if (status === 'BANNED') throw new HttpError(403, 'Tu cuenta fue bloqueada. Contacta a un administrador.');
}

/** Registro: token firmado que prueba qué correo se validó y (si fue con Microsoft) con qué identidad. */
function registrationResponse(email: string, institutionId: string, ms?: string, name?: string): LoginResponse {
  const registrationToken = signToken(
    { typ: 'registration', email, institutionId, ...(ms ? { ms } : {}) },
    REGISTRATION_TTL_SECONDS,
    secret(),
  );
  return { kind: 'register', email, institutionId, registrationToken, name, method: ms ? 'microsoft' : 'password' };
}

// ───────────── Microsoft 365 (real) ─────────────

/** Inicia sesión (o inicia el registro) con un ID token de Microsoft Entra ID verificado en el servidor. */
export async function microsoftLogin(body: { idToken?: string }): Promise<LoginResponse> {
  const identity = await verifyMicrosoftIdToken(body?.idToken);
  const users = readRaw().users;

  // 1) Ya vinculado a esta identidad de Microsoft.
  const linked = users.find((u) => u.msKey === identity.msKey && !u.deletedAt);
  if (linked) {
    assertNotBanned(linked.status);
    return { kind: 'ok', ...issueTokens(linked.id) };
  }

  // 2) El correo ya tiene cuenta.
  const existing = activeUserByEmail(identity.email);
  if (existing) {
    if (existing.msKey) throw new HttpError(403, 'Este correo ya está vinculado a otra cuenta de Microsoft.');
    // Cuenta creada con contraseña (correo SIN verificar): quien demuestra con Microsoft que es el dueño real
    // del correo la reclama. Solo si es una cuenta común (rol Viewer) para no secuestrar cuentas con privilegios.
    const plain = existing.roles.length === 1 && existing.roles[0] === 'VIEWER';
    if (!plain) {
      throw new HttpError(403, 'Esta cuenta tiene permisos especiales: entra con tu correo y contraseña.');
    }
    assertNotBanned(existing.status);
    mutateServer((d) => {
      const u = d.users.find((x) => x.id === existing.id)!;
      u.msKey = identity.msKey;
      u.authProvider = 'microsoft';
      u.emailVerified = true;
      u.passwordHash = undefined;
      u.failedLogins = 0;
      u.lockedUntil = undefined;
      d.refreshTokens.forEach((t) => {
        if (t.userId === u.id && !t.revokedAt) t.revokedAt = new Date().toISOString(); // cierra sesiones anteriores
      });
    });
    return { kind: 'ok', ...issueTokens(existing.id) };
  }

  // 3) Cuenta nueva: el dominio decide la institución.
  const check = checkInstitutionalEmail(identity.email);
  if (!check.institutionId) return { kind: 'institution_request', email: check.email, domain: check.domain };
  return registrationResponse(check.email, check.institutionId, identity.msKey, identity.name || undefined);
}

// ───────────── correo + contraseña ─────────────

export async function passwordLogin(body: { email?: string; password?: string }): Promise<LoginResponse> {
  const email = String(body?.email ?? '').trim().toLowerCase();
  const password = String(body?.password ?? '');
  if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Ingresa un correo válido.');
  if (!password) throw new HttpError(400, 'Ingresa tu contraseña.');
  const generic = new HttpError(401, 'Correo o contraseña incorrectos.');

  const user = activeUserByEmail(email);
  if (!user || !user.passwordHash) {
    await burnPasswordCheck(password);
    if (user?.msKey) throw new HttpError(401, 'Esta cuenta se creó con Microsoft 365. Usa el botón de Microsoft.');
    throw generic;
  }
  if (user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) {
    const minutes = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 60000);
    throw new HttpError(429, `Demasiados intentos fallidos. Intenta de nuevo en ${minutes} min.`);
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    mutateServer((d) => {
      const u = d.users.find((x) => x.id === user.id)!;
      u.failedLogins = (u.failedLogins ?? 0) + 1;
      if (u.failedLogins >= MAX_FAILED_LOGINS) {
        u.failedLogins = 0;
        u.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60000).toISOString();
      }
    });
    throw generic;
  }
  assertNotBanned(user.status);
  if (user.failedLogins || user.lockedUntil) {
    mutateServer((d) => {
      const u = d.users.find((x) => x.id === user.id)!;
      u.failedLogins = 0;
      u.lockedUntil = undefined;
    });
  }
  return { kind: 'ok', ...issueTokens(user.id) };
}

/** Paso 1 del registro manual: valida que el correo sea institucional y esté libre. */
export function registerStart(body: { email?: string }): LoginResponse {
  const check = checkInstitutionalEmail(String(body?.email ?? ''));
  if (activeUserByEmail(check.email)) {
    throw new HttpError(409, 'Ya existe una cuenta con este correo. Inicia sesión.');
  }
  if (!check.institutionId) return { kind: 'institution_request', email: check.email, domain: check.domain };
  return registrationResponse(check.email, check.institutionId);
}

/** Paso final del registro (con Microsoft o manual). El manual exige crear una contraseña. */
export async function register(
  body: Omit<RegistrationInput, 'email' | 'institutionId' | 'credentials'> & { registrationToken: string; password?: string },
): Promise<TokenPair> {
  const payload = verifyToken(body.registrationToken ?? '', secret());
  if (!payload || payload.typ !== 'registration' || !payload.email || !payload.institutionId) {
    throw new HttpError(401, 'La sesión de registro expiró. Vuelve a empezar.');
  }
  let credentials: RegistrationInput['credentials'];
  if (payload.ms) {
    if (readRaw().users.some((u) => u.msKey === payload.ms)) throw new HttpError(409, 'Esta cuenta de Microsoft ya está registrada.');
    credentials = { provider: 'microsoft', msKey: payload.ms };
  } else {
    const problem = passwordProblem(body.password);
    if (problem) throw new HttpError(400, problem);
    credentials = { provider: 'password', passwordHash: await hashPassword(body.password as string) };
  }
  const userId = completeRegistration({
    email: payload.email,
    institutionId: payload.institutionId,
    name: body.name,
    bio: body.bio ?? '',
    degreeId: body.degreeId,
    semester: Number(body.semester),
    credentials,
  });
  return issueTokens(userId);
}

/** Id del usuario dueño del access token, o null si no es válido. */
export function verifyAccess(token: string): string | null {
  const payload = verifyToken(token, secret());
  if (!payload || payload.typ !== 'access' || !payload.sub) return null;
  const user = readRaw().users.find((u) => u.id === payload.sub);
  if (!user || user.deletedAt || user.status === 'BANNED') return null;
  return user.id;
}

/** Refresh rotativo: cada uso entrega uno nuevo; reutilizar uno viejo revoca toda la familia. */
export function refresh(refreshToken: string): TokenPair {
  const hash = hashToken(refreshToken ?? '');
  const record = readRaw().refreshTokens.find((t) => t.hash === hash);
  if (!record) throw new HttpError(401, 'Sesión inválida.');
  if (record.revokedAt) {
    revokeFamily(record.familyId);
    throw new HttpError(401, 'Sesión inválida.');
  }
  if (new Date(record.expiresAt).getTime() < Date.now()) throw new HttpError(401, 'La sesión expiró.');
  const user = readRaw().users.find((u) => u.id === record.userId);
  if (!user || user.deletedAt || user.status === 'BANNED') throw new HttpError(401, 'Cuenta no disponible.');
  mutateServer((d) => {
    const r = d.refreshTokens.find((t) => t.id === record.id);
    if (r) r.revokedAt = new Date().toISOString();
  });
  return issueTokens(record.userId, record.familyId);
}

export function logout(refreshToken: string) {
  const record = readRaw().refreshTokens.find((t) => t.hash === hashToken(refreshToken ?? ''));
  if (record) revokeFamily(record.familyId);
}

export function me() {
  const user = readRaw().users.find((u) => u.id === currentActorId());
  return { id: user?.id, handle: user?.handle, name: user?.name, email: user?.email, roles: user?.roles, status: user?.status };
}

function revokeFamily(familyId: string) {
  mutateServer((d) => {
    const now = new Date().toISOString();
    d.refreshTokens.forEach((t) => {
      if (t.familyId === familyId && !t.revokedAt) t.revokedAt = now;
    });
  });
}

function issueTokens(userId: string, familyId?: string): TokenPair {
  const refreshToken = randomBytes(32).toString('base64url');
  mutateServer((d) => {
    const now = Date.now();
    d.refreshTokens = d.refreshTokens.filter((t) => new Date(t.expiresAt).getTime() > now);
    d.refreshTokens.push({
      id: randomBytes(8).toString('hex'),
      userId,
      familyId: familyId ?? randomBytes(8).toString('hex'),
      hash: hashToken(refreshToken),
      expiresAt: new Date(now + REFRESH_TTL_DAYS * 86400000).toISOString(),
    });
  });
  return {
    accessToken: signToken({ typ: 'access', sub: userId }, ACCESS_TTL_SECONDS, secret()),
    refreshToken,
    expiresIn: ACCESS_TTL_SECONDS,
  };
}

