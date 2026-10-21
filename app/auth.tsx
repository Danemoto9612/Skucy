import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { completeMicrosoftRedirect } from '../src/api/microsoft';
import { loginWithIdToken } from '../src/store/actions';
import { Button, T } from '../src/ui/components';
import { colors } from '../src/ui/theme';

// Nativo: entrega el código a la ventana de login y se cierra sola.
WebBrowser.maybeCompleteAuthSession();

/**
 * Destino de la redirección de Microsoft (https://tu-app/auth o skucy://auth).
 * En web, aquí se canjea el código, se verifica la identidad en el servidor y se entra a la app o al registro.
 */
export default function AuthRedirect() {
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || started.current) return;
    started.current = true;
    (async () => {
      try {
        const idToken = await completeMicrosoftRedirect();
        if (!idToken) return router.replace('/');
        const result = await loginWithIdToken(idToken);
        if (result.kind === 'register') {
          router.replace({
            pathname: '/register',
            params: { email: result.email, institutionId: result.institutionId, registrationToken: result.registrationToken, method: result.method, name: result.name ?? '' },
          });
        } else if (result.kind === 'institution_request') {
          router.replace({ pathname: '/institution-request', params: { email: result.email, domain: result.domain } });
        } else {
          router.replace('/'); // sesión abierta: el guard de rutas lleva a la app
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
          <Button title="Volver al inicio" onPress={() => router.replace('/')} />
        </>
      ) : (
        <>
          <ActivityIndicator color={colors.primary} />
          <T variant="body">Completando inicio de sesión…</T>
        </>
      )}
    </View>
  );
}
