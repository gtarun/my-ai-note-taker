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
  fontsError,
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

  if (fontsError) {
    return {
      screen: 'ready',
      useCustomFonts: false,
    };
  }

  return {
    screen: 'loading',
    useCustomFonts: false,
  };
}
