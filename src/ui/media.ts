// Selección de archivos de la galería (foto de perfil, portada y video).
import * as ImagePicker from 'expo-image-picker';
import type { PickedFile } from '../store/actions';

const MB = 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * MB; // límite por archivo del plan gratuito de Supabase
export const MAX_IMAGE_BYTES = 5 * MB;

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
  webm: 'video/webm',
  '3gp': 'video/3gpp',
};

export type Picked = PickedFile & { size?: number; name: string; durationMs?: number };

function toPicked(asset: ImagePicker.ImagePickerAsset): Picked {
  const ext = (asset.fileName ?? asset.uri).split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  const mime = asset.mimeType ?? MIME_BY_EXT[ext] ?? '';
  return {
    uri: asset.uri,
    mime,
    size: asset.fileSize,
    name: asset.fileName ?? `archivo.${ext || 'bin'}`,
    durationMs: asset.duration ?? undefined,
  };
}

/** Elige una imagen (JPG, PNG o WebP, máx. 5 MB). `square` recorta en cuadrado (foto de perfil). */
export async function pickImage(square: boolean): Promise<Picked | null> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: square,
    aspect: square ? [1, 1] : undefined,
    quality: 0.8, // en iOS convierte HEIC a JPEG
  });
  if (res.canceled || !res.assets[0]) return null;
  const file = toPicked(res.assets[0]);
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mime)) {
    throw new Error('Formato de imagen no compatible. Usa JPG, PNG o WebP.');
  }
  if (file.size && file.size > MAX_IMAGE_BYTES) {
    throw new Error(`La imagen pesa ${(file.size / MB).toFixed(1)} MB y el máximo es 5 MB.`);
  }
  return file;
}

/** Elige un video (MP4, MOV, M4V, WebM o 3GP, máx. 50 MB). */
export async function pickVideo(): Promise<Picked | null> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['videos'],
    allowsEditing: false,
    videoExportPreset: ImagePicker.VideoExportPreset.MediumQuality,
  });
  if (res.canceled || !res.assets[0]) return null;
  const file = toPicked(res.assets[0]);
  if (!file.mime.startsWith('video/')) throw new Error('Elige un archivo de video.');
  if (file.size && file.size > MAX_VIDEO_BYTES) {
    throw new Error(
      `El video pesa ${(file.size / MB).toFixed(1)} MB y el máximo es 50 MB (límite del plan gratuito). Recórtalo o comprímelo.`,
    );
  }
  return file;
}
