import type { ComponentProps } from 'react';

import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FadeInView } from '../src/components/FadeInView';
import { ScreenBackground } from '../src/components/ScreenBackground';
import { PillButton } from '../src/components/ui/PillButton';
import { StatusChip } from '../src/components/ui/StatusChip';
import { SurfaceCard } from '../src/components/ui/SurfaceCard';
import { getOnboardingFeatureCard, getOnboardingProgressPercent } from '../src/features/onboarding/presentation';
import {
  canGoBackOnOnboarding,
  getNextOnboardingIndex,
  getOnboardingCompletionRoute,
  getPreviousOnboardingIndex,
  isLastOnboardingSlide,
  ONBOARDING_SLIDES,
} from '../src/onboarding/model';
import { markOnboardingSeen } from '../src/services/onboarding';
import { palette, radii, typography } from '../src/theme';

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
  const slide = ONBOARDING_SLIDES[activeIndex];
  const featureCard = getOnboardingFeatureCard(slide.id);
  const progressPercent = getOnboardingProgressPercent(activeIndex, ONBOARDING_SLIDES.length);
  const canGoBack = canGoBackOnOnboarding(activeIndex);
  const isLastSlide = isLastOnboardingSlide(activeIndex, ONBOARDING_SLIDES.length);
  const featureTone = featureToneStyles[featureCard.tone];

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
                <Pressable onPress={finish} style={styles.skipButton}>
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
    paddingHorizontal: 4,
    paddingVertical: 6,
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
