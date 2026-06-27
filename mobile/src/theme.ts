// "Aura Precision" — a modern, minimalist, light design system.
// Indigo accent, hairline borders, generous whitespace, Inter typography.

export const colors = {
  // Surfaces (cool off-white tonal layers)
  background: '#FAF8FF',
  surface: '#FAF8FF',
  card: '#FFFFFF',
  surfaceLow: '#F2F3FF',
  surfaceContainer: '#EAEDFF',

  // Primary (indigo)
  primary: '#4F46E5',
  primaryStrong: '#3525CD',
  primaryTint: '#EEF0FF',
  onPrimary: '#FFFFFF',

  // Text
  text: '#131B2E',
  textMuted: '#464555',
  textFaint: '#777587',

  // Lines
  border: '#E8E6F2', // hairline
  outline: '#C7C4D8',

  // Status
  danger: '#BA1A1A',
  dangerTint: '#FFDAD6',
  success: '#16A34A',
  warning: '#B45309',
  warningTint: '#FDE9C8',
};

// 4px base scale: spacing(2)=8, spacing(4)=16, spacing(5)=20, spacing(8)=32
export const spacing = (n: number) => n * 4;

export const radius = { sm: 6, md: 12, lg: 16, xl: 24, pill: 999 };

// Inter family names — loaded in app/_layout.tsx via useFonts().
export const font = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
};

// Typography presets (apply a color separately at the call site).
export const typography = {
  display: { fontFamily: font.extrabold, fontSize: 30, lineHeight: 36, letterSpacing: -0.5 },
  title: { fontFamily: font.bold, fontSize: 26, lineHeight: 32, letterSpacing: -0.3 },
  headline: { fontFamily: font.semibold, fontSize: 20, lineHeight: 28, letterSpacing: -0.2 },
  body: { fontFamily: font.regular, fontSize: 16, lineHeight: 24 },
  bodyMedium: { fontFamily: font.medium, fontSize: 16, lineHeight: 24 },
  label: { fontFamily: font.medium, fontSize: 14, lineHeight: 20 },
  labelSmall: { fontFamily: font.medium, fontSize: 12, lineHeight: 16 },
} as const;

// Standard horizontal page padding (the design's 20px container margin).
export const PAGE_PADDING = spacing(5);
