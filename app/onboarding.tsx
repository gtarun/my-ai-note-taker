import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { FadeInView } from '../src/components/FadeInView';
import { ScreenBackground } from '../src/components/ScreenBackground';
import { markOnboardingSeen } from '../src/services/onboarding';
import { elevation, palette } from '../src/theme';
import {
  canGoBackOnOnboarding,
  getNextOnboardingIndex,
  getOnboardingCompletionRoute,
  getOnboardingProgress,
  isLastOnboardingSlide,
  ONBOARDING_SLIDES,
} from '../src/onboarding/model';

export default function OnboardingScreen() {
  const [activeIndex, setActiveIndex] = useState(0);
  const slide = ONBOARDING_SLIDES[activeIndex];
  const progress = getOnboardingProgress(activeIndex, ONBOARDING_SLIDES.length);
  const canGoBack = canGoBackOnOnboarding(activeIndex);
  const isLastSlide = isLastOnboardingSlide(activeIndex, ONBOARDING_SLIDES.length);

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenBackground />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <FadeInView style={styles.shell}>
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <View style={styles.badge}>
                <Feather name="star" size={12} color={palette.accent} />
                <Text style={styles.badgeText}>First run</Text>
              </View>
              <Text style={styles.stepText}>
                Step {activeIndex + 1} of {ONBOARDING_SLIDES.length}
              </Text>
            </View>

            <Pressable onPress={finish} style={styles.skipButton}>
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.eyebrow}>{slide.eyebrow ?? 'Getting started'}</Text>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.body}>{slide.body}</Text>

            {slide.highlights?.length ? (
              <View style={styles.highlightRow}>
                {slide.highlights.map((highlight) => (
                  <View key={highlight} style={styles.highlightChip}>
                    <Text style={styles.highlightText}>{highlight}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.progressRow}>
              {progress.map((isActive, index) => (
                <View
                  key={`${slide.id}-${index}`}
                  style={[styles.progressDot, isActive && styles.progressDotActive]}
                />
              ))}
            </View>
          </View>

          <FadeInView style={styles.footer} delay={80}>
            <View style={styles.buttonRow}>
              {canGoBack ? (
                <Pressable
                  onPress={() => setActiveIndex((current) => Math.max(current - 1, 0))}
                  style={[styles.button, styles.secondaryButton]}
                >
                  <Text style={styles.secondaryButtonText}>Back</Text>
                </Pressable>
              ) : (
                <View style={styles.buttonSpacer} />
              )}

              <Pressable onPress={handlePrimary} style={[styles.button, styles.primaryButton]}>
                <Text style={styles.primaryButtonText}>{slide.ctaLabel}</Text>
                <Feather
                  name={isLastSlide ? 'check' : 'arrow-right'}
                  size={16}
                  color={palette.paper}
                />
              </Pressable>
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
    justifyContent: 'space-between',
    gap: 18,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    gap: 6,
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: palette.accentMist,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  badgeText: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  stepText: {
    color: palette.mutedInk,
    fontSize: 13,
    fontWeight: '600',
  },
  skipButton: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  skipText: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  card: {
    backgroundColor: palette.cardStrong,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 20,
    gap: 14,
    ...elevation.card,
  },
  eyebrow: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  title: {
    color: palette.ink,
    fontSize: 31,
    lineHeight: 35,
    fontWeight: '800',
  },
  body: {
    color: palette.mutedInk,
    fontSize: 16,
    lineHeight: 24,
  },
  highlightRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 4,
  },
  highlightChip: {
    borderRadius: 999,
    backgroundColor: palette.paper,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  highlightText: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  progressRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 6,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: palette.line,
  },
  progressDotActive: {
    width: 28,
    backgroundColor: palette.accent,
  },
  footer: {
    gap: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  button: {
    minHeight: 52,
    borderRadius: 18,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...elevation.card,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: palette.paper,
    borderWidth: 1,
    borderColor: palette.line,
  },
  secondaryButtonText: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  primaryButton: {
    flex: 1.3,
    backgroundColor: palette.ink,
  },
  primaryButtonText: {
    color: palette.paper,
    fontSize: 15,
    fontWeight: '800',
  },
  buttonSpacer: {
    flex: 1,
  },
});
