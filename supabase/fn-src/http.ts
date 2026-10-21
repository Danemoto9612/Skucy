// Errores HTTP y traducción de los errores de negocio del dominio.
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Los errores de negocio del dominio son `Error` planos con mensaje en español. */
export function statusForDomainError(message: string): number {
  if (message.startsWith('Debes iniciar sesión')) return 401;
  if (
    message.startsWith('No tienes permiso') ||
    message.startsWith('Solo un administrador') ||
    message.startsWith('Solo los creators') ||
    message.startsWith('Tu cuenta de creator está suspendida')
  ) {
    return 403;
  }
  if (/no encontrad/i.test(message)) return 404;
  return 400;
}

export function env(name: string): string | undefined {
  const g = globalThis as any;
  const value = g.Deno?.env?.get?.(name) ?? g.process?.env?.[name];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
