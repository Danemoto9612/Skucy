// Archivos en Supabase Storage. El archivo NO pasa por la función: la app lo sube directo al bucket con una
// URL firmada que esta función emite solo si el usuario tiene permiso; después la app "confirma" la subida y
// la función verifica que el objeto exista y cumpla el tamaño antes de enlazarlo al perfil o contenido.
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  attachThumbnail,
  attachVideo,
  editableOwnContent,
  finishProcessing,
  setAvatar,
} from '../../shared/actions';
import { getState } from '../../shared/engine';
import { can } from '../../shared/permissions';
import { contentAccess, sessionUser } from '../../shared/selectors';
import { HttpError } from './http';
import { readRaw } from './runtime';

export type Bucket = 'avatars' | 'thumbnails' | 'videos';
export type MediaKind = 'avatar' | 'thumbnail' | 'video';

const MB = 1024 * 1024;

export const BUCKETS: Record<Bucket, { maxBytes: number; mimes: string[] }> = {
  avatars: { maxBytes: 5 * MB, mimes: ['image/jpeg', 'image/png', 'image/webp'] },
  thumbnails: { maxBytes: 5 * MB, mimes: ['image/jpeg', 'image/png', 'image/webp'] },
  // El plan gratuito de Supabase limita cada archivo a 50 MB.
  videos: { maxBytes: 50 * MB, mimes: ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v', 'video/3gpp'] },
};

const BUCKET_OF: Record<MediaKind, Bucket> = { avatar: 'avatars', thumbnail: 'thumbnails', video: 'videos' };

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/x-m4v': 'm4v',
  'video/3gpp': '3gp',
};

export const SIGNED_URL_SECONDS = 60 * 60;

function bucketOf(kind: unknown): { kind: MediaKind; bucket: Bucket } {
  if (kind !== 'avatar' && kind !== 'thumbnail' && kind !== 'video') throw new HttpError(400, 'Tipo de archivo inválido.');
  return { kind, bucket: BUCKET_OF[kind] };
}

/** Carpeta del objeto según el dueño; valida permisos y estado del contenido. */
function folderFor(kind: MediaKind, contentId?: string): string {
  const me = sessionUser(getState());
  if (!me) throw new HttpError(401, 'Debes iniciar sesión para hacer esto.');
  if (kind === 'avatar') {
    if (!can(me, 'profile:edit_own')) throw new HttpError(403, 'No tienes permiso para realizar esta acción.');
    return me.id;
  }
  if (!contentId) throw new HttpError(400, 'Falta el contenido.');
  const content = editableOwnContent(contentId); // lanza si no es tuyo o ya no se puede editar
  return `${content.creatorId}/${content.id}`;
}

export async function createUpload(
  client: SupabaseClient,
  input: { kind: unknown; contentId?: string; mime?: string; size?: number },
): Promise<{ uploadUrl: string; path: string; bucket: Bucket; maxBytes: number }> {
  const { kind, bucket } = bucketOf(input.kind);
  const cfg = BUCKETS[bucket];
  const mime = (input.mime ?? '').split(';')[0].trim().toLowerCase();
  if (!cfg.mimes.includes(mime)) {
    throw new HttpError(400, `Formato no permitido. Usa: ${cfg.mimes.map((m) => m.split('/')[1]).join(', ')}.`);
  }
  if (typeof input.size === 'number' && input.size > cfg.maxBytes) {
    throw new HttpError(413, `El archivo pesa ${(input.size / MB).toFixed(1)} MB y el máximo es ${cfg.maxBytes / MB} MB.`);
  }
  const folder = folderFor(kind, input.contentId);
  const path = `${folder}/${crypto.randomUUID()}.${EXT[mime]}`;
  const { data, error } = await client.storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) throw new HttpError(502, `No se pudo preparar la subida en Supabase: ${error?.message ?? 'sin respuesta'}`);
  return { uploadUrl: data.signedUrl, path, bucket, maxBytes: cfg.maxBytes };
}

async function objectInfo(client: SupabaseClient, bucket: Bucket, path: string) {
  const slash = path.lastIndexOf('/');
  const name = path.slice(slash + 1);
  const { data, error } = await client.storage.from(bucket).list(path.slice(0, slash), { limit: 20, search: name });
  if (error) throw new HttpError(502, `No se pudo consultar Supabase Storage: ${error.message}`);
  const file = data?.find((f: { name: string; metadata?: unknown }) => f.name === name);
  if (!file) return null;
  const meta = (file.metadata ?? {}) as { size?: number; mimetype?: string };
  return { size: Number(meta.size ?? 0), mime: String(meta.mimetype ?? '') };
}

export function publicUrl(client: SupabaseClient, bucket: Bucket, path: string): string {
  return client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

async function remove(client: SupabaseClient, bucket: Bucket, path: string | undefined) {
  if (!path) return;
  await client.storage.from(bucket).remove([path]).catch(() => undefined); // un fallo solo deja un archivo huérfano
}

/** Paso final de la subida: verifica el objeto y lo enlaza al perfil o contenido. */
export async function confirmUpload(
  client: SupabaseClient,
  input: { kind: unknown; contentId?: string; path?: string },
): Promise<Record<string, unknown>> {
  const { kind, bucket } = bucketOf(input.kind);
  const path = input.path ?? '';
  const folder = folderFor(kind, input.contentId);
  if (!path.startsWith(`${folder}/`) || path.includes('..')) throw new HttpError(403, 'Ese archivo no te pertenece.');
  const info = await objectInfo(client, bucket, path);
  if (!info) throw new HttpError(400, 'El archivo no llegó a Supabase. Intenta subirlo de nuevo.');
  const cfg = BUCKETS[bucket];
  if (info.size > cfg.maxBytes) {
    await remove(client, bucket, path);
    throw new HttpError(413, `El archivo pesa ${(info.size / MB).toFixed(1)} MB y el máximo es ${cfg.maxBytes / MB} MB.`);
  }
  if (info.mime && !cfg.mimes.includes(info.mime.toLowerCase())) {
    await remove(client, bucket, path);
    throw new HttpError(400, 'Formato no permitido.');
  }

  const me = sessionUser(getState())!;
  if (kind === 'avatar') {
    const previous = readRaw().users.find((u) => u.id === me.id)?.avatarPath;
    const url = publicUrl(client, bucket, path);
    setAvatar({ url, path });
    if (previous !== path) await remove(client, bucket, previous);
    return { avatarUrl: url };
  }
  const content = editableOwnContent(input.contentId!);
  if (kind === 'thumbnail') {
    const previous = content.thumbnailPath;
    const url = publicUrl(client, bucket, path);
    attachThumbnail(content.id, { path, url });
    if (previous !== path) await remove(client, bucket, previous);
    return { thumbnailUrl: url };
  }
  const previous = content.videoPath;
  attachVideo(content.id, { path, mime: info.mime || 'video/mp4', sizeBytes: info.size });
  if (previous !== path) await remove(client, bucket, previous);
  return { sizeBytes: info.size };
}

export async function removeAvatar(client: SupabaseClient): Promise<void> {
  const me = sessionUser(getState());
  if (!me) throw new HttpError(401, 'Debes iniciar sesión para hacer esto.');
  const previous = readRaw().users.find((u) => u.id === me.id)?.avatarPath;
  setAvatar(null);
  await remove(client, 'avatars', previous);
}

/** URL firmada y temporal del video, solo si el usuario tiene acceso al contenido. */
export async function playbackUrl(client: SupabaseClient, contentId: string): Promise<{ url: string; expiresIn: number }> {
  const db = getState();
  const content = db.contents.find((c) => c.id === contentId);
  if (!content || !content.videoPath) throw new HttpError(404, 'Video no encontrado.');
  const access = contentAccess(db, content, sessionUser(db));
  if (!access.ok) throw new HttpError(403, access.reason ?? 'Sin acceso a este contenido.');
  const { data, error } = await client.storage.from('videos').createSignedUrl(content.videoPath, SIGNED_URL_SECONDS);
  if (error || !data) throw new HttpError(404, 'No se pudo preparar el video.');
  return { url: data.signedUrl, expiresIn: SIGNED_URL_SECONDS };
}

/** Paso final del envío a revisión: confirma que el video sigue en Storage. */
export async function processContent(client: SupabaseClient, contentId: string): Promise<void> {
  const content = readRaw().contents.find((c) => c.id === contentId);
  if (!content || content.status !== 'PROCESSING') return;
  if (content.type !== 'VIDEO') {
    finishProcessing(contentId, { ok: true });
    return;
  }
  const found = content.videoPath ? await objectInfo(client, 'videos', content.videoPath) : null;
  finishProcessing(
    contentId,
    found ? { ok: true } : { ok: false, error: 'El video no se encontró en el almacenamiento. Súbelo de nuevo.' },
  );
}
