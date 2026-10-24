import { showAlert } from './alert';
import { can as canDo, type Permission } from '../../shared/permissions';
import type { User } from '../../shared/types';
import { sessionUser } from '../../shared/selectors';
import { useDb } from '../store/store';
import { setGuest } from '../store/ui';

/** Usuario actual (null = anónimo) y verificación de permisos. */
export function useSession(): { user: User | null; can: (p: Permission) => boolean } {
  const db = useDb();
  const user = sessionUser(db);
  return { user, can: (p) => canDo(user, p) };
}

/**
 * Ejecuta una acción (síncrona o async) mostrando los errores como alerta.
 * Devuelve una promesa con true si salió bien.
 */
export async function attempt<T>(fn: () => T | Promise<T>, onSuccess?: (result: T) => void): Promise<boolean> {
  try {
    const result = await fn();
    onSuccess?.(result);
    return true;
  } catch (e) {
    showAlert('No se pudo completar', e instanceof Error ? e.message : 'Ocurrió un error inesperado.');
    return false;
  }
}

/** Para usuarios anónimos: invita a iniciar sesión. */
export function requireLogin(user: User | null): boolean {
  if (user) return true;
  showAlert('Inicia sesión', 'Necesitas una cuenta institucional para hacer esto.', [
    { text: 'Cancelar', style: 'cancel' },
    // Salir del modo invitado devuelve al flujo de inicio de sesión.
    { text: 'Iniciar sesión', onPress: () => setGuest(false) },
  ]);
  return false;
}

export function confirm(title: string, message: string, onConfirm: () => void) {
  showAlert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Confirmar', onPress: onConfirm },
  ]);
}
