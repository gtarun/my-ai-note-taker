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
import { formatBytes } from '../src/features/settings/presentation';
import {
  getOfflineSetupStatusCopy,
  getOnboardingFeatureCard,
  getOnboardingProgressPercent,
} from '../src/features/onboarding/presentation';
import {
  canGoBackOnOnboarding,
  getNextOnboardingIndex,
  getOnboardingCompletionRoute,
  getPreviousOnboardingIndex,
  isLastOnboardingSlide,
  ONBOARDING_SLIDES,
} from '../src/onboarding/model';
import { getLocalDeviceSupport } from '../src/services/localInference';
import { getCatalogItemsForDevice, getModelCatalog } from '../src/services/localModels';
import {
  getOfflineSetupSession,
  resolveOfflineSetupBundles,
  startOfflineSetup,
  type OfflineSetupBundle,
} from '../src/services/offlineSetupSession';
import { markOnboardingSeen } from '../src/services/onboarding';
import { getAppSettings } from '../src/services/settings';
import { palette, radii, typography } from '../src/theme';
import type { OfflineSetupSession } from '../src/types';

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
  const [activeIndex, setActiveIndex] = useState(0);
  const [offlineSetup, setOfflineSetup] = useState<OfflineSetupSession | null>(null);
  const [bundleOptions, setBundleOptions] = useState<OfflineSetupBundle[]>([]);
  const [offlineSetupMessage, setOfflineSetupMessage] = useState<string | null>(null);
  const slide = ONBOARDING_SLIDES[activeIndex];
  const featureCard = getOnboardingFeatureCard(slide.id);
  const progressPercent = getOnboardingProgressPercent(activeIndex, ONBOARDING_SLIDES.length);
  const canGoBack = canGoBackOnOnboarding(activeIndex);
  const isLastSlide = isLastOnboardingSlide(activeIndex, ONBOARDING_SLIDES.length);
  const featureTone = featureToneStyles[featureCard.tone];
  const setupProgressPercent = Math.round((offlineSetup?.progress ?? 0) * 100);
  const activeBundleLabel = offlineSetup?.bundleLabel || bundleOptions[0]?.label || 'Starter';
  const estimatedMinutes =
    offlineSetup?.estimatedSecondsRemaining == null
      ? bundleOptions[0]?.estimatedSeconds
        ? Math.max(1, Math.round(bundleOptions[0].estimatedSeconds / 60))
        : null
      : Math.max(1, Math.round(offlineSetup.estimatedSecondsRemaining / 60));
  const setupStatus =
    offlineSetup?.status === 'downloading' ||
    offlineSetup?.status === 'paused_offline' ||
    offlineSetup?.status === 'failed' ||
    offlineSetup?.status === 'ready'
      ? offlineSetup.status
      : 'preparing';
  const setupCopy = getOfflineSetupStatusCopy({
    status: setupStatus,
    bundleLabel: activeBundleLabel,
    progressPercent: setupProgressPercent,
    estimatedMinutes,
  });

  useEffect(() => {
    if (slide.id !== 'setup') {
      return;
    }

    let cancelled = false;

    async function hydrateOfflineSetup() {
      try {
        setOfflineSetupMessage(null);
        const [settings, support, session] = await Promise.all([
          getAppSettings(),
          getLocalDeviceSupport(),
          getOfflineSetupSession(),
        ]);

        if (cancelled) {
          return;
        }

        setOfflineSetup(session);

        if (support.platform !== 'ios' && support.platform !== 'android') {
          setBundleOptions([]);
          setOfflineSetupMessage(support.reason ?? 'Offline setup is available on iOS and Android builds.');
          return;
        }

        const catalog = await getModelCatalog(settings.modelCatalogUrl);
        const deviceCatalog = getCatalogItemsForDevice(catalog, support);
        const bundles = resolveOfflineSetupBundles({
          platform: support.platform,
          catalog: deviceCatalog,
        });

        if (cancelled) {
          return;
        }

        setBundleOptions(bundles);

        if (session.status === 'idle' && bundles[0]) {
          await startOfflineSetup(bundles[0]);

          if (!cancelled) {
            setOfflineSetup(await getOfflineSetupSession());
          }
        }

        if (!bundles.length) {
          setOfflineSetupMessage('No directly downloadable local bundle is available for this device yet.');
        }
      } catch (error) {
        if (!cancelled) {
          setOfflineSetupMessage(
            error instanceof Error ? error.message : 'Unable to prepare offline setup right now.'
          );
        }
      }
    }

    void hydrateOfflineSetup();

    return () => {
      cancelled = true;
    };
  }, [slide.id]);

  const finish = async () => {
    try {
      await markOnboardingSeen();
    } finally {
      router.replace(getOnboardingCompletionRoute());
    }
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

  const handleBundleSelect = async (bundle: OfflineSetupBundle) => {
    try {
      await startOfflineSetup(bundle);
      setOfflineSetup(await getOfflineSetupSession());
    } catch (error) {
      setOfflineSetupMessage(error instanceof Error ? error.message : 'Unable to start this download.');
    }
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
                  <Text style={styles.featureTitle}>{setupCopy.title}</Text>
                  <Text style={styles.featureBody}>{setupCopy.body}</Text>
                </View>
              </View>

              <View style={styles.setupProgressBlock}>
                <View style={styles.setupProgressHeader}>
                  <Text style={styles.setupProgressLabel}>{activeBundleLabel}</Text>
                  <Text style={styles.setupProgressValue}>{setupCopy.progressLabel}</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${setupProgressPercent}%` }]} />
                </View>
              </View>

              {bundleOptions.length ? (
                <View style={styles.bundleList}>
                  {bundleOptions.map((bundle) => {
                    const isActive = activeBundleLabel === bundle.label;
                    return (
                      <Pressable
                        key={bundle.id}
                        onPress={() => {
                          void handleBundleSelect(bundle);
                        }}
                        style={[styles.bundleCard, isActive ? styles.bundleCardActive : null]}
                      >
                        <View style={styles.bundleText}>
                          <Text style={styles.bundleTitle}>{bundle.label}</Text>
                          <Text style={styles.bundleMeta}>
                            {formatBytes(bundle.totalBytes)} • ~{Math.max(1, Math.round(bundle.estimatedSeconds / 60))} min
                          </Text>
                        </View>
                        {bundle.isRecommended ? <StatusChip label="Recommended" tone="secondary" /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              {offlineSetupMessage ? <Text style={styles.setupHint}>{offlineSetupMessage}</Text> : null}

              <View style={styles.setupStoryGrid}>
                {['Record meetings', 'Import audio', 'Analyze when ready'].map((label) => (
                  <View key={label} style={styles.setupStoryCard}>
                    <Text style={styles.setupStoryText}>{label}</Text>
                  </View>
                ))}
              </View>
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

const styles = StyleSheet.create({
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
    fontFamily: typography.label.fontFamily,
    fontSize: 13,
  },
  skipButton: {
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  skipText: {
    color: palette.mutedInk,
    fontFamily: typography.label.fontFamily,
    fontSize: 14,
  },
  progressTrack: {
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: palette.cardUtility,
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
    fontFamily: typography.label.fontFamily,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    color: palette.ink,
    fontFamily: typography.display.fontFamily,
    fontSize: 34,
    lineHeight: 40,
  },
  body: {
    color: palette.mutedInk,
    fontFamily: typography.body.fontFamily,
    fontSize: 16,
    lineHeight: 25,
    maxWidth: 560,
  },
  featureCard: {
    gap: 14,
    borderRadius: 28,
    padding: 20,
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
    fontFamily: typography.heading.fontFamily,
    fontSize: 17,
  },
  featureBody: {
    color: palette.mutedInk,
    fontFamily: typography.body.fontFamily,
    fontSize: 15,
    lineHeight: 22,
  },
  setupProgressBlock: {
    gap: 8,
  },
  setupProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  setupProgressLabel: {
    color: palette.ink,
    fontFamily: typography.label.fontFamily,
    fontSize: 13,
  },
  setupProgressValue: {
    color: palette.accent,
    fontFamily: typography.label.fontFamily,
    fontSize: 13,
  },
  bundleList: {
    gap: 10,
  },
  bundleCard: {
    borderWidth: 1,
    borderColor: palette.lineSoft,
    borderRadius: 20,
    backgroundColor: palette.card,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  bundleCardActive: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
  },
  bundleText: {
    flex: 1,
    gap: 4,
  },
  bundleTitle: {
    color: palette.ink,
    fontFamily: typography.heading.fontFamily,
    fontSize: 15,
  },
  bundleMeta: {
    color: palette.mutedInk,
    fontFamily: typography.body.fontFamily,
    fontSize: 13,
  },
  setupHint: {
    color: palette.mutedInk,
    fontFamily: typography.body.fontFamily,
    fontSize: 13,
    lineHeight: 19,
  },
  setupStoryGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  setupStoryCard: {
    flex: 1,
    minHeight: 62,
    borderRadius: 18,
    backgroundColor: palette.paper,
    borderWidth: 1,
    borderColor: palette.lineSoft,
    padding: 10,
    justifyContent: 'flex-end',
  },
  setupStoryText: {
    color: palette.ink,
    fontFamily: typography.label.fontFamily,
    fontSize: 12,
    lineHeight: 16,
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
