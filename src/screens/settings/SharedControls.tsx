import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { type ReactNode, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { radii, spacing, type, typography } from '../../theme';
import { buildProviderPickerOptionCopy } from '../../features/settings/presentation';
import { providerMap } from '../../services/providers';
import type { ProviderId } from '../../types';
import { useTheme, useThemedStyles, type Palette } from '../../hooks/useTheme';

export function ProviderIcon({ providerId }: { providerId: ProviderId }) {
  const palette = useTheme();
  switch (providerId) {
    case 'openai':
      return <MaterialCommunityIcons name="star-four-points-circle-outline" size={18} color={palette.ink} />;
    case 'openrouter':
      return <Feather name="shuffle" size={17} color={palette.ink} />;
    case 'groq':
      return <Feather name="zap" size={17} color={palette.ink} />;
    case 'anthropic':
      return <MaterialCommunityIcons name="brain" size={18} color={palette.ink} />;
    case 'gemini':
      return <MaterialCommunityIcons name="google-circles-communities" size={18} color={palette.ink} />;
    case 'together':
      return <Feather name="layers" size={17} color={palette.ink} />;
    case 'fireworks':
      return <Feather name="sun" size={17} color={palette.ink} />;
    case 'deepseek':
      return <Feather name="search" size={17} color={palette.ink} />;
    case 'nvidia':
      return <Feather name="cpu" size={17} color={palette.ink} />;
    case 'local':
      return <MaterialCommunityIcons name="chip" size={18} color={palette.ink} />;
    default:
      return <Feather name="settings" size={17} color={palette.ink} />;
  }
}

export function FieldGroup({ children }: { children: ReactNode }) {
  const styles = useThemedStyles(makeControlStyles);
  return <View style={styles.fieldGroup}>{children}</View>;
}

export function Label({ text }: { text: string }) {
  const styles = useThemedStyles(makeControlStyles);
  return <Text style={styles.label}>{text}</Text>;
}

export function PlainInput({
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  autoCapitalize = 'none',
}: {
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  const palette = useTheme();
  const styles = useThemedStyles(makeControlStyles);

  return (
    <TextInput
      style={styles.input}
      autoCapitalize={autoCapitalize}
      autoCorrect={false}
      placeholder={placeholder}
      placeholderTextColor={palette.faintInk}
      secureTextEntry={secureTextEntry}
      value={value}
      onChangeText={onChangeText}
    />
  );
}

export function ProviderDropdown({
  label,
  value,
  providerIds,
  configuredProviderIds = [],
  onSelect,
  helperText,
}: {
  label: string;
  value: ProviderId;
  providerIds: ProviderId[];
  configuredProviderIds?: ProviderId[];
  onSelect: (next: ProviderId) => void;
  helperText?: string;
}) {
  const palette = useTheme();
  const styles = useThemedStyles(makeControlStyles);
  const [isOpen, setIsOpen] = useState(false);
  const selectedProvider = providerMap[value] ?? providerMap.openai;
  const selectedConfigured = configuredProviderIds.includes(selectedProvider.id);

  return (
    <FieldGroup>
      <Label text={label} />
      <Pressable
        style={styles.selectButton}
        onPress={() => setIsOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Choose ${label.toLowerCase()}`}
      >
        <ProviderIcon providerId={selectedProvider.id} />
        <View style={styles.selectCopy}>
          <Text style={styles.selectValue}>{selectedProvider.label}</Text>
          <Text style={styles.selectHint} numberOfLines={2}>
            {selectedProvider.description}
          </Text>
        </View>
        {/*
          Local needs no credentials, so a setup badge on it would be noise. For
          everyone else this is the screen's most load-bearing piece of state:
          a provider can now be selected before it is configured, so the gap has
          to be visible without opening the picker.
        */}
        {value !== 'local' && !selectedConfigured ? (
          <View style={styles.needsKeyPip}>
            <Feather name="alert-circle" size={13} color={palette.clay} />
            <Text style={styles.needsKeyPipText}>Key</Text>
          </View>
        ) : null}
        <Feather name="chevron-down" size={18} color={palette.mutedInk} />
      </Pressable>
      {helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}

      <Modal transparent animationType="fade" visible={isOpen} onRequestClose={() => setIsOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setIsOpen(false)}>
          <Pressable style={[styles.modalCard, styles.providerPickerModalCard]} onPress={() => undefined}>
            <Text style={styles.modalTitle}>{label}</Text>
            <Text style={styles.modalBody}>Pick one provider for this part of processing.</Text>

            <ScrollView style={styles.optionListScroll} contentContainerStyle={styles.optionList}>
              {providerIds.map((providerId) => {
                const selected = providerId === value;
                const provider = providerMap[providerId];
                const optionCopy = buildProviderPickerOptionCopy({
                  providerLabel: provider.label,
                  providerDescription: provider.description,
                  configured: configuredProviderIds.includes(providerId),
                });

                return (
                  <Pressable
                    key={providerId}
                    style={[styles.optionButton, selected && styles.optionButtonSelected]}
                    onPress={() => {
                      onSelect(providerId);
                      setIsOpen(false);
                    }}
                  >
                    <ProviderIcon providerId={providerId} />
                    <View style={styles.optionCopy}>
                      <View style={styles.optionHeader}>
                        <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                          {optionCopy.title}
                        </Text>
                        {providerId === 'local' ? null : (
                          <Text style={[styles.optionMeta, selected && styles.optionLabelSelected]}>
                            {optionCopy.statusLine}
                          </Text>
                        )}
                      </View>
                      <Text
                        style={[styles.optionDescription, selected && styles.optionLabelSelected]}
                        numberOfLines={2}
                      >
                        {optionCopy.description}
                      </Text>
                    </View>
                    {selected ? <Feather name="check" size={16} color={palette.paper} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable style={styles.modalCloseButton} onPress={() => setIsOpen(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </FieldGroup>
  );
}

export function ModelDropdown({
  label,
  value,
  options,
  onSelect,
  emptyText,
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onSelect: (next: string) => void;
  emptyText: string;
}) {
  const palette = useTheme();
  const styles = useThemedStyles(makeControlStyles);
  const [isOpen, setIsOpen] = useState(false);

  if (!options.length) {
    return (
      <FieldGroup>
        <Label text={label} />
        <Text style={styles.helperText}>{emptyText}</Text>
      </FieldGroup>
    );
  }

  const selectedLabel = options.find((option) => option.value === value)?.label;

  return (
    <FieldGroup>
      <Label text={label} />
      <Pressable
        style={styles.selectButton}
        onPress={() => setIsOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Choose ${label.toLowerCase()}`}
      >
        <View style={styles.selectCopy}>
          <Text style={styles.selectValue}>{selectedLabel || `Choose ${label.toLowerCase()}`}</Text>
        </View>
        <Feather name="chevron-down" size={18} color={palette.mutedInk} />
      </Pressable>

      <Modal transparent animationType="fade" visible={isOpen} onRequestClose={() => setIsOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setIsOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <Text style={styles.modalTitle}>{label}</Text>

            <View style={styles.optionList}>
              {options.map((option) => {
                const selected = option.value === value;

                return (
                  <Pressable
                    key={option.value}
                    style={[styles.optionButton, selected && styles.optionButtonSelected]}
                    onPress={() => {
                      onSelect(option.value);
                      setIsOpen(false);
                    }}
                  >
                    <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                      {option.label}
                    </Text>
                    {selected ? <Feather name="check" size={16} color={palette.paper} /> : null}
                  </Pressable>
                );
              })}
            </View>

            <Pressable style={styles.modalCloseButton} onPress={() => setIsOpen(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </FieldGroup>
  );
}

/**
 * Every control on the settings screen is built from this sheet, and it used to
 * be a module-scope StyleSheet over the static light palette — so the pickers,
 * their modals, and the API-key inputs all stayed cream-on-white after the rest
 * of the app went dark. It is the widest single source of unthemed colour left
 * in the app, which is why it reads as "the settings screen looks broken"
 * rather than as one bad component.
 */
const makeControlStyles = (palette: Palette) =>
  StyleSheet.create({
    fieldGroup: { gap: spacing.sm },
    label: {
      ...typography.label,
      ...type.label,
      color: palette.mutedInk,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    helperText: {
      color: palette.mutedInk,
      ...typography.body,
      ...type.label,
    },
    input: {
      backgroundColor: palette.cardUtility,
      borderRadius: radii.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: 14,
      ...typography.body,
      ...type.body,
      color: palette.ink,
    },
    selectButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: palette.cardUtility,
      borderRadius: radii.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: 14,
      gap: spacing.md,
    },
    selectCopy: { flex: 1, gap: 2 },
    selectValue: {
      color: palette.ink,
      ...typography.label,
      ...type.body,
    },
    selectHint: {
      color: palette.mutedInk,
      ...typography.body,
      ...type.caption,
    },
    needsKeyPip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: radii.pill,
      backgroundColor: palette.claySoft,
    },
    needsKeyPipText: {
      color: palette.clay,
      ...typography.label,
      ...type.micro,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: palette.scrim,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
    },
    modalCard: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: palette.card,
      borderRadius: radii.xl,
      padding: spacing.xl,
      gap: spacing.md,
    },
    providerPickerModalCard: { paddingBottom: spacing.lg },
    modalTitle: {
      color: palette.ink,
      ...typography.heading,
      ...type.heading,
    },
    modalBody: {
      color: palette.mutedInk,
      ...typography.body,
      ...type.label,
    },
    optionListScroll: { maxHeight: 360 },
    optionList: { gap: spacing.sm },
    optionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: palette.cardMuted,
      borderRadius: radii.md,
      paddingHorizontal: 14,
      paddingVertical: spacing.md,
    },
    optionButtonSelected: { backgroundColor: palette.accent },
    optionCopy: { flex: 1, gap: 2 },
    optionHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
    optionLabel: {
      color: palette.ink,
      ...typography.label,
      ...type.bodySm,
    },
    optionMeta: {
      color: palette.mutedInk,
      ...typography.body,
      ...type.caption,
    },
    optionDescription: {
      color: palette.mutedInk,
      ...typography.body,
      ...type.caption,
    },
    // The selected row sits on `accent`, which is dark viridian in light mode
    // and bright mint in dark — `paper` is the correct contrast partner for
    // both, where `onFill` would go white-on-mint in dark.
    optionLabelSelected: { color: palette.paper },
    modalCloseButton: {
      alignSelf: 'flex-end',
      paddingHorizontal: 14,
      paddingVertical: spacing.sm,
      borderRadius: radii.pill,
      backgroundColor: palette.cardMuted,
    },
    modalCloseText: {
      color: palette.ink,
      ...typography.label,
      ...type.label,
    },
  });
