import React, { useState } from 'react';
import { ScrollView, Share, StyleSheet, View } from 'react-native';
import { AppText as Text } from '../components/AppText';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ApiClientError } from '@wehdathub/shared';
import type { AskAnswer, VoiceFile } from '@wehdathub/shared';
import { timed } from '../usage';
import { api } from '../api';
import { currentLang } from '../auth';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { errorText } from '../errors';
import { t } from '../i18n';
import { pt } from '../projectText';
import { radius, spacing, useTheme } from '../theme';
import { VoiceBar } from '../components/VoiceBar';
import { AskResults } from '../components/AskResults';
import type { RootStackParams } from '../navigation';
import { toastError } from '../components/Toast';

/** Ask: a question (typed or spoken) answered from the agency's projects, units and the broker's own clients. */
export function AskScreen() {
  const { colors, elev } = useTheme();
  const lang = currentLang();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const [question, setQuestion] = useState('');
  const [out, setOut] = useState<AskAnswer | null>(null);
  const [asked, setAsked] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ask = async (text = question, voice = false) => {
    setError(null);
    if (!text.trim()) return setError(t(lang, 'askEmpty'));
    setBusy(true);
    try {
      setOut(await timed('ask', () => api.ask(text.trim()), { kind: voice ? 'voice' : 'text' }));
      setAsked(text.trim());
    } catch (e) {
      setOut(null);
      if (e instanceof ApiClientError && e.code === 'ai_blocked' && typeof e.extra.message === 'string') setError(e.extra.message);
      else setError(toastError(e instanceof ApiClientError && e.status === 503 ? t(lang, 'aiBlocked') : errorText(e, lang)));
    } finally {
      setBusy(false);
    }
  };
  const onVoice = async (file: VoiceFile) => {
    setError(null);
    try {
      const heard = (await api.voiceToText(file)).q;
      setQuestion(heard);
      await ask(heard, true);
    } catch (e) {
      setError(toastError(errorText(e, lang)));
    }
  };

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Field testID="ask-input" label={t(lang, 'askHint')} value={question} onChangeText={setQuestion} multiline />
      <Button testID="ask-go" label={t(lang, 'askBtn')} loading={busy} onPress={() => ask()} />
      <VoiceBar id="ask" label={t(lang, 'micAsk')} onFile={onVoice} onError={setError} disabled={busy} />
      {error ? <Text testID="ask-error" style={{ color: colors.danger }}>{error}</Text> : null}
      {out ? (
        <View testID="ask-answer" style={[styles.box, elev('md'), { borderColor: out.found ? colors.accent : colors.border, backgroundColor: colors.card }]}>
          <Text selectable style={{ color: colors.text, fontSize: 16 }}>{out.answer}</Text>
          {out.source === 'local' ? <Text testID="ask-local" style={{ color: colors.muted }}>{pt(lang).localAnswer}</Text> : null}
          {out.dataDates ? <Text style={{ color: colors.muted }}>{out.dataDates}</Text> : null}
          {/* The share sheet has Copy, WhatsApp and the rest; pressing and holding the text also selects a part of it. */}
          <Button testID="ask-copy" variant="secondary" label={t(lang, 'copyAnswer')} onPress={() => { Share.share({ message: out.answer }).catch(() => undefined); }} />
        </View>
      ) : null}
      {out && asked ? <AskResults key={asked} q={asked} onOpenProject={(id, name) => nav.navigate('Project', { id, name })} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  box: { borderWidth: 1, borderRadius: radius.card, padding: spacing.md, gap: spacing.sm },
});
