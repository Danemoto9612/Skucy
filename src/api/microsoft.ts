// Inicio de sesión con Microsoft 365 (Microsoft Entra ID): OAuth2 código de autorización + PKCE.
// La app NUNCA ve la contraseña de Microsoft: se la escribes a Microsoft en su propia página. La app recibe un
// ID token que el servidor (Edge Function) verifica criptográficamente antes de dar acceso.
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { api } from './client';

// Necesario en web: cuando Microsoft redirige de vuelta a /auth, cierra la ventana emergente y entrega el código.
WebBrowser.maybeCompleteAuthSession();

export class MicrosoftCancelled extends Error {}

interface MicrosoftConfig {
  enabled: boolean;
  clientId: string;
  authorizeUrl: string;
  tokenUrl: string;
  nonce: string;
}

/** Devuelve un ID token de Microsoft listo para enviar al servidor. */
export async function getMicrosoftIdToken(): Promise<string> {
  const config = await api.get<MicrosoftConfig>('/auth/microsoft/config', false);
  if (!config.enabled) {
    throw new Error('El inicio de sesión con Microsoft aún no está configurado en el servidor. Usa tu correo y contraseña.');
  }
  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'skucy', path: 'auth' });
  const discovery = { authorizationEndpoint: config.authorizeUrl, tokenEndpoint: config.tokenUrl };

  const request = new AuthSession.AuthRequest({
    clientId: config.clientId,
    redirectUri,
    scopes: ['openid', 'profile', 'email'],
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
    extraParams: { nonce: config.nonce, prompt: 'select_account' },
  });
  await request.makeAuthUrlAsync(discovery);
  const result = await request.promptAsync(discovery);

  if (result.type === 'cancel' || result.type === 'dismiss') throw new MicrosoftCancelled();
  if (result.type !== 'success') {
    const detail = result.type === 'error' ? result.params?.error_description || result.error?.message : '';
    throw new Error(`Microsoft no completó el inicio de sesión.${detail ? ` ${detail}` : ''}`);
  }

  const token = await AuthSession.exchangeCodeAsync(
    {
      clientId: config.clientId,
      code: result.params.code,
      redirectUri,
      extraParams: { code_verifier: request.codeVerifier ?? '' },
    },
    discovery,
  );
  if (!token.idToken) throw new Error('Microsoft no devolvió la identidad. Intenta de nuevo.');
  return token.idToken;
}
