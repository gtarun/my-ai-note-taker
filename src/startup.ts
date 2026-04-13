type StartupPresentationInput = {
  isReady: boolean;
  error: string | null;
  fontsLoaded: boolean;
  fontsError: Error | null | undefined;
};

type StartupPresentation = {
  screen: 'error' | 'loading' | 'ready';
  useCustomFonts: boolean;
};

export function getStartupPresentation({
  isReady,
  error,
  fontsLoaded,
  fontsError: _fontsError,
}: StartupPresentationInput): StartupPresentation {
  if (error) {
    return {
      screen: 'error',
      useCustomFonts: false,
    };
  }

  if (!isReady) {
    return {
      screen: 'loading',
      useCustomFonts: false,
    };
  }

  if (fontsLoaded) {
    return {
      screen: 'ready',
      useCustomFonts: true,
    };
  }

  // Font assets are an enhancement only. Once app bootstrap succeeds, continue with
  // system fonts instead of blocking the shell on custom font availability.
  return {
    screen: 'ready',
    useCustomFonts: false,
  };
}
