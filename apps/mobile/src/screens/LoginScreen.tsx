import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { codeSchema, phoneSchema } from '@wehdathub/shared';
import { api } from '../api';
import { useAuth } from '../auth';
import { Button } from '../components/Button';
import { errorText } from '../errors';
import { t } from '../i18n';
import { radius, spacing, useTheme } from '../theme';

const LANG = 'ar' as const; // before sign-in the app speaks Arabic

export function LoginScreen() {
  const { colors } = useTheme();
  const signIn = useAuth((s) => s.signIn);
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);

  const requestCode = async () => {
    const p = phoneSchema.safeParse(phone);
    if (!p.success) return setMessage({ text: t(LANG, 'badPhone'), bad: true });
    setBusy(true);
    setMessage(null);
    try {
      await api.requestCode(p.data);
      setStep('code');
      setMessage({ text: t(LANG, 'codeSent'), bad: false });
    } catch (e) {
      setMessage({ text: errorText(e, LANG), bad: true });
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    const p = phoneSchema.safeParse(phone);
    const c = codeSchema.safeParse(code);
    if (!p.success || !c.success) return setMessage({ text: t(LANG, 'badCode'), bad: true });
    setBusy(true);
    setMessage(null);
    try {
      await signIn(await api.verifyCode(p.data, c.data));
    } catch (e) {
      setMessage({ text: errorText(e, LANG), bad: true });
      setBusy(false);
    }
  };

  const input = [styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }];
  return (
    <KeyboardAvoidingView style={[styles.flex, { backgroundColor: colors.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={[styles.brand, { color: colors.text }]}>
          Wehdat<Text style={{ color: colors.primary }}>Hub</Text>
        </Text>
        <Text style={[styles.title, { color: colors.text }]}>{t(LANG, 'signIn')}</Text>
        {step === 'phone' ? (
          <View style={styles.form}>
            <Text style={[styles.label, { color: colors.muted }]}>{t(LANG, 'phoneLabel')}</Text>
            <TextInput testID="phone-input" style={input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" placeholder="01012345678" placeholderTextColor={colors.muted} editable={!busy} />
            <Text style={[styles.hint, { color: colors.muted }]}>{t(LANG, 'phoneHint')}</Text>
            <Button testID="send-code" label={t(LANG, 'sendCode')} onPress={requestCode} loading={busy} />
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={[styles.label, { color: colors.muted }]}>{t(LANG, 'codeLabel')}</Text>
            <TextInput testID="code-input" style={input} value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={6} editable={!busy} />
            <Button testID="verify" label={t(LANG, 'verify')} onPress={verify} loading={busy} />
            <Button label={t(LANG, 'resend')} onPress={requestCode} variant="secondary" disabled={busy} />
            <Button label={t(LANG, 'changeNumber')} onPress={() => { setStep('phone'); setCode(''); setMessage(null); }} variant="secondary" disabled={busy} />
          </View>
        )}
        {message ? <Text testID="login-message" accessibilityLiveRegion="polite" style={[styles.message, { color: message.bad ? colors.danger : colors.muted }]}>{message.text}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  brand: { fontSize: 34, fontWeight: '800', textAlign: 'center' },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: spacing.md },
  form: { gap: spacing.md },
  label: { fontSize: 14 },
  hint: { fontSize: 13 },
  input: { minHeight: 52, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.lg, fontSize: 18, writingDirection: 'ltr', textAlign: 'left' },
  message: { fontSize: 15, textAlign: 'center' },
});
