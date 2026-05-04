import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PillButton, StatusChip } from '../../components/ui';
import { palette, radii, typography } from '../../theme';
import { providerMap } from '../../services/providers';
import type { ProviderConfig, ProviderId } from '../../types';
import { FieldGroup, Label, ModelDropdown, PlainInput, ProviderIcon } from './SharedControls';

type ProviderConfigSheetProps = {
  visible: boolean;
  providerId: ProviderId;
  config: ProviderConfig;
  configured: boolean;
  isSaving: boolean;
  onChange: (key: keyof ProviderConfig, value: string) => void;
  onSave: () => void;
  onClear: () => void;
  onClose: () => void;
};

export function ProviderConfigSheet({
  visible,
  providerId,
  config,
  configured,
  isSaving,
  onChange,
  onSave,
  onClear,
  onClose,
}: ProviderConfigSheetProps) {
  const provider = providerMap[providerId];
  const isCustom = providerId === 'custom';
  const [showAdvancedEndpoint, setShowAdvancedEndpoint] = useState(false);

  // Reset advanced toggle each time the sheet opens for a different provider.
  useEffect(() => {
    if (!visible) {
      setShowAdvancedEndpoint(false);
    }
  }, [visible, providerId]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <View style={styles.headerTitleRow}>
                <ProviderIcon providerId={providerId} />
                <Text style={styles.title}>{provider.label}</Text>
              </View>
              <Text style={styles.body}>{provider.description}</Text>
            </View>
            <StatusChip
              label={configured ? 'Configured' : 'Not configured'}
              tone={configured ? 'secondary' : 'tertiary'}
            />
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <FieldGroup>
              <Label text="API key" />
              <PlainInput
                value={config.apiKey}
                onChangeText={(value) => onChange('apiKey', value)}
                placeholder={provider.apiKeyPlaceholder}
                secureTextEntry
              />
            </FieldGroup>

            {provider.supportsTranscription ? (
              <ModelDropdown
                label="Default transcription model"
                value={config.transcriptionModel}
                options={provider.transcriptionModels.map((modelId) => ({ label: modelId, value: modelId }))}
                onSelect={(value) => onChange('transcriptionModel', value)}
                emptyText="This provider does not publish preset transcription models yet."
              />
            ) : null}

            {provider.supportsSummary ? (
              <ModelDropdown
                label="Default summary model"
                value={config.summaryModel}
                options={provider.summaryModels.map((modelId) => ({ label: modelId, value: modelId }))}
                onSelect={(value) => onChange('summaryModel', value)}
                emptyText="This provider does not publish preset summary models yet."
              />
            ) : null}

            {isCustom || showAdvancedEndpoint ? (
              <FieldGroup>
                <Label text={isCustom ? 'Base URL' : 'Advanced base URL'} />
                <PlainInput
                  value={config.baseUrl}
                  onChangeText={(value) => onChange('baseUrl', value)}
                  placeholder={provider.baseUrlPlaceholder}
                />
              </FieldGroup>
            ) : (
              <PillButton
                label="Show advanced endpoint"
                onPress={() => setShowAdvancedEndpoint(true)}
                variant="ghost"
                icon={<Feather name="sliders" size={16} color={palette.ink} />}
              />
            )}
          </ScrollView>

          <View style={styles.footer}>
            <PillButton
              label={isSaving ? 'Saving…' : 'Save'}
              onPress={onSave}
              disabled={isSaving}
            />
            <PillButton label="Clear key" onPress={onClear} variant="secondary" />
            <PillButton label="Close" onPress={onClose} variant="ghost" />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 15, 16, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: palette.card,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    maxHeight: '90%',
    gap: 16,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: palette.line,
    opacity: 0.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerCopy: { flex: 1, gap: 6 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: {
    color: palette.ink,
    fontFamily: typography.heading.fontFamily,
    fontSize: 20,
  },
  body: {
    color: palette.mutedInk,
    fontFamily: typography.body.fontFamily,
    fontSize: 13,
    lineHeight: 18,
  },
  scroll: { maxHeight: 480 },
  scrollContent: { gap: 16, paddingBottom: 8 },
  footer: { gap: 10 },
});
