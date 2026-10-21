// Inicio de sesión con Microsoft 365 (Microsoft Entra ID): OAuth2 código de autorización + PKCE.
// La app NUNCA ve la contraseña de Microsoft: se la escribes a Microsoft en su propia página. La app recibe un
// ID token que el servidor (Edge Function) verifica criptográficamente antes de dar acceso.
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
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

const PENDING_KEY = 'skucy.ms.pending';
// Solo se usa en web; `globalThis` evita depender de los tipos del DOM.
const win = globalThis as any;

function discoveryOf(config: MicrosoftConfig) {
  return { authorizationEndpoint: config.authorizeUrl, tokenEndpoint: config.tokenUrl };
}

/**
 * WEB: sin ventana emergente (Safari y otros navegadores las bloquean o rompen la comunicación entre ventanas).
 * La propia pestaña viaja a Microsoft y vuelve a /auth, donde `completeMicrosoftRedirect` canjea el código.
 */
async function startWebRedirect(config: MicrosoftConfig): Promise<never> {
  const redirectUri = AuthSession.makeRedirectUri({ path: 'auth' });
  const request = new AuthSession.AuthRequest({
    clientId: config.clientId,
    redirectUri,
    scopes: ['openid', 'profile', 'email'],
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
    extraParams: { nonce: config.nonce, prompt: 'select_account' },
  });
  await request.makeAuthUrlAsync(discoveryOf(config));
  win.sessionStorage.setItem(
    PENDING_KEY,
    JSON.stringify({ state: request.state, codeVerifier: request.codeVerifier, redirectUri, config }),
  );
  win.location.assign(request.url as string);
  throw new MicrosoftCancelled(); // la página se está yendo; no se muestra ningún error
}

/** WEB, en /auth: devuelve el ID token si la URL trae la respuesta de Microsoft; null si no hay login pendiente. */
export async function completeMicrosoftRedirect(): Promise<string | null> {
  const raw = win.sessionStorage.getItem(PENDING_KEY);
  if (!raw) return null;
  win.sessionStorage.removeItem(PENDING_KEY);
  const pending = JSON.parse(raw) as { state: string; codeVerifier: string; redirectUri: string; config: MicrosoftConfig };
  const params = new win.URLSearchParams(win.location.search);
  win.history.replaceState({}, '', win.location.pathname); // el código es de un solo uso: se quita de la barra
  if (params.get('error')) {
    throw new Error(`Microsoft no completó el inicio de sesión. ${params.get('error_description') ?? params.get('error')}`);
  }
  const code = params.get('code');
  if (!code || params.get('state') !== pending.state) {
    throw new Error('La respuesta de Microsoft no es válida. Intenta de nuevo.');
  }
  const token = await AuthSession.exchangeCodeAsync(
    {
      clientId: pending.config.clientId,
      code,
      redirectUri: pending.redirectUri,
      extraParams: { code_verifier: pending.codeVerifier },
    },
    discoveryOf(pending.config),
  );
  if (!token.idToken) throw new Error('Microsoft no devolvió la identidad. Intenta de nuevo.');
  return token.idToken;
}

/** Devuelve un ID token de Microsoft listo para enviar al servidor (en web, redirige y no vuelve aquí). */
export async function getMicrosoftIdToken(): Promise<string> {
  const config = await api.get<MicrosoftConfig>('/auth/microsoft/config', false);
  if (!config.enabled) {
    throw new Error('El inicio de sesión con Microsoft aún no está configurado en el servidor. Usa tu correo y contraseña.');
  }
  if (Platform.OS === 'web') return startWebRedirect(config);
  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'skucy', path: 'auth' });
  const discovery = discoveryOf(config);

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
