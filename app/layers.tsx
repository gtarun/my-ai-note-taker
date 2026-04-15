import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { FadeInView } from '../src/components/FadeInView';
import { ScreenBackground } from '../src/components/ScreenBackground';
import { PillButton, SectionHeading, SurfaceCard } from '../src/components/ui';
import { listExtractionLayers, saveExtractionLayer, deleteExtractionLayer } from '../src/services/extractionLayers';
import { ensureExtractionLayerSheet } from '../src/services/googleSheets';
import type { ExtractionLayer } from '../src/types';
import { palette, radii, typography } from '../src/theme';

type EditableField = {
  key: string;
  id: string;
  title: string;
  description: string;
};

type LayerDraft = {
  id?: string;
  name: string;
  fields: EditableField[];
};

export default function LayersScreen() {
  const [layers, setLayers] = useState<ExtractionLayer[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isEditorVisible, setIsEditorVisible] = useState(false);
  const [draft, setDraft] = useState<LayerDraft>(createEmptyDraft());
  const [isSaving, setIsSaving] = useState(false);
  const [connectingLayerId, setConnectingLayerId] = useState<string | null>(null);

  const loadLayers = useCallback(async () => {
    const nextLayers = await listExtractionLayers();
    setLayers(nextLayers);
    setIsLoaded(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadLayers();
    }, [loadLayers])
  );

  const connectedCount = useMemo(
    () => layers.filter((layer) => layer.spreadsheetId && layer.sheetTitle).length,
    [layers]
  );

  const openCreateModal = () => {
    setDraft(createEmptyDraft());
    setIsEditorVisible(true);
  };

  const openEditModal = (layer: ExtractionLayer) => {
    setDraft({
      id: layer.id,
      name: layer.name,
      fields: layer.fields.map((field) => ({
        key: `${field.id}-${Math.random().toString(36).slice(2, 8)}`,
        id: field.id,
        title: field.title,
        description: field.description,
      })),
    });
    setIsEditorVisible(true);
  };

  const closeEditor = () => {
    if (isSaving) {
      return;
    }

    setIsEditorVisible(false);
    setDraft(createEmptyDraft());
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);

      await saveExtractionLayer({
        id: draft.id,
        name: draft.name,
        fields: draft.fields.map((field) => ({
          id: field.id,
          title: field.title,
          description: field.description,
        })),
      });

      await loadLayers();
      closeEditor();
    } catch (error) {
      Alert.alert('Save failed', error instanceof Error ? error.message : 'Unable to save this extraction layer.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (layer: ExtractionLayer) => {
    Alert.alert('Delete layer?', `Remove ${layer.name} and its field schema?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteExtractionLayer(layer.id);
            await loadLayers();
          } catch (error) {
            Alert.alert('Delete failed', error instanceof Error ? error.message : 'Unable to delete this layer.');
          }
        },
      },
    ]);
  };

  const handleConnectSheet = async (layer: ExtractionLayer) => {
    try {
      setConnectingLayerId(layer.id);
      const connection = await ensureExtractionLayerSheet(layer);
      await saveExtractionLayer({
        id: layer.id,
        name: layer.name,
        fields: layer.fields,
        spreadsheetId: connection.spreadsheetId,
        spreadsheetTitle: connection.spreadsheetTitle,
        sheetTitle: connection.sheetTitle,
      });
      await loadLayers();
      Alert.alert('Google Sheets ready', `${layer.name} is now connected to ${connection.spreadsheetTitle}.`);
    } catch (error) {
      Alert.alert(
        'Sheet setup failed',
        error instanceof Error ? error.message : 'Unable to prepare the Google Sheet for this layer.'
      );
    } finally {
      setConnectingLayerId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenBackground />
      <ScrollView contentContainerStyle={styles.container}>
        <FadeInView>
          <SectionHeading
            title="Extraction layers"
            subtitle="Define reusable field schemas, attach them at analysis time, and send approved rows to Google Sheets."
          />
        </FadeInView>

        <FadeInView delay={40}>
          <SurfaceCard muted style={styles.heroCard}>
            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <Text style={styles.heroLabel}>Layers</Text>
                <Text style={styles.heroValue}>{layers.length}</Text>
              </View>
              <View style={styles.heroStat}>
                <Text style={styles.heroLabel}>Sheets ready</Text>
                <Text style={styles.heroValue}>{connectedCount}</Text>
              </View>
            </View>
            <Text style={styles.heroBody}>
              Each layer can define its own Google Sheet destination. After a meeting is analyzed, users can review and edit the extracted values before syncing.
            </Text>
            <View style={styles.heroActions}>
              <PillButton
                label="New layer"
                icon={<Feather name="plus" size={18} color={palette.card} />}
                onPress={openCreateModal}
              />
            </View>
          </SurfaceCard>
        </FadeInView>

        {isLoaded && !layers.length ? (
          <FadeInView delay={80}>
            <SurfaceCard style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No extraction layers yet</Text>
              <Text style={styles.emptyBody}>
                Start with a schema for names, qualification, issue, or any other fields you want the AI to pull from transcripts.
              </Text>
            </SurfaceCard>
          </FadeInView>
        ) : null}

        {layers.map((layer, index) => (
          <FadeInView key={layer.id} delay={80 + index * 30}>
            <SurfaceCard style={styles.layerCard}>
              <View style={styles.layerHeader}>
                <View style={styles.layerCopy}>
                  <Text style={styles.layerTitle}>{layer.name}</Text>
                  <Text style={styles.layerMeta}>
                    {layer.fields.length} fields
                    {layer.spreadsheetTitle ? ` • ${layer.spreadsheetTitle}` : ' • Google Sheet not connected yet'}
                  </Text>
                </View>
                <View style={[styles.sheetBadge, layer.spreadsheetId ? styles.sheetBadgeReady : null]}>
                  <Text style={[styles.sheetBadgeText, layer.spreadsheetId ? styles.sheetBadgeTextReady : null]}>
                    {layer.spreadsheetId ? 'Sheets ready' : 'Needs sheet'}
                  </Text>
                </View>
              </View>

              <View style={styles.fieldPreviewList}>
                {layer.fields.map((field) => (
                  <View key={field.id} style={styles.fieldPreviewRow}>
                    <Text style={styles.fieldPreviewTitle}>{field.title}</Text>
                    <Text style={styles.fieldPreviewMeta}>{field.id}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.cardActions}>
                <PillButton label="Edit" onPress={() => openEditModal(layer)} variant="ghost" />
                <PillButton
                  label={connectingLayerId === layer.id ? 'Connecting…' : layer.spreadsheetId ? 'Refresh sheet' : 'Connect sheet'}
                  onPress={() => handleConnectSheet(layer)}
                  variant="secondary"
                  disabled={connectingLayerId === layer.id}
                />
                <PillButton label="Delete" onPress={() => handleDelete(layer)} variant="ghost" />
              </View>
            </SurfaceCard>
          </FadeInView>
        ))}
      </ScrollView>

      <Modal visible={isEditorVisible} animationType="slide" transparent onRequestClose={closeEditor}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{draft.id ? 'Edit layer' : 'New layer'}</Text>
                <Pressable onPress={closeEditor} hitSlop={10}>
                  <Feather name="x" size={20} color={palette.ink} />
                </Pressable>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Layer name</Text>
                <TextInput
                  style={styles.input}
                  value={draft.name}
                  onChangeText={(value) => setDraft((current) => ({ ...current, name: value }))}
                  placeholder="Lead intake"
                  placeholderTextColor={palette.mutedInk}
                />
              </View>

              <View style={styles.formSectionHeader}>
                <Text style={styles.inputLabel}>Fields</Text>
                <PillButton
                  label="Add field"
                  onPress={() =>
                    setDraft((current) => ({
                      ...current,
                      fields: [...current.fields, createEditableField()],
                    }))
                  }
                  variant="secondary"
                />
              </View>

              {draft.fields.map((field) => (
                <View key={field.key} style={styles.fieldEditorCard}>
                  <View style={styles.fieldEditorHeader}>
                    <Text style={styles.fieldEditorTitle}>Field</Text>
                    {draft.fields.length > 1 ? (
                      <Pressable
                        onPress={() =>
                          setDraft((current) => ({
                            ...current,
                            fields: current.fields.filter((entry) => entry.key !== field.key),
                          }))
                        }
                        hitSlop={10}
                      >
                        <Feather name="trash-2" size={16} color={palette.danger} />
                      </Pressable>
                    ) : null}
                  </View>

                  <TextInput
                    style={styles.input}
                    value={field.id}
                    onChangeText={(value) =>
                      setDraft((current) => ({
                        ...current,
                        fields: current.fields.map((entry) =>
                          entry.key === field.key ? { ...entry, id: value } : entry
                        ),
                      }))
                    }
                    placeholder="field_id"
                    autoCapitalize="none"
                    placeholderTextColor={palette.mutedInk}
                  />
                  <TextInput
                    style={styles.input}
                    value={field.title}
                    onChangeText={(value) =>
                      setDraft((current) => ({
                        ...current,
                        fields: current.fields.map((entry) =>
                          entry.key === field.key ? { ...entry, title: value } : entry
                        ),
                      }))
                    }
                    placeholder="Field title"
                    placeholderTextColor={palette.mutedInk}
                  />
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={field.description}
                    onChangeText={(value) =>
                      setDraft((current) => ({
                        ...current,
                        fields: current.fields.map((entry) =>
                          entry.key === field.key ? { ...entry, description: value } : entry
                        ),
                      }))
                    }
                    placeholder="What should the AI extract here?"
                    placeholderTextColor={palette.mutedInk}
                    multiline
                  />
                </View>
              ))}
            </ScrollView>

            <View style={styles.modalActions}>
              <PillButton label="Cancel" onPress={closeEditor} variant="ghost" />
              <PillButton label={isSaving ? 'Saving…' : 'Save layer'} onPress={handleSave} disabled={isSaving} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function createEditableField(): EditableField {
  return {
    key: Math.random().toString(36).slice(2, 10),
    id: '',
    title: '',
    description: '',
  };
}

function createEmptyDraft(): LayerDraft {
  return {
    name: '',
    fields: [createEditableField()],
  };
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.paper,
  },
  container: {
    padding: 20,
    gap: 16,
    paddingBottom: 36,
  },
  heroCard: {
    gap: 14,
  },
  heroStats: {
    flexDirection: 'row',
    gap: 24,
  },
  heroStat: {
    gap: 4,
  },
  heroLabel: {
    color: palette.mutedInk,
    fontFamily: typography.label.fontFamily,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroValue: {
    color: palette.ink,
    fontFamily: typography.heading.fontFamily,
    fontSize: 28,
  },
  heroBody: {
    color: palette.mutedInk,
    fontFamily: typography.body.fontFamily,
    fontSize: 14,
    lineHeight: 21,
  },
  heroActions: {
    alignItems: 'flex-start',
  },
  emptyCard: {
    gap: 8,
  },
  emptyTitle: {
    color: palette.ink,
    fontFamily: typography.heading.fontFamily,
    fontSize: 20,
  },
  emptyBody: {
    color: palette.mutedInk,
    fontFamily: typography.body.fontFamily,
    fontSize: 14,
    lineHeight: 21,
  },
  layerCard: {
    gap: 14,
  },
  layerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  layerCopy: {
    flex: 1,
    gap: 4,
  },
  layerTitle: {
    color: palette.ink,
    fontFamily: typography.heading.fontFamily,
    fontSize: 20,
  },
  layerMeta: {
    color: palette.mutedInk,
    fontFamily: typography.body.fontFamily,
    fontSize: 13,
    lineHeight: 20,
  },
  sheetBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: palette.cardStrong,
    alignSelf: 'flex-start',
  },
  sheetBadgeReady: {
    backgroundColor: '#d7f4e5',
  },
  sheetBadgeText: {
    color: palette.ink,
    fontFamily: typography.label.fontFamily,
    fontSize: 12,
  },
  sheetBadgeTextReady: {
    color: '#146c43',
  },
  fieldPreviewList: {
    gap: 8,
  },
  fieldPreviewRow: {
    padding: 12,
    borderRadius: radii.card,
    backgroundColor: palette.cardStrong,
    gap: 2,
  },
  fieldPreviewTitle: {
    color: palette.ink,
    fontFamily: typography.label.fontFamily,
    fontSize: 14,
  },
  fieldPreviewMeta: {
    color: palette.mutedInk,
    fontFamily: typography.body.fontFamily,
    fontSize: 12,
  },
  cardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginLeft: -8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(22, 29, 37, 0.32)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    maxHeight: '92%',
    backgroundColor: palette.paper,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  modalContent: {
    padding: 20,
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    color: palette.ink,
    fontFamily: typography.heading.fontFamily,
    fontSize: 24,
  },
  formGroup: {
    gap: 8,
  },
  formSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  inputLabel: {
    color: palette.ink,
    fontFamily: typography.label.fontFamily,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radii.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: palette.ink,
    fontFamily: typography.body.fontFamily,
    fontSize: 15,
    backgroundColor: palette.card,
  },
  textArea: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  fieldEditorCard: {
    gap: 10,
    padding: 14,
    borderRadius: radii.card,
    backgroundColor: palette.cardStrong,
  },
  fieldEditorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldEditorTitle: {
    color: palette.ink,
    fontFamily: typography.label.fontFamily,
    fontSize: 14,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: palette.line,
  },
});
