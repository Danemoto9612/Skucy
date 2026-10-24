import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { Appearance } from 'react-native';

// Tokens tomados del sistema de diseño "Modern EdTech" exportado de Google Stitch.
const light = {
  primary: '#7b5097',
  primaryDeep: '#583372',
  primaryDark: '#62387d',
  accent: '#9c72b8',
  wash: '#f3ecf8',
  canvas: '#faf9fd',
  card: '#ffffff',
  /** Fondo de campos, barras y superficies elevadas (en claro es blanco; en oscuro, gris oscuro). */
  surface: '#ffffff',
  tint: '#f1f3f5',
  border: '#e9ecef',
  ink: '#121316',
  charcoal: '#495057',
  muted: '#6c757d',
  success: '#2eb875',
  successBg: 'rgba(46, 184, 117, 0.12)',
  successText: '#00522f',
  warning: '#f59f00',
  warningBg: 'rgba(245, 159, 0, 0.12)',
  warningText: '#b37400',
  violet: '#8b5cf6',
  violetBg: '#ede9fe',
  error: '#ba1a1a',
  errorBg: '#ffdad6',
  /** Blanco fijo (texto sobre botones de color y sobre video); no cambia con el tema. */
  white: '#ffffff',
};

const dark: typeof light = {
  primary: '#9466b5',
  primaryDeep: '#e3c8f3',
  primaryDark: '#e3c8f3',
  accent: '#b48ad0',
  wash: '#33243f',
  canvas: '#121217',
  card: '#1c1b23',
  surface: '#1f1d27',
  tint: '#2a2833',
  border: '#34323f',
  ink: '#f1eff5',
  charcoal: '#c8c4d1',
  muted: '#9f9aab',
  success: '#3fcf88',
  successBg: 'rgba(63, 207, 136, 0.16)',
  successText: '#5fe0a2',
  warning: '#f5b73b',
  warningBg: 'rgba(245, 183, 59, 0.16)',
  warningText: '#ffc857',
  violet: '#b79cff',
  violetBg: '#2b2450',
  error: '#ff8a80',
  errorBg: '#4a1f1d',
  white: '#ffffff',
};

const shadowLight = { shadowColor: '#7b5097', shadowOpacity: 0.07 };
const shadowDark = { shadowColor: '#000000', shadowOpacity: 0.35 };

/**
 * Paleta ACTIVA. Es un objeto mutable: al cambiar de tema se reemplazan sus valores y los componentes que llaman a
 * `useTheme()` se vuelven a dibujar. Siempre se lee en tiempo de render (no la guardes en constantes de módulo).
 */
export const colors: typeof light = { ...light };

export type ThemeMode = 'system' | 'light' | 'dark';
export type Scheme = 'light' | 'dark';

const STORAGE_KEY = 'skucy.theme.v1';
const listeners = new Set<() => void>();
let mode: ThemeMode = 'system';
let scheme: Scheme = 'light';

function systemScheme(): Scheme {
  try {
    return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function apply() {
  const next: Scheme = mode === 'system' ? systemScheme() : mode;
  Object.assign(colors, next === 'dark' ? dark : light);
  Object.assign(shadow1, next === 'dark' ? shadowDark : shadowLight);
  scheme = next;
  // Web: el fondo de la página y los controles nativos del navegador siguen el tema.
  const doc = (globalThis as any).document;
  if (doc?.documentElement) {
    doc.documentElement.style.backgroundColor = colors.canvas;
    doc.documentElement.style.colorScheme = next;
    if (doc.body) doc.body.style.backgroundColor = colors.canvas;
  }
}

function emit() {
  listeners.forEach((l) => l());
}

export function setThemeMode(next: ThemeMode) {
  mode = next;
  apply();
  emit();
  AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
}

/** Tema actual y modo elegido por la persona ('system' = el del dispositivo). */
export function useTheme(): { scheme: Scheme; mode: ThemeMode; isDark: boolean } {
  const key = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => `${mode}|${scheme}`,
    () => `${mode}|${scheme}`,
  );
  const [m, sc] = key.split('|') as [ThemeMode, Scheme];
  return { mode: m, scheme: sc, isDark: sc === 'dark' };
}

export const getScheme = (): Scheme => scheme;

// Arranque: aplica el tema del dispositivo de inmediato y luego la preferencia guardada.
export const shadow1 = {
  shadowColor: '#7b5097',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.07,
  shadowRadius: 8,
  elevation: 1,
};
apply();
try {
  Appearance.addChangeListener(() => {
    if (mode === 'system') {
      apply();
      emit();
    }
  });
} catch {
  // sin soporte de Appearance: se queda en claro
}
AsyncStorage.getItem(STORAGE_KEY)
  .then((saved) => {
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      mode = saved;
      apply();
      emit();
    }
  })
  .catch(() => undefined);

export const radius = { sm: 4, md: 8, lg: 16, xl: 24, full: 9999 };
export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
};

export const typography = {
  display: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 36, letterSpacing: -0.4 },
  h1: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 32, letterSpacing: -0.3 },
  h2: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 26, letterSpacing: -0.1 },
  h3: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 24 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodySm: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20 },
  labelSm: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 16 },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, letterSpacing: 0.2 },
} as const;

export type TextVariant = keyof typeof typography;
