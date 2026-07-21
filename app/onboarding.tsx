import type { ComponentProps } from 'react';

import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FadeInView } from '../src/components/FadeInView';
import { ScreenBackground } from '../src/components/ScreenBackground';
import { PillButton } from '../src/components/ui/PillButton';
import { StatusChip } from '../src/components/ui/StatusChip';
import { SurfaceCard } from '../src/components/ui/SurfaceCard';
import {
  getOnboardingFeatureCard,
  getOnboardingProgressPercent,
} from '../src/features/onboarding/presentation';
import {
  getSetupRouteConfirmation,
  getSetupRouteOptions,
  type SetupRouteId,
  type SetupRouteOption,
  type SetupRoutePlatform,
} from '../src/features/onboarding/setupRoutes';
import {
  canGoBackOnOnboarding,
  getNextOnboardingIndex,
  getOnboardingCompletionRoute,
  getPreviousOnboardingIndex,
  isLastOnboardingSlide,
  ONBOARDING_SLIDES,
} from '../src/onboarding/model';
import { SETTINGS_TAB_ROUTE } from '../src/navigation/routes';
import { getLocalDeviceSupport } from '../src/services/localInference';
import { markOnboardingSeen } from '../src/services/onboarding';
import { getAppSettings, saveAppSettings } from '../src/services/settings';
import { palette, radii, spacing, type, typography } from '../src/theme';
import { useTheme, useThemedStyles, type Palette } from '../src/hooks/useTheme';

type FeatherIconName = ComponentProps<typeof Feather>['name'];

const featureToneStyles = {
  secondary: {
    backgroundColor: palette.accentSoft,
    color: palette.accent,
  },
  tertiary: {
    backgroundColor: palette.tertiarySoft,
    color: palette.tertiary,
  },
} as const;

export default function OnboardingScreen() {
  const palette = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [activeIndex, setActiveIndex] = useState(0);
  const [routeOptions, setRouteOptions] = useState<SetupRouteOption[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<SetupRouteId | null>(null);
  const [routeMessage, setRouteMessage] = useState<string | null>(null);
  const [isApplyingRoute, setIsApplyingRoute] = useState(false);
  const slide = ONBOARDING_SLIDES[activeIndex];
  const featureCard = getOnboardingFeatureCard(slide.id);
  const progressPercent = getOnboardingProgressPercent(activeIndex, ONBOARDING_SLIDES.length);
  const canGoBack = canGoBackOnOnboarding(activeIndex);
  const isLastSlide = isLastOnboardingSlide(activeIndex, ONBOARDING_SLIDES.length);
  const featureTone = featureToneStyles[featureCard.tone];

  useEffect(() => {
    if (slide.id !== 'setup') {
      return;
    }

    let cancelled = false;

    async function loadRouteOptions() {
      try {
        const support = await getLocalDeviceSupport();

        if (cancelled) {
          return;
        }

        const platform: SetupRoutePlatform =
          support.platform === 'ios' || support.platform === 'android' ? support.platform : 'web';
        setRouteOptions(getSetupRouteOptions(platform));
      } catch {
        if (!cancelled) {
          // Cloud is the safe universal fallback when device support is unknown.
          setRouteOptions(getSetupRouteOptions('web'));
        }
      }
    }

    void loadRouteOptions();

    return () => {
      cancelled = true;
    };
  }, [slide.id]);

  const finish = async () => {
    try {
      await markOnboardingSeen();
    } catch {
      // See handleFinishSetupInSettings: never block leaving onboarding.
    }
    router.replace(getOnboardingCompletionRoute());
  };

  const handlePrimary = async () => {
    if (isLastSlide) {
      await finish();
      return;
    }

    setActiveIndex(getNextOnboardingIndex(activeIndex, ONBOARDING_SLIDES.length));
  };

  const handleBack = () => {
    setActiveIndex(getPreviousOnboardingIndex(activeIndex));
  };

  /**
   * Persists the chosen transcription route so the user lands in Settings with
   * their pick already applied, then hands them off to finish the API key step.
   * The previous version of this slide only wrote a "downloading" row and never
   * started a download.
   */
  const handleRouteSelect = async (option: SetupRouteOption) => {
    if (isApplyingRoute) {
      return;
    }

    setIsApplyingRoute(true);
    setSelectedRouteId(option.id);
    setRouteMessage(null);

    try {
      const settings = await getAppSettings();
      await saveAppSettings({
        ...settings,
        selectedTranscriptionProvider: option.transcriptionProvider,
      });
      setRouteMessage(getSetupRouteConfirmation(option.id));
    } catch (error) {
      setSelectedRouteId(null);
      setRouteMessage(
        error instanceof Error ? error.message : 'Unable to save that choice. You can set it in Settings.'
      );
    } finally {
      setIsApplyingRoute(false);
    }
  };

  /** Completes onboarding and drops the user directly into provider setup. */
  const handleFinishSetupInSettings = async () => {
    try {
      await markOnboardingSeen();
    } catch {
      // Navigating on is still the right move — the worst case is that
      // onboarding replays next launch. Swallowing here keeps it from becoming
      // an unhandled rejection at the `void` call site.
    }
    router.replace(SETTINGS_TAB_ROUTE);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenBackground />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <FadeInView style={styles.shell}>
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <View style={styles.headerCopy}>
                <StatusChip label="First run" tone="secondary" />
                <Text style={styles.stepText}>
                  Step {activeIndex + 1} of {ONBOARDING_SLIDES.length}
                </Text>
              </View>

              {slide.showSkip ? (
                <Pressable onPress={finish} style={styles.skipButton} hitSlop={8}>
                  <Text style={styles.skipText}>Skip</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
            </View>
          </View>

          <View style={styles.editorialBlock}>
            <Text style={styles.eyebrow}>{slide.eyebrow ?? 'Getting started'}</Text>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.body}>{slide.body}</Text>
          </View>

          {slide.id === 'setup' ? (
            <SurfaceCard style={styles.featureCard} muted>
              <View style={styles.featureHeader}>
                <View style={[styles.featureIconWrap, { backgroundColor: featureTone.backgroundColor }]}>
                  <Feather name={featureCard.icon as FeatherIconName} size={20} color={featureTone.color} />
                </View>
                <View style={styles.featureCopy}>
                  <Text style={styles.featureTitle}>{featureCard.title}</Text>
                  <Text style={styles.featureBody}>{featureCard.body}</Text>
                </View>
              </View>

              <View style={styles.routeList}>
                {routeOptions.map((option) => {
                  const isSelected = selectedRouteId === option.id;

                  return (
                    <Pressable
                      key={option.id}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected, disabled: isApplyingRoute }}
                      accessibilityLabel={`${option.title}. ${option.requirement}`}
                      disabled={isApplyingRoute}
                      onPress={() => {
                        void handleRouteSelect(option);
                      }}
                      style={[styles.routeCard, isSelected ? styles.routeCardActive : null]}
                    >
                      <View style={styles.routeHeader}>
                        <Feather
                          name={option.icon as FeatherIconName}
                          size={18}
                          color={isSelected ? palette.accent : palette.mutedInk}
                        />
                        <Text style={styles.routeTitle}>{option.title}</Text>
                        {option.isRecommended ? (
                          <StatusChip label="Recommended" tone="secondary" />
                        ) : null}
                      </View>
                      <Text style={styles.routeBody}>{option.body}</Text>
                      <Text style={styles.routeRequirement}>{option.requirement}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {routeMessage ? <Text style={styles.setupHint}>{routeMessage}</Text> : null}

              {selectedRouteId ? (
                <PillButton
                  label="Add API key in Settings"
                  onPress={() => {
                    void handleFinishSetupInSettings();
                  }}
                  variant="secondary"
                  icon={<Feather name="key" size={16} color={palette.ink} />}
                />
              ) : null}
            </SurfaceCard>
          ) : (
            <SurfaceCard style={styles.featureCard} muted>
              <View style={styles.featureHeader}>
                <View style={[styles.featureIconWrap, { backgroundColor: featureTone.backgroundColor }]}>
                  <Feather name={featureCard.icon as FeatherIconName} size={20} color={featureTone.color} />
                </View>
                <View style={styles.featureCopy}>
                  <Text style={styles.featureTitle}>{featureCard.title}</Text>
                  <Text style={styles.featureBody}>{featureCard.body}</Text>
                </View>
              </View>
            </SurfaceCard>
          )}

          {slide.highlights?.length ? (
            <View style={styles.highlights}>
              {slide.highlights.map((highlight) => (
                <StatusChip
                  key={highlight}
                  label={highlight}
                  tone={slide.id === 'privacy' ? 'tertiary' : 'secondary'}
                />
              ))}
            </View>
          ) : null}

          <FadeInView style={styles.footer} delay={80}>
            <View style={styles.footerRow}>
              {canGoBack ? (
                <View style={styles.secondaryAction}>
                  <PillButton
                    label="Back"
                    onPress={handleBack}
                    variant="secondary"
                    icon={<Feather name="arrow-left" size={16} color={palette.ink} />}
                  />
                </View>
              ) : (
                <View style={styles.secondarySpacer} />
              )}

              <View style={styles.primaryAction}>
                <PillButton
                  label={slide.ctaLabel}
                  onPress={() => {
                    void handlePrimary();
                  }}
                  icon={
                    <Feather
                      name={isLastSlide ? 'check' : 'arrow-right'}
                      size={16}
                      color={palette.card}
                    />
                  }
                />
              </View>
            </View>
          </FadeInView>
        </FadeInView>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (palette: Palette) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.paper,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  shell: {
    flex: 1,
    gap: 20,
    paddingBottom: 8,
  },
  header: {
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    gap: 8,
  },
  stepText: {
    color: palette.mutedInk,
    ...typography.label,
    fontSize: 13,
  },
  skipButton: {
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  skipText: {
    color: palette.mutedInk,
    ...typography.label,
    fontSize: 14,
  },
  progressTrack: {
    height: 3,
    borderRadius: radii.pill,
    backgroundColor: palette.lineSoft,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: palette.accent,
  },
  editorialBlock: {
    gap: 12,
    paddingTop: 6,
  },
  eyebrow: {
    color: palette.accent,
    ...typography.label,
    ...type.micro,
    textTransform: 'uppercase',
  },
  title: {
    color: palette.ink,
    ...typography.display,
    ...type.display,
  },
  body: {
    color: palette.mutedInk,
    ...typography.body,
    ...type.body,
    maxWidth: 560,
  },
  featureCard: {
    gap: spacing.lg,
    borderRadius: radii.xl,
    padding: spacing.xl,
  },
  featureHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  featureIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureCopy: {
    flex: 1,
    gap: 6,
  },
  featureTitle: {
    color: palette.ink,
    ...typography.headingSans,
    ...type.heading,
  },
  featureBody: {
    color: palette.mutedInk,
    ...typography.body,
    ...type.bodySm,
  },
  routeList: {
    gap: 10,
  },
  routeCard: {
    borderWidth: 1,
    borderColor: palette.lineSoft,
    borderRadius: 20,
    backgroundColor: palette.card,
    padding: 14,
    gap: 6,
  },
  routeCardActive: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeTitle: {
    flex: 1,
    color: palette.ink,
    ...typography.heading,
    fontSize: 15,
  },
  routeBody: {
    color: palette.mutedInk,
    ...typography.body,
    fontSize: 13,
    lineHeight: 19,
  },
  routeRequirement: {
    color: palette.ink,
    ...typography.label,
    fontSize: 12,
    lineHeight: 17,
  },
  setupHint: {
    color: palette.mutedInk,
    ...typography.body,
    fontSize: 13,
    lineHeight: 19,
  },
  highlights: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 10,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  secondaryAction: {
    flex: 1,
  },
  secondarySpacer: {
    flex: 1,
  },
  primaryAction: {
    flex: 1.35,
  },
});
