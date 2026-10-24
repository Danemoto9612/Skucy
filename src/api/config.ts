/**
 * URL base de la API (Supabase Edge Function). Se define en `.env` (o en las variables de Vercel):
 *   EXPO_PUBLIC_API_URL=https://<project-ref>.supabase.co/functions/v1/api
 */
export function apiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  return fromEnv ? fromEnv.replace(/\/$/, '') : '';
}
