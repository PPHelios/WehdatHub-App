import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiClientError } from '@wehdathub/shared';
import type { AskAnswer } from '@wehdathub/shared';
import { api } from '../api';
import { currentLang } from '../auth';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { errorText } from '../errors';
import { t } from '../i18n';
import { radius, spacing, useTheme } from '../theme';
import { ensureMic, startRecording, stopRecording } from '../voice';

/** Ask: a question (typed or spoken) answered from the agency's projects, units and the broker's own clients. */
export function AskScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const [question, setQuestion] = useState('');
  const [out, setOut] = useState<AskAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);

  const ask = async (text = question) => {
    setError(null);
    if (!text.trim()) return setError(t(lang, 'askEmpty'));
    try {
      setOut(await api.ask(text.trim()));
    } catch (e) {
      setOut(null);
      if (e instanceof ApiClientError && e.code === 'ai_blocked' && typeof e.extra.message === 'string') setError(e.extra.message);
      else setError(e instanceof ApiClientError && e.status === 503 ? t(lang, 'aiBlocked') : errorText(e, lang));
    }
  };
  const toggleMic = async () => {
    setError(null);
    try {
      if (!recording) {
        if (!(await ensureMic())) return setError(t(lang, 'micDenied'));
        await startRecording();
        return setRecording(true);
      }
      setRecording(false);
      const heard = (await api.voiceToText(await stopRecording())).q;
      setQuestion(heard);
      await ask(heard);
    } catch (e) {
      setRecording(false);
      setError(errorText(e, lang));
    }
  };

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Field testID="ask-input" label={t(lang, 'askHint')} value={question} onChangeText={setQuestion} multiline />
      <View style={styles.row}>
        <View style={styles.flex}><Button testID="ask-go" label={t(lang, 'askBtn')} onPress={() => ask()} /></View>
        <View style={styles.flex}><Button testID="ask-mic" variant="secondary" label={recording ? t(lang, 'micStop') : t(lang, 'micAsk')} onPress={toggleMic} /></View>
      </View>
      {error ? <Text testID="ask-error" style={{ color: colors.danger }}>{error}</Text> : null}
      {out ? (
        <View testID="ask-answer" style={[styles.box, { borderColor: out.found ? colors.accent : colors.border, backgroundColor: colors.card }]}>
          <Text style={{ color: colors.text, fontSize: 16 }}>{out.answer}</Text>
          {out.dataDates ? <Text style={{ color: colors.muted }}>{out.dataDates}</Text> : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  box: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
});
