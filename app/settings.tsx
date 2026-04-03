import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { getAppSettings, saveAppSettings } from '../src/services/settings';
import { AppSettings } from '../src/types';
import { palette } from '../src/theme';

export default function SettingsScreen() {
  const [form, setForm] = useState<AppSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    getAppSettings().then(setForm);
  }, []);

  if (!form) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Loading settings…</Text>
      </View>
    );
  }

  const updateForm = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await saveAppSettings(form);
      Alert.alert('Saved', 'Settings stored locally on this device.');
    } catch (error) {
      Alert.alert('Save failed', error instanceof Error ? error.message : 'Unable to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>OpenAI setup</Text>

          <Label text="API key" />
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="sk-..."
            placeholderTextColor={palette.mutedInk}
            secureTextEntry
            value={form.openAIApiKey}
            onChangeText={(value) => updateForm('openAIApiKey', value)}
          />

          <Label text="Base URL" />
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="https://api.openai.com/v1"
            placeholderTextColor={palette.mutedInk}
            value={form.openAIBaseUrl}
            onChangeText={(value) => updateForm('openAIBaseUrl', value)}
          />

          <Label text="Transcription model" />
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            value={form.transcriptionModel}
            onChangeText={(value) => updateForm('transcriptionModel', value)}
          />

          <Label text="Summary model" />
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            value={form.summaryModel}
            onChangeText={(value) => updateForm('summaryModel', value)}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Privacy defaults</Text>
          <View style={styles.row}>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>Delete remote audio after processing</Text>
              <Text style={styles.rowBody}>Only applies if your provider supports it.</Text>
            </View>
            <Switch
              value={form.deleteUploadedAudio}
              onValueChange={(value) => updateForm('deleteUploadedAudio', value)}
            />
          </View>
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Blunt reality</Text>
          <Text style={styles.noticeBody}>
            Audio leaves the device when you process a meeting. Use your own keys, get consent, and don’t pretend this is stealth-safe.
          </Text>
        </View>

        <Pressable style={styles.saveButton} onPress={handleSave} disabled={isSaving}>
          <Text style={styles.saveButtonText}>{isSaving ? 'Saving…' : 'Save settings'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Label({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.paper,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.paper,
  },
  loadingText: {
    color: palette.mutedInk,
  },
  container: {
    padding: 20,
    gap: 16,
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 10,
  },
  cardTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  label: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    backgroundColor: palette.paper,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: palette.ink,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    color: palette.ink,
    fontWeight: '700',
  },
  rowBody: {
    color: palette.mutedInk,
    lineHeight: 20,
  },
  notice: {
    backgroundColor: palette.accentSoft,
    borderRadius: 20,
    padding: 18,
    gap: 6,
  },
  noticeTitle: {
    color: palette.ink,
    fontWeight: '800',
    fontSize: 16,
  },
  noticeBody: {
    color: palette.mutedInk,
    lineHeight: 21,
  },
  saveButton: {
    backgroundColor: palette.ink,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    color: palette.paper,
    fontWeight: '800',
    fontSize: 16,
  },
});
