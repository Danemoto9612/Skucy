// Tokens tomados del sistema de diseño "Modern EdTech" exportado de Google Stitch.
export const colors = {
  primary: '#7b5097',
  primaryDeep: '#583372',
  primaryDark: '#62387d',
  accent: '#9c72b8',
  wash: '#f3ecf8',
  canvas: '#faf9fd',
  card: '#ffffff',
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
  error: '#ba1a1a',
  errorBg: '#ffdad6',
  white: '#ffffff',
};

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

// Sombra "Level 1" del sistema de diseño.
export const shadow1 = {
  shadowColor: '#7b5097',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.07,
  shadowRadius: 8,
  elevation: 1,
};
