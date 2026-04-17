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

import { FadeInView } from '../components/FadeInView';
import { ScreenBackground } from '../components/ScreenBackground';
import { PillButton, SectionHeading, SurfaceCard } from '../components/ui';
import {
  applySheetSelection,
  createDraftFromLayer,
  createEditableField,
  createEmptyDraft,
  toSaveLayerInput,
  type EditableField,
  type LayerDraft,
} from '../features/layers/draft';
import { deleteExtractionLayer, listExtractionLayers, saveExtractionLayer } from '../services/extractionLayers';
import {
  browseRecentSpreadsheets,
  ensureExtractionLayerSheet,
  getSpreadsheetTabsAndHeaders,
  searchSpreadsheets,
} from '../services/googleSheets';
import type { ExtractionLayer, SpreadsheetBrowserSpreadsheet } from '../types';
import { palette, radii, typography } from '../theme';

export default function LayersScreen() {
  const [layers, setLayers] = useState<ExtractionLayer[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isEditorVisible, setIsEditorVisible] = useState(false);
  const [isSheetPickerVisible, setIsSheetPickerVisible] = useState(false);
  const [draft, setDraft] = useState<LayerDraft>(createEmptyDraft());
  const [isSaving, setIsSaving] = useState(false);
  const [isPreparingSheet, setIsPreparingSheet] = useState(false);
  const [sheetPickerStep, setSheetPickerStep] = useState<'browse' | 'tabs' | 'choice'>('browse');
  const [recentSpreadsheets, setRecentSpreadsheets] = useState<SpreadsheetBrowserSpreadsheet[]>([]);
  const [searchResults, setSearchResults] = useState<SpreadsheetBrowserSpreadsheet[]>([]);
  const [spreadsheetSearch, setSpreadsheetSearch] = useState('');
  const [selectedSpreadsheet, setSelectedSpreadsheet] = useState<SpreadsheetBrowserSpreadsheet | null>(null);
  const [availableTabs, setAvailableTabs] = useState<string[]>([]);
  const [selectedTab, setSelectedTab] = useState<string | null>(null);
  const [availableHeaders, setAvailableHeaders] = useState<string[]>([]);
  const [isLoadingRecent, setIsLoadingRecent] = useState(false);
  const [isSearchingSheets, setIsSearchingSheets] = useState(false);
  const [isLoadingTabs, setIsLoadingTabs] = useState(false);
  const [isFieldEditorVisible, setIsFieldEditorVisible] = useState(false);
  const [activeField, setActiveField] = useState<EditableField | null>(null);

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

  const resetEditorState = useCallback((nextDraft: LayerDraft) => {
    setDraft(nextDraft);
    setActiveField(null);
    setIsFieldEditorVisible(false);
  }, []);

  const resetSheetPickerState = useCallback(() => {
    setSheetPickerStep('browse');
    setRecentSpreadsheets([]);
    setSearchResults([]);
    setSpreadsheetSearch('');
    setSelectedSpreadsheet(null);
    setAvailableTabs([]);
    setSelectedTab(null);
    setAvailableHeaders([]);
  }, []);

  const loadRecentSpreadsheetOptions = useCallback(async () => {
    try {
      setIsLoadingRecent(true);
      const data = await browseRecentSpreadsheets();
      setRecentSpreadsheets(data.spreadsheets ?? []);
    } catch (error) {
      Alert.alert('Google Sheets', error instanceof Error ? error.message : 'Unable to load recent spreadsheets.');
    } finally {
      setIsLoadingRecent(false);
    }
  }, []);

  const loadSpreadsheetDetails = useCallback(
    async (spreadsheet: SpreadsheetBrowserSpreadsheet, sheetTitle?: string) => {
      try {
        setIsLoadingTabs(true);
        const data = await getSpreadsheetTabsAndHeaders(spreadsheet.id, sheetTitle);
        setSelectedSpreadsheet({
          id: spreadsheet.id,
          title: data.spreadsheetTitle ?? spreadsheet.title,
          modifiedTime: spreadsheet.modifiedTime ?? null,
        });
        setAvailableTabs(data.tabs ?? []);
        setSelectedTab(sheetTitle ?? null);
        setAvailableHeaders(sheetTitle ? data.headers ?? [] : []);
        return data;
      } catch (error) {
        Alert.alert(
          'Google Sheets',
          error instanceof Error ? error.message : 'Unable to load tabs for this spreadsheet.'
        );
        return null;
      } finally {
        setIsLoadingTabs(false);
      }
    },
    []
  );

  const openSheetPicker = useCallback((nextDraft?: LayerDraft) => {
    const targetDraft = nextDraft ?? draft;
    setIsSheetPickerVisible(true);
    setSheetPickerStep(targetDraft.spreadsheetId && targetDraft.spreadsheetTitle ? 'tabs' : 'browse');
    setSearchResults([]);
    setSpreadsheetSearch('');
    setAvailableTabs([]);
    setSelectedTab(null);
    setAvailableHeaders([]);

    if (targetDraft.spreadsheetId && targetDraft.spreadsheetTitle) {
      setSelectedSpreadsheet({
        id: targetDraft.spreadsheetId,
        title: targetDraft.spreadsheetTitle,
        modifiedTime: null,
      });
      void loadSpreadsheetDetails(
        {
          id: targetDraft.spreadsheetId,
          title: targetDraft.spreadsheetTitle,
          modifiedTime: null,
        },
        targetDraft.sheetTitle ?? undefined
      );
    } else {
      setSelectedSpreadsheet(null);
      void loadRecentSpreadsheetOptions();
    }
  }, [draft, loadRecentSpreadsheetOptions, loadSpreadsheetDetails]);

  const closeSheetPicker = useCallback(() => {
    if (isSaving || isPreparingSheet) {
      return;
    }

    setIsSheetPickerVisible(false);
    resetSheetPickerState();
  }, [isPreparingSheet, isSaving, resetSheetPickerState]);

  const openCreateModal = () => {
    resetEditorState(createEmptyDraft());
    setIsEditorVisible(true);
  };

  const openEditModal = (layer: ExtractionLayer) => {
    const nextDraft = createDraftFromLayer(layer);
    resetEditorState(nextDraft);
    setIsEditorVisible(true);
  };

  const openSheetPickerFromLayerCard = (layer: ExtractionLayer) => {
    const nextDraft = createDraftFromLayer(layer);
    resetEditorState(nextDraft);
    setIsEditorVisible(true);
    openSheetPicker(nextDraft);
  };

  const closeEditor = () => {
    if (isSaving || isPreparingSheet) {
      return;
    }

    setIsEditorVisible(false);
    setIsSheetPickerVisible(false);
    resetEditorState(createEmptyDraft());
    resetSheetPickerState();
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await saveExtractionLayer(toSaveLayerInput(draft));
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

  const handleCreateOrRefreshSheet = async () => {
    const payload = toSaveLayerInput(draft);

    if (!payload.name.trim()) {
      Alert.alert('Layer name required', 'Add a layer name before creating a sheet.');
      return;
    }

    if (!payload.fields.length) {
      Alert.alert('Add fields first', 'Create at least one field before preparing a sheet.');
      return;
    }

    try {
      setIsPreparingSheet(true);
      const connection = await ensureExtractionLayerSheet({
        id: payload.id ?? 'draft-layer',
        name: payload.name,
        fields: payload.fields,
        spreadsheetId: payload.spreadsheetId,
        spreadsheetTitle: payload.spreadsheetTitle,
        sheetTitle: payload.sheetTitle,
      });

      setDraft((current) => ({
        ...current,
        spreadsheetId: connection.spreadsheetId,
        spreadsheetTitle: connection.spreadsheetTitle,
        sheetTitle: connection.sheetTitle,
      }));
      setSelectedSpreadsheet({
        id: connection.spreadsheetId,
        title: connection.spreadsheetTitle,
        modifiedTime: null,
      });
      setAvailableTabs((current) => Array.from(new Set([...current, connection.sheetTitle])));
      setSelectedTab(connection.sheetTitle);
      setIsSheetPickerVisible(false);
      setSheetPickerStep('browse');
      setAvailableHeaders([]);
      Alert.alert(
        'Google Sheets ready',
        `${payload.name} is now connected to ${connection.spreadsheetTitle} / ${connection.sheetTitle}.`
      );
    } catch (error) {
      Alert.alert(
        'Sheet setup failed',
        error instanceof Error ? error.message : 'Unable to prepare the Google Sheet for this layer.'
      );
    } finally {
      setIsPreparingSheet(false);
    }
  };

  const handleSearchSheets = async () => {
    const query = spreadsheetSearch.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }

    try {
      setIsSearchingSheets(true);
      const data = await searchSpreadsheets(query);
      setSearchResults(data.spreadsheets ?? []);
    } catch (error) {
      Alert.alert('Google Sheets', error instanceof Error ? error.message : 'Unable to search spreadsheets.');
    } finally {
      setIsSearchingSheets(false);
    }
  };

  const handleSelectSpreadsheet = async (spreadsheet: SpreadsheetBrowserSpreadsheet) => {
    const details = await loadSpreadsheetDetails(spreadsheet);
    if (details && !(details.tabs ?? []).length) {
      Alert.alert('No tabs found', 'This spreadsheet has no visible tabs yet.');
    }
    if (details && (details.tabs ?? []).length) {
      setSheetPickerStep('tabs');
    }
  };

  const handleSelectTab = async (tabTitle: string) => {
    if (!selectedSpreadsheet) {
      return;
    }

    const details = await loadSpreadsheetDetails(selectedSpreadsheet, tabTitle);
    if (!details) {
      return;
    }

    const spreadsheetTitle = details.spreadsheetTitle ?? selectedSpreadsheet.title;
    const headers = details.headers ?? [];

    setSelectedTab(tabTitle);
    setAvailableHeaders(headers);
    setSheetPickerStep('choice');

    if (!headers.length) {
      Alert.alert(
        'No headers found',
        'This tab has no header row yet. You can still keep your current fields or import nothing.'
      );
    }
    setSelectedSpreadsheet((current) =>
      current
        ? {
            ...current,
            title: spreadsheetTitle,
          }
        : current
    );
  };

  const applySheetChoice = useCallback(
    (mode: 'keep' | 'import') => {
      if (!selectedSpreadsheet || !selectedTab) {
        return;
      }

      setDraft((current) =>
        applySheetSelection(current, {
          spreadsheetId: selectedSpreadsheet.id,
          spreadsheetTitle: selectedSpreadsheet.title,
          sheetTitle: selectedTab,
          headers: availableHeaders,
          mode,
        })
      );
      closeSheetPicker();
    },
    [availableHeaders, closeSheetPicker, selectedSpreadsheet, selectedTab]
  );

  const handleChooseKeepCurrentFields = useCallback(() => {
    applySheetChoice('keep');
  }, [applySheetChoice]);

  const handleChooseImportColumns = useCallback(() => {
    applySheetChoice('import');
    if (!availableHeaders.length) {
      Alert.alert('No headers found', 'This tab has no header row yet, so your current fields were kept.');
    }
  }, [applySheetChoice, availableHeaders.length]);

  const openFieldEditor = (field?: EditableField) => {
    setActiveField(field ? { ...field } : createEditableField());
    setIsFieldEditorVisible(true);
  };

  const closeFieldEditor = () => {
    setIsFieldEditorVisible(false);
    setActiveField(null);
  };

  const handleSaveField = () => {
    if (!activeField) {
      return;
    }

    const nextField = {
      ...activeField,
      id: activeField.id.trim(),
      title: activeField.title.trim(),
      description: activeField.description.trim(),
    };

    if (!nextField.id || !nextField.title) {
      Alert.alert('Field details required', 'Each field needs both an ID and a title.');
      return;
    }

    setDraft((current) => {
      const exists = current.fields.some((field) => field.key === nextField.key);
      return {
        ...current,
        fields: exists
          ? current.fields.map((field) => (field.key === nextField.key ? nextField : field))
          : [...current.fields, nextField],
      };
    });
    closeFieldEditor();
  };

  const handleDeleteField = () => {
    if (!activeField) {
      return;
    }

    setDraft((current) => ({
      ...current,
      fields: current.fields.filter((field) => field.key !== activeField.key),
    }));
    closeFieldEditor();
  };

  const currentDestination = draft.spreadsheetTitle
    ? `${draft.spreadsheetTitle}${draft.sheetTitle ? ` • ${draft.sheetTitle}` : ''}`
    : 'No sheet connected yet.';
  const sheetPickerTitle = draft.spreadsheetId ? 'Change sheet' : 'Connect sheet';

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
              Build reusable extraction schemas, attach them at analysis time, and send approved rows to the right Google Sheet tab.
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
                    {layer.spreadsheetTitle
                      ? ` • ${layer.spreadsheetTitle}${layer.sheetTitle ? ` / ${layer.sheetTitle}` : ''}`
                      : ' • Google Sheet not connected yet'}
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
                  label={layer.spreadsheetId ? 'Change sheet' : 'Connect sheet'}
                  onPress={() => openSheetPickerFromLayerCard(layer)}
                  variant="secondary"
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

              <View style={styles.sheetSection}>
                <View style={styles.sheetSummaryCard}>
                  <Text style={styles.sheetSummaryLabel}>Sheet destination</Text>
                  <Text style={styles.sheetSummaryTitle}>
                    {draft.spreadsheetTitle ? currentDestination : 'No sheet connected yet'}
                  </Text>
                  {draft.spreadsheetTitle ? (
                    <Text style={styles.sheetSummaryBody}>
                      {draft.sheetTitle
                        ? 'This layer will save into the connected spreadsheet tab.'
                        : 'Choose a tab to finish connecting this layer.'}
                    </Text>
                  ) : (
                    <Text style={styles.sheetSummaryBody}>
                      Connect this layer to a spreadsheet and tab before saving rows.
                    </Text>
                  )}
                  <View style={styles.sheetSummaryActions}>
                    <PillButton
                      label={sheetPickerTitle}
                      onPress={openSheetPicker}
                      variant="secondary"
                    />
                  </View>
                </View>
              </View>

              <View style={styles.formSectionHeader}>
                <Text style={styles.inputLabel}>Fields</Text>
                <PillButton label="Add field" onPress={() => openFieldEditor()} variant="secondary" />
              </View>

              {draft.fields.length ? (
                <View style={styles.fieldList}>
                  {draft.fields.map((field) => (
                    <Pressable key={field.key} style={styles.fieldListRow} onPress={() => openFieldEditor(field)}>
                      <View style={styles.fieldListCopy}>
                        <Text style={styles.fieldListTitle}>{field.title}</Text>
                        <Text style={styles.fieldListMeta}>{field.id}</Text>
                      </View>
                      <Feather name="chevron-right" size={18} color={palette.mutedInk} />
                    </Pressable>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyFieldsCard}>
                  <Text style={styles.emptyFieldsTitle}>No fields yet</Text>
                  <Text style={styles.emptyFieldsBody}>Add a field to describe what the AI should extract.</Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <PillButton label="Cancel" onPress={closeEditor} variant="ghost" />
              <PillButton label={isSaving ? 'Saving…' : 'Save layer'} onPress={handleSave} disabled={isSaving} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={isSheetPickerVisible} animationType="slide" transparent onRequestClose={closeSheetPicker}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderCopy}>
                  <Text style={styles.modalTitle}>{sheetPickerTitle}</Text>
                  <Text style={styles.modalSubtitle}>
                    Search for a spreadsheet, pick a tab, then choose whether to keep your current fields or import the tab headers.
                  </Text>
                </View>
                <Pressable onPress={closeSheetPicker} hitSlop={10}>
                  <Feather name="x" size={20} color={palette.ink} />
                </Pressable>
              </View>

              {sheetPickerStep === 'browse' ? (
                <View style={styles.sheetPickerSection}>
                  <View style={styles.searchSection}>
                    <Text style={styles.smallSectionLabel}>Search spreadsheets</Text>
                    <View style={styles.searchRow}>
                      <TextInput
                        style={[styles.input, styles.searchInput]}
                        value={spreadsheetSearch}
                        onChangeText={setSpreadsheetSearch}
                        placeholder="Search by spreadsheet name"
                        placeholderTextColor={palette.mutedInk}
                      />
                      <PillButton
                        label={isSearchingSheets ? 'Searching…' : 'Search'}
                        onPress={() => void handleSearchSheets()}
                        variant="secondary"
                        disabled={isSearchingSheets}
                      />
                    </View>
                  </View>

                  <View style={styles.sheetPickerActions}>
                    <PillButton
                      label={isPreparingSheet ? 'Preparing…' : 'Create new sheet'}
                      onPress={handleCreateOrRefreshSheet}
                      variant="secondary"
                      disabled={isPreparingSheet}
                    />
                  </View>

                  {isLoadingRecent ? <Text style={styles.optionBody}>Loading recent spreadsheets…</Text> : null}

                  {recentSpreadsheets.length ? (
                    <View style={styles.optionList}>
                      <Text style={styles.smallSectionLabel}>Recent spreadsheets</Text>
                      {recentSpreadsheets.slice(0, 4).map((spreadsheet) => (
                        <Pressable
                          key={spreadsheet.id}
                          style={styles.optionRow}
                          onPress={() => void handleSelectSpreadsheet(spreadsheet)}
                        >
                          <Text style={styles.optionTitle}>{spreadsheet.title}</Text>
                          <Text style={styles.optionBody}>
                            {spreadsheet.modifiedTime
                              ? new Date(spreadsheet.modifiedTime).toLocaleDateString()
                              : 'Recent'}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}

                  {searchResults.length ? (
                    <View style={styles.optionList}>
                      <Text style={styles.smallSectionLabel}>Search results</Text>
                      {searchResults.map((spreadsheet) => (
                        <Pressable
                          key={spreadsheet.id}
                          style={styles.optionRow}
                          onPress={() => void handleSelectSpreadsheet(spreadsheet)}
                        >
                          <Text style={styles.optionTitle}>{spreadsheet.title}</Text>
                          <Text style={styles.optionBody}>Tap to pick tabs</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : null}

              {sheetPickerStep === 'tabs' || sheetPickerStep === 'choice' ? (
                <View style={styles.sheetPickerSection}>
                  <View style={styles.sheetSummaryCard}>
                    <Text style={styles.sheetSummaryLabel}>Selected spreadsheet</Text>
                    <Text style={styles.sheetSummaryTitle}>{selectedSpreadsheet?.title ?? 'Unknown spreadsheet'}</Text>
                    <Text style={styles.sheetSummaryBody}>
                      {sheetPickerStep === 'choice'
                        ? `Tab: ${selectedTab ?? 'Unknown tab'}`
                        : 'Pick the tab you want to use.'}
                    </Text>
                  </View>

                  <View style={styles.sheetPickerActions}>
                    <PillButton
                      label="Browse spreadsheets"
                      onPress={() => {
                        setSheetPickerStep('browse');
                        setSelectedTab(null);
                        setAvailableHeaders([]);
                        setAvailableTabs([]);
                        void loadRecentSpreadsheetOptions();
                      }}
                      variant="ghost"
                    />
                  </View>

                  {isLoadingTabs ? <Text style={styles.optionBody}>Loading tabs…</Text> : null}

                  {sheetPickerStep === 'tabs' ? (
                    <View style={styles.optionList}>
                      {availableTabs.map((tab) => {
                        const isSelected = selectedTab === tab;
                        return (
                          <Pressable
                            key={tab}
                            style={[styles.optionRow, isSelected ? styles.optionRowSelected : null]}
                            onPress={() => void handleSelectTab(tab)}
                          >
                            <Text style={styles.optionTitle}>{tab}</Text>
                            <Text style={styles.optionBody}>
                              {isSelected ? 'Selected' : 'Tap to keep fields or import columns'}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}

                  {sheetPickerStep === 'choice' ? (
                    <View style={styles.choiceCard}>
                      <Text style={styles.choiceTitle}>Use sheet columns?</Text>
                      <Text style={styles.choiceBody}>
                        {availableHeaders.length
                          ? 'Import the tab header row into this layer, or keep your current fields.'
                          : 'This tab has no visible headers, so importing will keep your current fields.'}
                      </Text>
                      <View style={styles.choiceActions}>
                        <PillButton label="Keep current fields" onPress={handleChooseKeepCurrentFields} variant="ghost" />
                        <PillButton label="Import columns" onPress={handleChooseImportColumns} />
                      </View>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={isFieldEditorVisible} animationType="slide" transparent onRequestClose={closeFieldEditor}>
        <View style={styles.modalBackdrop}>
          <View style={styles.fieldModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{activeField ? 'Field details' : 'New field'}</Text>
              <Pressable onPress={closeFieldEditor} hitSlop={10}>
                <Feather name="x" size={20} color={palette.ink} />
              </Pressable>
            </View>

            {activeField ? (
              <View style={styles.fieldModalContent}>
                <TextInput
                  style={styles.input}
                  value={activeField.id}
                  onChangeText={(value) => setActiveField((current) => (current ? { ...current, id: value } : current))}
                  placeholder="field_id"
                  autoCapitalize="none"
                  placeholderTextColor={palette.mutedInk}
                />
                <TextInput
                  style={styles.input}
                  value={activeField.title}
                  onChangeText={(value) =>
                    setActiveField((current) => (current ? { ...current, title: value } : current))
                  }
                  placeholder="Field title"
                  placeholderTextColor={palette.mutedInk}
                />
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={activeField.description}
                  onChangeText={(value) =>
                    setActiveField((current) => (current ? { ...current, description: value } : current))
                  }
                  placeholder="What should the AI extract here?"
                  placeholderTextColor={palette.mutedInk}
                  multiline
                />
              </View>
            ) : null}

            <View style={styles.modalActions}>
              {activeField && draft.fields.some((field) => field.key === activeField.key) ? (
                <PillButton label="Delete" onPress={handleDeleteField} variant="ghost" />
              ) : (
                <PillButton label="Cancel" onPress={closeFieldEditor} variant="ghost" />
              )}
              <PillButton label="Save field" onPress={handleSaveField} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
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
  fieldModalCard: {
    backgroundColor: palette.paper,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    gap: 16,
  },
  modalContent: {
    padding: 20,
    gap: 18,
  },
  fieldModalContent: {
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  modalHeaderCopy: {
    flex: 1,
    gap: 6,
  },
  modalTitle: {
    color: palette.ink,
    fontFamily: typography.heading.fontFamily,
    fontSize: 24,
  },
  modalSubtitle: {
    color: palette.mutedInk,
    fontFamily: typography.body.fontFamily,
    fontSize: 13,
    lineHeight: 19,
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
  smallSectionLabel: {
    color: palette.mutedInk,
    fontFamily: typography.label.fontFamily,
    fontSize: 12,
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
  searchInput: {
    flex: 1,
  },
  textArea: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  sheetSection: {
    gap: 12,
  },
  sheetSummaryCard: {
    gap: 6,
    padding: 14,
    borderRadius: radii.card,
    backgroundColor: palette.cardStrong,
  },
  sheetSummaryLabel: {
    color: palette.mutedInk,
    fontFamily: typography.label.fontFamily,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sheetSummaryTitle: {
    color: palette.ink,
    fontFamily: typography.heading.fontFamily,
    fontSize: 18,
  },
  sheetSummaryBody: {
    color: palette.mutedInk,
    fontFamily: typography.body.fontFamily,
    fontSize: 13,
    lineHeight: 20,
  },
  sheetSummaryActions: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  sheetPickerSection: {
    gap: 12,
  },
  searchSection: {
    gap: 8,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  optionList: {
    gap: 8,
  },
  optionRow: {
    padding: 12,
    borderRadius: radii.card,
    backgroundColor: palette.cardStrong,
    gap: 4,
  },
  optionRowSelected: {
    borderWidth: 1,
    borderColor: palette.accent,
  },
  optionTitle: {
    color: palette.ink,
    fontFamily: typography.label.fontFamily,
    fontSize: 14,
  },
  optionBody: {
    color: palette.mutedInk,
    fontFamily: typography.body.fontFamily,
    fontSize: 12,
    lineHeight: 18,
  },
  sheetPickerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  choiceCard: {
    gap: 10,
    padding: 14,
    borderRadius: radii.card,
    backgroundColor: palette.cardStrong,
  },
  choiceTitle: {
    color: palette.ink,
    fontFamily: typography.label.fontFamily,
    fontSize: 15,
  },
  choiceBody: {
    color: palette.mutedInk,
    fontFamily: typography.body.fontFamily,
    fontSize: 13,
    lineHeight: 20,
  },
  choiceActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  fieldList: {
    gap: 10,
  },
  fieldListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 14,
    borderRadius: radii.card,
    backgroundColor: palette.cardStrong,
  },
  fieldListCopy: {
    flex: 1,
    gap: 4,
  },
  fieldListTitle: {
    color: palette.ink,
    fontFamily: typography.label.fontFamily,
    fontSize: 14,
  },
  fieldListMeta: {
    color: palette.mutedInk,
    fontFamily: typography.body.fontFamily,
    fontSize: 12,
  },
  emptyFieldsCard: {
    gap: 6,
    padding: 14,
    borderRadius: radii.card,
    backgroundColor: palette.cardStrong,
  },
  emptyFieldsTitle: {
    color: palette.ink,
    fontFamily: typography.label.fontFamily,
    fontSize: 14,
  },
  emptyFieldsBody: {
    color: palette.mutedInk,
    fontFamily: typography.body.fontFamily,
    fontSize: 13,
    lineHeight: 20,
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
