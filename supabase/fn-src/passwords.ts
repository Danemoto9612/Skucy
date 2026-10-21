// Contraseñas: PBKDF2-SHA256 con sal aleatoria (WebCrypto, disponible en Deno, Node y navegadores).
const ITERATIONS = 600_000; // recomendación de OWASP para PBKDF2-HMAC-SHA256
const enc = new TextEncoder();

const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromB64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16)));
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toB64(salt)}$${toB64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iterations, salt, hash] = stored.split('$');
  if (scheme !== 'pbkdf2' || !iterations || !salt || !hash) return false;
  const expected = fromB64(hash);
  const actual = await derive(password, fromB64(salt), Number(iterations));
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i]; // comparación en tiempo constante
  return diff === 0;
}

let dummy: Promise<string> | null = null;
/** Gasta el mismo tiempo cuando el usuario no existe (evita revelar qué correos tienen cuenta). */
export async function burnPasswordCheck(password: string): Promise<void> {
  dummy ??= hashPassword('skucy-dummy-password');
  await verifyPassword(password, await dummy);
}

/** Devuelve el motivo si la contraseña no cumple la política, o null si es válida. */
export function passwordProblem(password: unknown): string | null {
  if (typeof password !== 'string' || password.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (password.length > 128) return 'La contraseña no puede superar 128 caracteres.';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'La contraseña debe incluir al menos una letra y un número.';
  return null;
}
