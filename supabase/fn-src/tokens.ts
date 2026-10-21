// Tokens firmados con HMAC-SHA256 (sin dependencias externas).
import { Buffer } from 'node:buffer';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const b64 = (input: Buffer | string) => Buffer.from(input).toString('base64url');

export interface TokenPayload {
  typ: 'access' | 'registration' | 'nonce';
  sub?: string;
  /** Registro con Microsoft: identidad verificada (`tid:oid`). Ausente en registros manuales. */
  ms?: string;
  email?: string;
  institutionId?: string;
  iat: number;
  exp: number;
}

export function signToken(
  payload: Omit<TokenPayload, 'iat' | 'exp'>,
  ttlSeconds: number,
  secret: string,
): string {
  const now = Math.floor(Date.now() / 1000);
  const body = b64(JSON.stringify({ ...payload, iat: now, exp: now + ttlSeconds }));
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyToken(token: string, secret: string): TokenPayload | null {
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = createHmac('sha256', secret).update(body).digest();
  let given: Buffer;
  try {
    given = Buffer.from(sig, 'base64url');
  } catch {
    return null;
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as TokenPayload;
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
