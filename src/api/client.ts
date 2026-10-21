import { apiBaseUrl } from './config';
import { readTokens, writeTokens, type StoredTokens } from './tokens';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export class NetworkError extends Error {}

let tokens: StoredTokens | null = null;
let refreshing: Promise<boolean> | null = null;
let onSessionLost: (() => void) | null = null;

export function setSessionLostHandler(fn: () => void) {
  onSessionLost = fn;
}

export async function loadTokens() {
  tokens = await readTokens();
}

export async function setTokens(next: StoredTokens | null) {
  tokens = next;
  await writeTokens(next);
}

export const getRefreshToken = () => tokens?.refreshToken ?? null;
export const hasTokens = () => tokens !== null;

async function rawFetch(method: string, path: string, body: unknown, withAuth: boolean): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    return await fetch(`${apiBaseUrl()}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(withAuth && tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new NetworkError(
      `No se pudo conectar con el servidor (${apiBaseUrl()}). Verifica que el backend esté corriendo.`,
    );
  } finally {
    clearTimeout(timer);
  }
}

async function tryRefresh(): Promise<boolean> {
  if (!tokens) return false;
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await rawFetch('POST', '/auth/refresh', { refreshToken: tokens?.refreshToken }, false);
        if (!res.ok) throw new Error('refresh failed');
        const next = (await res.json()) as StoredTokens;
        await setTokens({ accessToken: next.accessToken, refreshToken: next.refreshToken });
        return true;
      } catch (e) {
        if (e instanceof NetworkError) return false; // sin red: no se pierde la sesión
        await setTokens(null);
        onSessionLost?.();
        return false;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

export async function request<T>(method: string, path: string, body?: unknown, withAuth = true): Promise<T> {
  let res = await rawFetch(method, path, body, withAuth);
  if (res.status === 401 && withAuth && tokens && (await tryRefresh())) {
    res = await rawFetch(method, path, body, withAuth);
  }
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new ApiError(data?.message ?? `Error ${res.status}`, res.status);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, withAuth = true) => request<T>('GET', path, undefined, withAuth),
  post: <T>(path: string, body?: unknown, withAuth = true) => request<T>('POST', path, body ?? {}, withAuth),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body ?? {}),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body ?? {}),
  delete: <T>(path: string, body?: unknown) => request<T>('DELETE', path, body ?? {}),
};

/**
 * Sube un archivo directo a Supabase Storage con una URL firmada (emitida por la API tras validar permisos).
 * El cuerpo de la petición ES el archivo. Usa XMLHttpRequest para informar el progreso.
 */
export async function putToSignedUrl(
  url: string,
  file: { uri: string; mime: string },
  onProgress?: (fraction: number) => void,
): Promise<void> {
  const blob = await (await fetch(file.uri)).blob();
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.mime);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.timeout = 10 * 60 * 1000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      let message = `Error ${xhr.status} al subir el archivo.`;
      try {
        message = JSON.parse(xhr.responseText)?.message ?? message;
      } catch {
        // respuesta sin JSON
      }
      reject(new ApiError(message, xhr.status));
    };
    const fail = () => reject(new NetworkError('No se pudo subir el archivo. Revisa tu conexión.'));
    xhr.onerror = fail;
    xhr.ontimeout = fail;
    xhr.send(blob);
  });
}
