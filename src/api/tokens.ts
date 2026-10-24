// Los tokens se guardan en el llavero del sistema (expo-secure-store); AsyncStorage solo como respaldo (web).
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const KEY = 'skucy.tokens.v1';

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

export async function readTokens(): Promise<StoredTokens | null> {
  let raw: string | null = null;
  try {
    raw = await SecureStore.getItemAsync(KEY);
  } catch {
    raw = null; // en web no existe el llavero
  }
  try {
    raw = raw ?? (await AsyncStorage.getItem(KEY));
    return raw ? (JSON.parse(raw) as StoredTokens) : null;
  } catch {
    return null;
  }
}

export async function writeTokens(tokens: StoredTokens | null): Promise<void> {
  try {
    if (tokens) {
      await SecureStore.setItemAsync(KEY, JSON.stringify(tokens));
    } else {
      await SecureStore.deleteItemAsync(KEY);
      await AsyncStorage.removeItem(KEY);
    }
  } catch {
    // Web (sin llavero): se guarda en el almacenamiento del navegador.
    if (tokens) await AsyncStorage.setItem(KEY, JSON.stringify(tokens)).catch(() => undefined);
    else await AsyncStorage.removeItem(KEY).catch(() => undefined);
  }
}
