// Punto de entrada HTTP independiente de la plataforma: (Request) → Response.
// En Supabase lo invoca Deno.serve (index.ts); las pruebas lo invocan directamente.
import type { SupabaseClient } from '@supabase/supabase-js';
import { ensureAdmin } from './admin-bootstrap';
import { verifyAccess } from './auth';
import type { Backend } from './backend';
import { HttpError, statusForDomainError } from './http';
import { runRequest, StorageWriteError } from './runtime';
import { authorize, findRoute } from './routes';

export interface Deps {
  backend: () => Backend;
  storage: () => SupabaseClient;
}

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

// Límite de peticiones por IP (por instancia de la función; protege lo básico).
const buckets = new Map<string, { count: number; resetAt: number }>();
function limited(key: string, limit: number, windowMs = 60_000): boolean {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.resetAt < now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  if (buckets.size > 5000) for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
  return b.count > limit;
}

/** `/functions/v1/api/sync`, `/api/sync` o `/sync` → `/sync`. */
export function routePath(url: URL): string {
  const i = url.pathname.indexOf('/api');
  let p = i >= 0 ? url.pathname.slice(i + 4) : url.pathname;
  if (p.startsWith('/v1/')) p = p.slice(3); // tolera la base antigua /api/v1
  return p === '' ? '/' : p.replace(/\/+$/, '') || '/';
}

export function createHandler(deps: Deps) {
  return async function handle(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(req.url);
    const path = routePath(url);

    if (path === '/health') return json(200, { status: 'ok', time: new Date().toISOString() });

    const ip = (req.headers.get('x-forwarded-for') ?? 'local').split(',')[0].trim();
    if (limited(`${ip}:*`, 600) || (path.startsWith('/auth') && limited(`${ip}:auth`, 120))) {
      return json(429, { statusCode: 429, message: 'Demasiadas solicitudes. Intenta de nuevo en un momento.' });
    }

    const found = findRoute(req.method, path);
    if (!found) return json(404, { statusCode: 404, message: 'Ruta no encontrada.' });
    if (found === 'method') return json(405, { statusCode: 405, message: 'Método no permitido.' });

    let body: any = undefined;
    if (req.method !== 'GET') {
      const text = await req.text();
      if (text) {
        try {
          body = JSON.parse(text);
        } catch {
          return json(400, { statusCode: 400, message: 'El cuerpo de la petición no es JSON válido.' });
        }
      }
    }

    try {
      const result = await runRequest(deps.backend(), async (setActor) => {
        await ensureAdmin();
        const header = req.headers.get('authorization') ?? '';
        const token = header.startsWith('Bearer ') ? header.slice(7) : '';
        setActor(token ? verifyAccess(token) : null);
        authorize(found.route);
        return found.route.run({ params: found.params, body, client: deps.storage });
      });
      return json(200, result ?? { ok: true });
    } catch (e) {
      if (e instanceof HttpError) return json(e.status, { statusCode: e.status, message: e.message });
      if (e instanceof StorageWriteError) return json(503, { statusCode: 503, message: e.message });
      // Error "plano" del dominio = regla de negocio; subclases (TypeError…) = bug.
      if (e instanceof Error && e.constructor === Error) {
        const status = statusForDomainError(e.message);
        return json(status, { statusCode: status, message: e.message });
      }
      console.error(e instanceof Error ? (e.stack ?? e.message) : String(e));
      return json(500, { statusCode: 500, message: 'Error interno del servidor.' });
    }
  };
}
