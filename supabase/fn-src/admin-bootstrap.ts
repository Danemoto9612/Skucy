// Única cuenta que existe al empezar: el administrador definido en ADMIN_EMAIL (secreto de la función).
// Entra con correo + contraseña (ADMIN_PASSWORD). Cambiar ADMIN_PASSWORD y volver a desplegar/usar la API restablece la clave.
import { createHmac } from 'node:crypto';
import { buildAdmin } from '../../shared/bootstrap';
import { env } from './http';
import { hashPassword } from './passwords';
import { mutateServer, readRaw } from './runtime';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Idempotente y barato: solo calcula un hash si falta la cuenta o cambió ADMIN_PASSWORD. */
export async function ensureAdmin(): Promise<void> {
  const email = env('ADMIN_EMAIL')?.toLowerCase();
  if (!email || !EMAIL_RE.test(email)) return;
  const password = env('ADMIN_PASSWORD');
  // Huella con clave (HMAC) para detectar cambios de ADMIN_PASSWORD sin repetir PBKDF2 en cada petición.
  const fp = password ? createHmac('sha256', env('JWT_SECRET') ?? 'skucy').update(password).digest('hex') : undefined;

  const existing = readRaw().users.find((u) => u.email === email);
  if (existing && (!password || existing.adminPwFp === fp)) return;
  if (!existing && !password) {
    // Sin contraseña no se puede entrar: se crea igual, pero hay que definir ADMIN_PASSWORD.
    mutateServer((d) => {
      d.users.push({ ...buildAdmin(d, email, env('ADMIN_NAME')), authProvider: 'password', emailVerified: true });
    });
    return;
  }
  if (existing && !existing.roles.includes('ADMIN')) return; // no se toca a un usuario común aunque coincida el correo
  const passwordHash = await hashPassword(password as string);
  mutateServer((d) => {
    let admin = d.users.find((u) => u.email === email);
    if (!admin) {
      admin = buildAdmin(d, email, env('ADMIN_NAME'));
      d.users.push(admin);
    }
    admin.authProvider = 'password';
    admin.emailVerified = true;
    admin.passwordHash = passwordHash;
    admin.adminPwFp = fp;
    admin.failedLogins = 0;
    admin.lockedUntil = undefined;
  });
}
