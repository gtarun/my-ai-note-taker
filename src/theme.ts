import { Platform, type TextStyle } from 'react-native';

/**
 * Design tokens.
 *
 * The system has one spine: **signal becomes ink**. Audio is live, luminous and
 * kinetic; text is settled, matte and editorial. The rule that keeps it
 * coherent is that *saturation is earned* — `signalLit` is reserved for the
 * moments the microphone is actually open, so nothing in the interface is ever
 * brighter than the audio coming in.
 *
 * Replaces a cold blue-grey ground with a generic SaaS blue accent, where the
 * only differentiated colour was a purple that related to nothing else.
 */

const lightPalette = {
  /** Warm oyster with a faint green cast, so it sits under the viridian accent. */
  paper: '#f4f2ec',
  paperSunken: '#ebe8e0',
  card: '#fffdf8',
  cardMuted: '#efece4',
  cardUtility: '#e7e3d9',

  /** Near-black pulled green rather than blue — a chosen neutral, not an inherited one. */
  ink: '#141a19',
  mutedInk: '#4a5350',
  faintInk: '#68716c',

  /** Primary. Every active, selected and successful state. */
  accent: '#0b6e5f',
  /** Only while the mic is open. See the module comment. */
  accentLit: '#12a184',
  accentSoft: '#dcebe6',

  /** Record and destructive only — never decorative, so it always means something. */
  clay: '#c2603c',
  claySoft: '#f7e3da',

  line: '#c9c4b8',
  lineSoft: 'rgba(20, 26, 25, 0.08)',
  danger: '#b4462c',
  dangerSoft: '#f7e3da',
  shadow: 'rgba(20, 26, 25, 0.10)',
  /** Modal backdrop. */
  scrim: 'rgba(20, 26, 25, 0.32)',

  /** The recording surface. Dim room, open mic. */
  stage: '#0e1312',
  stageCard: '#171e1c',
  stageInk: '#e9eae4',
  stageMutedInk: '#a7b0ab',
};

/**
 * Dark tokens. Defined now so the switch is a wiring change rather than a
 * redesign — `app.json` still pins `userInterfaceStyle` to light.
 */
const darkPalette: typeof lightPalette = {
  paper: '#0e1312',
  paperSunken: '#0a0e0d',
  card: '#171e1c',
  cardMuted: '#1d2523',
  cardUtility: '#232b29',

  ink: '#e9eae4',
  mutedInk: '#a7b0ab',
  faintInk: '#7c8681',

  accent: '#37d6a8',
  accentLit: '#5ff0c4',
  accentSoft: 'rgba(55, 214, 168, 0.14)',

  clay: '#e0805a',
  claySoft: 'rgba(224, 128, 90, 0.16)',

  line: '#2f3937',
  lineSoft: 'rgba(233, 234, 228, 0.10)',
  danger: '#e0805a',
  dangerSoft: 'rgba(224, 128, 90, 0.16)',
  shadow: 'rgba(0, 0, 0, 0.4)',
  // Heavier than light mode: a weak scrim over a dark page leaves the sheet
  // and the background reading as the same plane.
  scrim: 'rgba(0, 0, 0, 0.6)',

  stage: '#080b0a',
  stageCard: '#141a18',
  stageInk: '#e9eae4',
  stageMutedInk: '#a7b0ab',
};

export type ColorScheme = 'light' | 'dark';

function withAliases(base: typeof lightPalette) {
  return {
    ...base,
    // Aliases kept so screens that have not been renamed keep compiling. They
    // must exist on both palettes, or a themed component loses them in dark.
    cardStrong: base.cardMuted,
    accentStrong: base.accentLit,
    accentMist: base.accentSoft,
    lineStrong: base.line,
    tertiary: base.clay,
    tertiarySoft: base.claySoft,
  };
}

const lightWithAliases = withAliases(lightPalette);
const darkWithAliases = withAliases(darkPalette);

export function getPalette(scheme: ColorScheme) {
  return scheme === 'dark' ? darkWithAliases : lightWithAliases;
}

/** Light palette at module scope, for the few call sites outside components. */
export const palette = lightWithAliases;

/** 4pt base. Use these instead of ad-hoc numbers so rhythm survives edits. */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
} as const;

export const radii = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  card: 22,
  pill: 999,
} as const;

/**
 * Font families.
 *
 * UI text uses the system face — SF Pro on iOS — because it is the most legible
 * option at small sizes, costs nothing to load, and is the voice the platform
 * already speaks in.
 *
 * Display uses Charter. New York would have been the obvious pick, but iOS
 * registers it as `.New York` — the leading dot marks it private to the system,
 * so an app asking for it by name gets a silent fallback to sans, which is
 * exactly what happened on the first build. Charter is user-accessible, is what
 * Apple Books sets its reading text in, and is the right register for a screen
 * full of transcript.
 */
const serifDisplay = Platform.select({ ios: 'Charter', default: undefined });

export const typography = {
  display: { fontFamily: serifDisplay, fontWeight: '600' as const },
  heading: { fontFamily: serifDisplay, fontWeight: '600' as const },
  /** Sans headings, for places a serif would read as decorative rather than editorial. */
  headingSans: { fontFamily: undefined, fontWeight: '600' as const },
  body: { fontFamily: undefined, fontWeight: '400' as const },
  bodyStrong: { fontFamily: undefined, fontWeight: '500' as const },
  label: { fontFamily: undefined, fontWeight: '600' as const },
  /** Timers and durations. Tabular so digits never jitter as they count. */
  mono: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontWeight: '500' as const,
    fontVariant: ['tabular-nums'] as TextStyle['fontVariant'],
  },
};

/**
 * Type scale. Sizes were previously chosen per screen — 22 here, 15 there, 13
 * somewhere else — so nothing lined up between screens.
 */
export const type = {
  display: { fontSize: 32, lineHeight: 37, letterSpacing: -0.6 },
  title: { fontSize: 26, lineHeight: 31, letterSpacing: -0.4 },
  heading: { fontSize: 19, lineHeight: 24, letterSpacing: -0.2 },
  body: { fontSize: 16, lineHeight: 23 },
  bodySm: { fontSize: 14, lineHeight: 20 },
  label: { fontSize: 13, lineHeight: 17, letterSpacing: 0.1 },
  caption: { fontSize: 12, lineHeight: 16 },
  micro: { fontSize: 11, lineHeight: 14, letterSpacing: 0.6 },
  timer: { fontSize: 44, lineHeight: 50, letterSpacing: -1 },
} as const;

/**
 * Motion.
 *
 * Springs rather than durations wherever something is driven by a gesture or a
 * state change, because a spring can be interrupted and a timing curve cannot.
 * Every consumer must also honour `prefers-reduced-motion` — see
 * `useReducedMotion`.
 */
export const motion = {
  /** The press feel. Applied through PressableScale, not per call site. */
  press: { scale: 0.97, tension: 320, friction: 18 },
  /** Sheets and anything that should follow a finger. */
  sheet: { tension: 180, friction: 22 },
  /** Content arriving. Cheap and non-interruptible, so a duration is fine. */
  enter: { duration: 420, translateY: 10 },
  /** Cap the stagger so a long list does not turn into a slow cascade. */
  stagger: { step: 60, maxItems: 6 },
  shimmer: { duration: 1500 },
} as const;

/**
 * Elevation, in three weights.
 *
 * Previously one shadow was applied to all 71 cards, which meant no hierarchy:
 * a hero and a toggle row sat at the same visual depth.
 *
 * Takes the palette because a shadow tuned for warm paper is invisible on a
 * dark ground — dark surfaces need a deeper, tighter shadow to read at all.
 */
export function getElevation(activePalette: { shadow: string } = lightPalette) {
  const shadowColor = activePalette.shadow;

  return {
    /** Grouped rows and inline surfaces. Border only. */
    flat: {
      shadowColor: 'transparent',
      shadowOpacity: 0,
      shadowRadius: 0,
      shadowOffset: { width: 0, height: 0 },
      elevation: 0,
    },
    /** The default card. Barely there. */
    raised: {
      shadowColor,
      shadowOpacity: 0.05,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
      elevation: 1,
    },
    /** Sheets, the record bar, anything genuinely above the page. */
    floating: {
      shadowColor,
      shadowOpacity: 0.14,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 12 },
      elevation: 6,
    },
  };
}

/** Light-mode elevation, for the module-scope stylesheets still using it. */
export const elevation = {
  ...getElevation(lightPalette),
  card: getElevation(lightPalette).raised,
};

type ResolvedTypography = Record<
  keyof typeof typography,
  Pick<TextStyle, 'fontFamily' | 'fontWeight' | 'fontVariant'>
>;

/**
 * Kept for the font-loading path in `startup.ts`. Now that UI text uses the
 * system face there is far less to fall back from — only the serif display
 * differs, and an unknown family already degrades to the system face.
 */
export function resolveTypography(useCustomFonts: boolean): ResolvedTypography {
  if (useCustomFonts) {
    return typography;
  }

  return {
    ...typography,
    display: { fontFamily: undefined, fontWeight: '700' },
    heading: { fontFamily: undefined, fontWeight: '600' },
  };
}
