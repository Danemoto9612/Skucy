// Inicio de sesión REAL con Microsoft Entra ID (cuentas escolares/laborales de Microsoft 365).
// La app obtiene un ID token con OAuth2 (código + PKCE); aquí se VERIFICA: firma RS256 con las claves públicas de
// Microsoft, emisor, audiencia (nuestro Client ID), vigencia y nonce firmado por esta API.
import { env, HttpError } from './http';
import { signToken, verifyToken } from './tokens';

/** Tenant fijo de las cuentas personales de Microsoft (outlook/hotmail): no son cuentas institucionales. */
const PERSONAL_TENANT = '9188040d-6c67-4c5b-b112-36a304b66dad';
const JWKS_URL = 'https://login.microsoftonline.com/common/discovery/v2.0/keys';
const NONCE_TTL_SECONDS = 10 * 60;
const MAX_TOKEN_AGE_SECONDS = 15 * 60;
const CLOCK_SKEW_SECONDS = 120;

export const msDeps = { fetch: (url: string) => fetch(url) };

export interface MicrosoftIdentity {
  email: string;
  name: string;
  /** Identidad estable: `tenantId:objectId`. Es lo que identifica a la persona, no el correo. */
  msKey: string;
}

function secret(): string {
  const value = env('JWT_SECRET');
  if (!value || value.length < 16) throw new HttpError(500, 'Falta el secreto JWT_SECRET en la función.');
  return value;
}

export function clientId(): string | undefined {
  return env('MS_CLIENT_ID');
}

/** Datos públicos que la app necesita para iniciar el flujo; incluye un nonce firmado de un solo propósito. */
export function microsoftConfig() {
  const id = clientId();
  return {
    enabled: !!id,
    clientId: id ?? '',
    authorizeUrl: 'https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/organizations/oauth2/v2.0/token',
    nonce: signToken({ typ: 'nonce' }, NONCE_TTL_SECONDS, secret()),
  };
}

const b64urlJson = (part: string) => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(part.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))));
const b64urlBytes = (part: string) => Uint8Array.from(atob(part.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

let jwks: { keys: any[]; at: number } | null = null;

async function signingKey(kid: string): Promise<CryptoKey> {
  const find = () => jwks?.keys.find((k) => k.kid === kid);
  if (!jwks || Date.now() - jwks.at > 60 * 60 * 1000 || !find()) {
    // Se (re)descargan las claves si pasó una hora o llegó un `kid` desconocido (rotación de claves).
    const res = await msDeps.fetch(JWKS_URL);
    if (!res.ok) throw new HttpError(502, 'No se pudieron obtener las claves de Microsoft. Intenta de nuevo.');
    jwks = { keys: ((await res.json()) as { keys: any[] }).keys ?? [], at: Date.now() };
  }
  const jwk = find();
  if (!jwk) throw new HttpError(401, 'Token de Microsoft inválido.');
  return crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
}

export async function verifyMicrosoftIdToken(idToken: unknown): Promise<MicrosoftIdentity> {
  const audience = clientId();
  if (!audience) throw new HttpError(503, 'El inicio de sesión con Microsoft no está configurado (falta MS_CLIENT_ID).');
  const invalid = () => new HttpError(401, 'No se pudo verificar tu cuenta de Microsoft. Intenta de nuevo.');
  if (typeof idToken !== 'string') throw invalid();
  const parts = idToken.split('.');
  if (parts.length !== 3) throw invalid();

  let header: any;
  let claims: any;
  try {
    header = b64urlJson(parts[0]);
    claims = b64urlJson(parts[1]);
  } catch {
    throw invalid();
  }
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw invalid();

  const key = await signingKey(header.kid);
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    b64urlBytes(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  if (!valid) throw invalid();

  const now = Math.floor(Date.now() / 1000);
  const issuer = /^https:\/\/login\.microsoftonline\.com\/([0-9a-f-]{36})\/v2\.0$/i.exec(String(claims.iss ?? ''));
  if (!issuer || String(claims.tid ?? '').toLowerCase() !== issuer[1].toLowerCase()) throw invalid();
  if (claims.aud !== audience) throw invalid();
  if (typeof claims.exp !== 'number' || claims.exp < now - CLOCK_SKEW_SECONDS) throw invalid();
  if (typeof claims.nbf === 'number' && claims.nbf > now + CLOCK_SKEW_SECONDS) throw invalid();
  if (typeof claims.iat !== 'number' || now - claims.iat > MAX_TOKEN_AGE_SECONDS) {
    throw new HttpError(401, 'La sesión de Microsoft expiró. Intenta de nuevo.');
  }
  const nonce = verifyToken(String(claims.nonce ?? ''), secret());
  if (!nonce || nonce.typ !== 'nonce') throw new HttpError(401, 'La sesión de Microsoft expiró. Intenta de nuevo.');

  const tid = String(claims.tid).toLowerCase();
  if (tid === PERSONAL_TENANT) {
    throw new HttpError(403, 'Solo se permiten cuentas institucionales de Microsoft 365 (no cuentas personales).');
  }
  if (typeof claims.oid !== 'string' || !claims.oid) throw invalid();

  // `preferred_username` es el UPN (su dominio lo verifica la organización); `email` es opcional y editable.
  const email = String(claims.preferred_username ?? claims.email ?? claims.upn ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, 'Tu cuenta de Microsoft no tiene un correo asociado.');
  }
  return { email, name: String(claims.name ?? '').trim(), msKey: `${tid}:${String(claims.oid).toLowerCase()}` };
}
