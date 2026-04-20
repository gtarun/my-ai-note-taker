import { type ReactNode, type RefObject } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  type ScrollView as ScrollViewInstance,
  type ScrollViewProps,
  StyleSheet,
} from 'react-native';

type KeyboardAwareScrollViewProps = ScrollViewProps & {
  children: ReactNode;
  scrollRef?: RefObject<ScrollViewInstance | null>;
};

export function KeyboardAwareScrollView({
  children,
  keyboardShouldPersistTaps = 'handled',
  scrollRef,
  ...props
}: KeyboardAwareScrollViewProps) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 84 : 0}
      style={styles.wrapper}
    >
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        contentInsetAdjustmentBehavior="automatic"
        {...props}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
});
