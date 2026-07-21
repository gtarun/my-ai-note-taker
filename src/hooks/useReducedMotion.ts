import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Whether the user has asked the system to reduce motion.
 *
 * Nothing in the app checked this before, so every animation ran regardless of
 * the accessibility setting. Consumers should skip transforms entirely rather
 * than shortening them — for someone with vestibular sensitivity a fast scale
 * is still a scale.
 */
export function useReducedMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let cancelled = false;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (!cancelled) {
          setReduceMotion(enabled);
        }
      })
      .catch(() => {
        // Treat an unavailable accessibility API as "motion is fine".
      });

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      setReduceMotion(enabled);
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}
