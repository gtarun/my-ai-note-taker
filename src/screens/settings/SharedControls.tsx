import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { type ReactNode, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { palette, radii, typography } from '../../theme';
import { buildProviderPickerOptionCopy } from '../../features/settings/presentation';
import { providerMap } from '../../services/providers';
import type { ProviderId } from '../../types';
import { useTheme } from '../../hooks/useTheme';

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
  return <View style={controlStyles.fieldGroup}>{children}</View>;
}

export function Label({ text }: { text: string }) {
  return <Text style={controlStyles.label}>{text}</Text>;
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
  return (
    <TextInput
      style={controlStyles.input}
      autoCapitalize={autoCapitalize}
      autoCorrect={false}
      placeholder={placeholder}
      placeholderTextColor={palette.mutedInk}
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
  const [isOpen, setIsOpen] = useState(false);
  const selectedProvider = providerMap[value] ?? providerMap.openai;
  const selectedConfigured = configuredProviderIds.includes(selectedProvider.id);
  const hint =
    value === 'local'
      ? selectedProvider.description
      : `${selectedConfigured ? 'Configured' : 'Needs setup'} • ${selectedProvider.description}`;

  return (
    <FieldGroup>
      <Label text={label} />
      <Pressable
        style={controlStyles.selectButton}
        onPress={() => setIsOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Choose ${label.toLowerCase()}`}
      >
        <ProviderIcon providerId={selectedProvider.id} />
        <View style={controlStyles.selectCopy}>
          <Text style={controlStyles.selectValue}>{selectedProvider.label}</Text>
          <Text style={controlStyles.selectHint} numberOfLines={2}>
            {hint}
          </Text>
        </View>
        <Feather name="chevron-down" size={18} color={palette.ink} />
      </Pressable>
      {helperText ? <Text style={controlStyles.helperText}>{helperText}</Text> : null}

      <Modal transparent animationType="fade" visible={isOpen} onRequestClose={() => setIsOpen(false)}>
        <Pressable style={controlStyles.modalBackdrop} onPress={() => setIsOpen(false)}>
          <Pressable
            style={[controlStyles.modalCard, controlStyles.providerPickerModalCard]}
            onPress={() => undefined}
          >
            <Text style={controlStyles.modalTitle}>{label}</Text>
            <Text style={controlStyles.modalBody}>Pick one provider for this part of processing.</Text>

            <ScrollView style={controlStyles.optionListScroll} contentContainerStyle={controlStyles.optionList}>
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
                    style={[controlStyles.optionButton, selected && controlStyles.optionButtonSelected]}
                    onPress={() => {
                      onSelect(providerId);
                      setIsOpen(false);
                    }}
                  >
                    <ProviderIcon providerId={providerId} />
                    <View style={controlStyles.optionCopy}>
                      <View style={controlStyles.optionHeader}>
                        <Text
                          style={[controlStyles.optionLabel, selected && controlStyles.optionLabelSelected]}
                        >
                          {optionCopy.title}
                        </Text>
                        <Text
                          style={[controlStyles.optionMeta, selected && controlStyles.optionLabelSelected]}
                        >
                          {optionCopy.statusLine}
                        </Text>
                      </View>
                      <Text
                        style={[
                          controlStyles.optionDescription,
                          selected && controlStyles.optionLabelSelected,
                        ]}
                      >
                        {optionCopy.description}
                      </Text>
                    </View>
                    {selected ? <Feather name="check" size={16} color={palette.paper} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable style={controlStyles.modalCloseButton} onPress={() => setIsOpen(false)}>
              <Text style={controlStyles.modalCloseText}>Close</Text>
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
  const [isOpen, setIsOpen] = useState(false);

  if (!options.length) {
    return (
      <FieldGroup>
        <Label text={label} />
        <Text style={controlStyles.helperText}>{emptyText}</Text>
      </FieldGroup>
    );
  }

  const selectedLabel = options.find((option) => option.value === value)?.label;

  return (
    <FieldGroup>
      <Label text={label} />
      <Pressable
        style={controlStyles.selectButton}
        onPress={() => setIsOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Choose ${label.toLowerCase()}`}
      >
        <View style={controlStyles.selectCopy}>
          <Text style={controlStyles.selectValue}>{selectedLabel || `Choose ${label.toLowerCase()}`}</Text>
          <Text style={controlStyles.selectHint}>{options.length} options available</Text>
        </View>
        <Feather name="chevron-down" size={18} color={palette.ink} />
      </Pressable>

      <Modal transparent animationType="fade" visible={isOpen} onRequestClose={() => setIsOpen(false)}>
        <Pressable style={controlStyles.modalBackdrop} onPress={() => setIsOpen(false)}>
          <Pressable style={controlStyles.modalCard} onPress={() => undefined}>
            <Text style={controlStyles.modalTitle}>{label}</Text>
            <Text style={controlStyles.modalBody}>Pick one option for this processing step.</Text>

            <View style={controlStyles.optionList}>
              {options.map((option) => {
                const selected = option.value === value;

                return (
                  <Pressable
                    key={option.value}
                    style={[controlStyles.optionButton, selected && controlStyles.optionButtonSelected]}
                    onPress={() => {
                      onSelect(option.value);
                      setIsOpen(false);
                    }}
                  >
                    <Text style={[controlStyles.optionLabel, selected && controlStyles.optionLabelSelected]}>
                      {option.label}
                    </Text>
                    {selected ? <Feather name="check" size={16} color={palette.paper} /> : null}
                  </Pressable>
                );
              })}
            </View>

            <Pressable style={controlStyles.modalCloseButton} onPress={() => setIsOpen(false)}>
              <Text style={controlStyles.modalCloseText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </FieldGroup>
  );
}

export const controlStyles = StyleSheet.create({
  fieldGroup: { gap: 8 },
  label: {
    ...typography.label,
    fontSize: 13,
    color: palette.mutedInk,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  helperText: {
    color: palette.mutedInk,
    ...typography.body,
    fontSize: 13,
    lineHeight: 18,
  },
  input: {
    backgroundColor: palette.cardUtility,
    borderRadius: radii.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...typography.body,
    fontSize: 15,
    color: palette.ink,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.cardUtility,
    borderRadius: radii.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  selectCopy: { flex: 1, gap: 2 },
  selectValue: {
    color: palette.ink,
    ...typography.label,
    fontSize: 15,
  },
  selectHint: {
    color: palette.mutedInk,
    ...typography.body,
    fontSize: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 15, 16, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: palette.card,
    borderRadius: radii.xl,
    padding: 20,
    gap: 12,
  },
  providerPickerModalCard: { paddingBottom: 16 },
  modalTitle: {
    color: palette.ink,
    ...typography.heading,
    fontSize: 18,
  },
  modalBody: {
    color: palette.mutedInk,
    ...typography.body,
    fontSize: 13,
    lineHeight: 18,
  },
  optionListScroll: { maxHeight: 360 },
  optionList: { gap: 8 },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: palette.cardMuted,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  optionButtonSelected: { backgroundColor: palette.accent },
  optionCopy: { flex: 1, gap: 2 },
  optionHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  optionLabel: {
    color: palette.ink,
    ...typography.label,
    fontSize: 14,
  },
  optionMeta: {
    color: palette.mutedInk,
    ...typography.body,
    fontSize: 12,
  },
  optionDescription: {
    color: palette.mutedInk,
    ...typography.body,
    fontSize: 12,
    lineHeight: 16,
  },
  optionLabelSelected: { color: palette.paper },
  modalCloseButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: palette.cardMuted,
  },
  modalCloseText: {
    color: palette.ink,
    ...typography.label,
    fontSize: 13,
  },
});
