import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { completeMicrosoftRedirect } from '../src/api/microsoft';
import { loginWithIdToken } from '../src/store/actions';
import { Button, T } from '../src/ui/components';
import { colors, useTheme } from '../src/ui/theme';

// Nativo: entrega el código a la ventana de login y se cierra sola.
WebBrowser.maybeCompleteAuthSession();

const BUILD = 'login-redirect v4';
const win = globalThis as any;

function withTimeout<T>(promise: Promise<T>, label: string, ms = 20000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Se agotó el tiempo en el paso: ${label}.`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/** Navegación completa (recarga la página): no depende del enrutador; la sesión ya quedó guardada. */
const go = (path: string, params?: Record<string, string>) =>
  win.location.replace(params ? `${path}?${new win.URLSearchParams(params).toString()}` : path);

/**
 * Destino de la redirección de Microsoft (https://tu-app/auth o skucy://auth).
 * En web, aquí se canjea el código, se verifica la identidad en el servidor y se entra a la app o al registro.
 */
export default function AuthRedirect() {
  useTheme();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState('Leyendo la respuesta de Microsoft…');
  const started = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || started.current) return;
    started.current = true;
    (async () => {
      try {
        const idToken = await withTimeout(completeMicrosoftRedirect(), 'canjear el código con Microsoft');
        if (!idToken) {
          // Se abrió /auth sin un inicio de sesión en curso: no se redirige solo (evita bucles de recarga).
          setError('No hay un inicio de sesión en curso. Vuelve al inicio e inténtalo de nuevo.');
          return;
        }
        setStep('Verificando tu cuenta en Skucy…');
        const result = await withTimeout(loginWithIdToken(idToken), 'verificar tu cuenta en el servidor');
        setStep('Entrando…');
        if (result.kind === 'register') {
          go('/register', { email: result.email, institutionId: result.institutionId, registrationToken: result.registrationToken, method: result.method, name: result.name ?? '' });
        } else if (result.kind === 'institution_request') {
          go('/institution-request', { email: result.email, domain: result.domain });
        } else {
          go('/'); // sesión abierta: al recargar, el guard de rutas lleva a la app
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo completar el inicio de sesión.');
      }
    })();
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, backgroundColor: colors.canvas }}>
      {error ? (
        <>
          <T variant="h2">No se pudo iniciar sesión</T>
          <T variant="body" style={{ textAlign: 'center' }}>{error}</T>
          <Button title="Volver al inicio" onPress={() => go('/')} />
        </>
      ) : (
        <>
          <ActivityIndicator color={colors.primary} />
          <T variant="body">Completando inicio de sesión…</T>
          <T variant="caption" color={colors.charcoal}>{step}</T>
        </>
      )}
      <T variant="caption" color={colors.charcoal}>{BUILD}</T>
    </View>
  );
}
