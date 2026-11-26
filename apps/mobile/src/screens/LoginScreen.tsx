import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '../components/AppText';
import { ApiClientError, codeSchema, phoneSchema, signupSchema } from '@wehdathub/shared';
import { api } from '../api';
import { track } from '../analytics';
import { useAuth } from '../auth';
import { Button } from '../components/Button';
import { Logo } from '../components/Logo';
import { errorText } from '../errors';
import { t } from '../i18n';
import { radius, spacing, useTheme } from '../theme';

const LANG = 'ar' as const; // before sign-in the app speaks Arabic

type TrialOptions = Awaited<ReturnType<typeof api.trialOptions>>;

export function LoginScreen() {
  const { colors } = useTheme();
  const signIn = useAuth((s) => s.signIn);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [name, setName] = useState('');
  const [agency, setAgency] = useState('');
  const [tier, setTier] = useState<'solo' | 'team'>('solo');
  const [trialOpts, setTrialOpts] = useState<TrialOptions | null>(null);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);

  useEffect(() => {
    let alive = true;
    api.trialOptions().then((o) => {
      if (!alive || !o?.enabled) return;
      setTrialOpts(o);
      if (!o.tiers.solo.enabled && o.tiers.team.enabled) setTier('team');
    }).catch(() => undefined);
    return () => { alive = false; };
  }, []);

  const canSignup = Boolean(trialOpts?.enabled && (trialOpts.tiers.solo.enabled || trialOpts.tiers.team.enabled));

  const startSignup = async (channel: 'telegram' | 'whatsapp') => {
    const parsed = signupSchema.safeParse({ name, phone, agency: tier === 'team' ? agency : undefined, tier, channel, lang: LANG });
    if (!parsed.success) {
      const pOk = phoneSchema.safeParse(phone).success;
      return setMessage({ text: t(LANG, pOk ? 'yourName' : 'badPhone'), bad: true });
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await api.signup({
        name: parsed.data.name,
        phone: parsed.data.phone,
        agency: parsed.data.agency,
        tier: parsed.data.tier,
        channel,
        lang: LANG,
      });
      await Linking.openURL(res.verifyUrl).catch(() => undefined);
      setStep('code');
      setMessage({ text: t(LANG, channel === 'whatsapp' ? 'waVerifyHint' : 'tgVerifyHint'), bad: false });
    } catch (e) {
      setMessage({ text: errorText(e, LANG), bad: true });
    } finally {
      setBusy(false);
    }
  };

  const confirmWhatsAppFallback = () => {
    Alert.alert(t(LANG, 'waWarnTitle'), t(LANG, 'waWarnBody'), [
      { text: t(LANG, 'cancel'), style: 'cancel' },
      { text: t(LANG, 'waWarnContinue'), onPress: () => { void startSignup('whatsapp'); } },
    ]);
  };

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
      void track('sign_in_failed', { stage: 'request', status: e instanceof ApiClientError ? e.status : 0 });
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
      void track('sign_in_failed', { stage: 'verify', status: e instanceof ApiClientError ? e.status : 0 });
      setMessage({ text: errorText(e, LANG), bad: true });
      setBusy(false);
    }
  };

  const input = [styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }];
  return (
    <KeyboardAvoidingView style={[styles.flex, { backgroundColor: colors.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Logo />
        <Text style={[styles.title, { color: colors.text }]}>{t(LANG, mode === 'signup' ? 'signupTitle' : 'signIn')}</Text>
        {step === 'phone' && mode === 'signin' ? (
          <View style={styles.form}>
            <Text style={[styles.label, { color: colors.muted }]}>{t(LANG, 'phoneLabel')}</Text>
            <TextInput testID="phone-input" style={[input, { textAlign: 'left', writingDirection: 'ltr' }]} value={phone} onChangeText={(v) => { setPhone(v); if (message?.bad) setMessage(null); }} onBlur={() => { if (phone.trim() && !phoneSchema.safeParse(phone).success) setMessage({ text: t(LANG, 'badPhone'), bad: true }); }} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" placeholder="01012345678" placeholderTextColor={colors.muted} editable={!busy} />
            <Text style={[styles.hint, { color: colors.muted }]}>{t(LANG, 'phoneHint')}</Text>
            <Button testID="send-code" label={t(LANG, 'sendCode')} onPress={requestCode} loading={busy} />
            {canSignup ? <Button testID="mode-signup" label={t(LANG, 'startTrial')} onPress={() => { setMode('signup'); setMessage(null); }} variant="secondary" disabled={busy} /> : null}
          </View>
        ) : step === 'phone' && mode === 'signup' ? (
          <View style={styles.form}>
            {trialOpts?.tiers.solo.enabled && trialOpts?.tiers.team.enabled ? (
              <View style={styles.tierRow}>
                {(['solo', 'team'] as const).map((k) => {
                  const opt = trialOpts.tiers[k];
                  const active = tier === k;
                  return (
                    <Pressable key={k} testID={`tier-${k}`} onPress={() => setTier(k)} style={[styles.tierCard, { borderColor: active ? colors.primary : colors.border, backgroundColor: colors.card }]}>
                      <Text style={{ color: colors.text, fontWeight: '700', textAlign: 'right' }}>{t(LANG, k === 'solo' ? 'tierSolo' : 'tierTeam')}</Text>
                      <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'right' }}>{`${opt.days}ي · ${opt.units} وحدة · ${opt.credits} رصيد`}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
            <Text style={[styles.label, { color: colors.muted }]}>{t(LANG, 'yourName')}</Text>
            <TextInput testID="signup-name" style={input} value={name} onChangeText={setName} placeholder={t(LANG, 'yourName')} placeholderTextColor={colors.muted} editable={!busy} />
            {tier === 'team' ? (
              <>
                <Text style={[styles.label, { color: colors.muted }]}>{t(LANG, 'agencyName')}</Text>
                <TextInput testID="signup-agency" style={input} value={agency} onChangeText={setAgency} placeholder={t(LANG, 'agencyName')} placeholderTextColor={colors.muted} editable={!busy} />
              </>
            ) : null}
            <Text style={[styles.label, { color: colors.muted }]}>{t(LANG, 'phoneLabel')}</Text>
            <TextInput testID="phone-input" style={[input, { textAlign: 'left', writingDirection: 'ltr' }]} value={phone} onChangeText={(v) => { setPhone(v); if (message?.bad) setMessage(null); }} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" placeholder="01012345678" placeholderTextColor={colors.muted} editable={!busy} />
            <View testID="tg-pitch-card" style={[styles.pitchCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Text style={{ color: colors.text, fontWeight: '700', textAlign: 'right' }}>{t(LANG, 'tgPitchTitle')}</Text>
              <Text style={[styles.hint, { color: colors.muted }]}>• {t(LANG, 'tgPitch1')}</Text>
              <Text style={[styles.hint, { color: colors.muted }]}>• {t(LANG, 'tgPitch2')}</Text>
              <Text style={[styles.hint, { color: colors.muted }]}>• {t(LANG, 'tgPitch3')}</Text>
            </View>
            <Button testID="signup-telegram" label={t(LANG, 'continueTelegram')} onPress={() => startSignup('telegram')} loading={busy} />
            {trialOpts?.waAvailable ? <Button testID="signup-whatsapp" label={t(LANG, 'tryWhatsappInstead')} onPress={confirmWhatsAppFallback} variant="secondary" disabled={busy} /> : null}
            <Button testID="mode-signin" label={t(LANG, 'haveAccount')} onPress={() => { setMode('signin'); setMessage(null); }} variant="secondary" disabled={busy} />
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
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: spacing.md },
  form: { gap: spacing.md },
  label: { fontSize: 14, textAlign: 'right', writingDirection: 'rtl' },
  hint: { fontSize: 13, textAlign: 'right', writingDirection: 'rtl' },
  input: { minHeight: 52, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.lg, fontSize: 18, writingDirection: 'ltr', textAlign: 'left' },
  message: { fontSize: 15, textAlign: 'center' },
  tierRow: { flexDirection: 'row', gap: spacing.sm },
  tierCard: { flex: 1, borderWidth: 1.5, borderRadius: radius.md, padding: spacing.md, gap: 4 },
  pitchCard: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: 4 },
});
