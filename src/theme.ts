export const palette = {
  paper: '#f7fafc',
  card: '#ffffff',
  cardMuted: '#eff4f7',
  cardUtility: '#e8eff2',
  cardStrong: '#eff4f7',
  ink: '#2b3437',
  mutedInk: '#576064',
  accent: '#0f57d0',
  accentStrong: '#4e83fe',
  accentSoft: '#d8e3fa',
  accentMist: '#d8e3fa',
  tertiary: '#685781',
  tertiarySoft: '#e4ceff',
  line: '#aab3b7',
  lineStrong: '#aab3b7',
  lineSoft: 'rgba(170, 179, 183, 0.15)',
  danger: '#a83836',
  dangerSoft: '#fde7e6',
  shadow: 'rgba(43, 52, 55, 0.08)',
};

export const radii = {
  md: 12,
  lg: 18,
  xl: 24,
  card: 24,
  pill: 999,
};

export const typography = {
  display: { fontFamily: 'Manrope_800ExtraBold' as const },
  heading: { fontFamily: 'Manrope_700Bold' as const },
  body: { fontFamily: 'Inter_400Regular' as const },
  bodyStrong: { fontFamily: 'Inter_500Medium' as const },
  label: { fontFamily: 'Inter_600SemiBold' as const },
};

export const elevation = {
  card: {
    shadowColor: '#2b3437',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 2,
  },
};
