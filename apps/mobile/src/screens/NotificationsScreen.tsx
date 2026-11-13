import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NotificationSettings, NotifyChannel, NotifyFrequency } from '@wehdathub/shared';
import { api } from '../api';
import { useAuth } from '../auth';
import { Button } from '../components/Button';
import { Chips } from '../components/Chips';
import { ErrorView, Loading } from '../components/StateViews';
import { AppSettings } from '../components/AppSettings';
import { t } from '../i18n';
import { radius, spacing, useTheme } from '../theme';

const REMINDERS = [30, 60, 120] as const;
/** WhatsApp is not an alert channel any more: an old saved choice shows as the default (both when Telegram is linked, else web). */
function noWhatsapp(s: NotificationSettings): NotificationSettings {
  const fallback: NotifyChannel = s.telegramLinked ? 'both' : 'web';
  const kinds = Object.fromEntries(Object.entries(s.kinds).map(([k, v]) => [k, v.channel === 'whatsapp' ? { ...v, channel: fallback } : v]));
  return { ...s, kinds };
}
const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;

/** The same choices as the website's Settings: per alert type on/off, channel and frequency; reminders; quiet hours. */
export function NotificationsScreen() {
  const { colors } = useTheme();
  const lang = useAuth((s) => s.broker?.lang) ?? 'ar';
  const queries = useQueryClient();
  const q = useQuery({ queryKey: ['notification-settings'], queryFn: () => api.notificationSettings() });
  const [draft, setDraft] = useState<NotificationSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null);
  useEffect(() => {
    if (q.data) setDraft(noWhatsapp(q.data));
  }, [q.data]);

  if (q.isLoading) return <Loading />;
  if (q.isError || !draft) return <ErrorView message={t(lang, 'serverError')} retryLabel={t(lang, 'retry')} onRetry={() => q.refetch()} />;

  const channels: { value: NotifyChannel; label: string }[] = [
    ...(draft.telegramLinked ? [{ value: 'both' as const, label: t(lang, 'chBoth') }, { value: 'telegram' as const, label: t(lang, 'chTelegram') }] : []),
    { value: 'web', label: t(lang, 'chWeb') },
  ];
  const freqs: { value: NotifyFrequency; label: string }[] = [
    { value: 'immediate', label: t(lang, 'fqImmediate') },
    { value: 'hourly', label: t(lang, 'fqHourly') },
    { value: 'daily', label: t(lang, 'fqDaily') },
  ];
  const setKind = (k: string, patch: Partial<NotificationSettings['kinds'][string]>) => setDraft({ ...draft, kinds: { ...draft.kinds, [k]: { ...draft.kinds[k], ...patch } } });
  const setQuiet = (patch: Partial<NotificationSettings['quiet']>) => setDraft({ ...draft, quiet: { ...draft.quiet, ...patch } });
  const step = (key: 'start' | 'end', d: number) => setQuiet({ [key]: (draft.quiet[key] + d + 24) % 24 });
  const toggleReminder = (m: number) => {
    const has = draft.reminderMinutes.includes(m);
    setDraft({ ...draft, reminderMinutes: has ? draft.reminderMinutes.filter((x) => x !== m) : [...draft.reminderMinutes, m].sort((a, b) => a - b) });
  };

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const kinds: Record<string, { on?: boolean; channel?: NotifyChannel; frequency?: NotifyFrequency }> = {};
      for (const [k, v] of Object.entries(draft.kinds)) {
        if (v.locked || v.urgent) continue;
        kinds[k] = { on: v.on, channel: v.channel, frequency: v.frequency };
      }
      const saved = await api.saveNotificationSettings({ kinds, reminderMinutes: draft.reminderMinutes, quiet: draft.quiet });
      queries.setQueryData(['notification-settings'], saved);
      setDraft(noWhatsapp(saved));
      setMsg({ text: t(lang, 'notifSaved'), bad: false });
    } catch {
      setMsg({ text: t(lang, 'notifSaveFail'), bad: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={[styles.body, { backgroundColor: colors.bg }]}>
      <Text style={[styles.h, { color: colors.text }]}>🔔 {t(lang, 'notifWhere')}</Text>
      <Text style={{ color: colors.muted }}>{t(lang, 'notifHint')}</Text>
      {Object.entries(draft.kinds).map(([k, v]) => {
        const fixed = Boolean(v.locked);
        const off = !v.on;
        return (
          <View key={k} testID={`kind-${k}`} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <View style={styles.row}>
              <Text style={[styles.flex, styles.kind, { color: colors.text }]}>{v.label[lang]}</Text>
              {v.urgent ? null : <Switch testID={`on-${k}`} value={v.on} disabled={fixed} onValueChange={(on) => setKind(k, { on })} />}
            </View>
            {v.urgent ? <Text style={{ color: colors.muted }}>{t(lang, 'notifAlways')}</Text> : null}
            {fixed ? <Text style={{ color: colors.muted }}>🔒 {t(lang, 'notifLockedBy')}</Text> : null}
            {/* No point choosing a channel for an alert that is switched off. */}
            <Text style={{ color: colors.muted }}>{t(lang, 'notifChannel')}</Text>
            <Chips testID={`channel-${k}`} options={channels} value={v.channel} disabled={off || fixed} onChange={(channel) => setKind(k, { channel })} />
            {v.urgent ? null : (
              <>
                <Text style={{ color: colors.muted }}>{t(lang, 'notifFreq')}</Text>
                <Chips testID={`freq-${k}`} options={freqs} value={v.frequency} disabled={off || fixed} onChange={(frequency) => setKind(k, { frequency })} />
              </>
            )}
          </View>
        );
      })}
      <Text style={[styles.h, { color: colors.text }]}>⏰ {t(lang, 'remindersTitle')}</Text>
      <Text style={{ color: colors.muted }}>{t(lang, 'remindersHint')}</Text>
      <View style={styles.wrap}>
        {REMINDERS.map((m) => {
          const on = draft.reminderMinutes.includes(m);
          return (
            <Pressable key={m} testID={`reminder-${m}`} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => toggleReminder(m)} style={[styles.chip, { borderColor: on ? colors.primary : colors.border }, on && { backgroundColor: colors.primary }]}>
              <Text style={{ color: on ? colors.onPrimary : colors.text, fontWeight: '600' }}>{t(lang, m === 30 ? 'min30' : m === 60 ? 'min60' : 'min120')}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.h, { color: colors.text }]}>🌙 {t(lang, 'quietTitle')}</Text>
      <View style={styles.row}>
        <Text style={[styles.flex, { color: colors.text }]}>{t(lang, 'quietHold')}</Text>
        <Switch testID="quiet-switch" value={draft.quiet.enabled} onValueChange={(enabled) => setQuiet({ enabled })} />
      </View>
      {(['start', 'end'] as const).map((key) => (
        <View key={key} style={styles.row}>
          <Text style={[styles.flex, { color: draft.quiet.enabled ? colors.text : colors.muted }]}>{t(lang, key === 'start' ? 'quietFrom' : 'quietUntil')}</Text>
          <Pressable testID={`${key}-minus`} accessibilityLabel="-" disabled={!draft.quiet.enabled} onPress={() => step(key, -1)} style={[styles.step, { borderColor: colors.border, opacity: draft.quiet.enabled ? 1 : 0.4 }]}><Text style={{ color: colors.text, fontSize: 20 }}>−</Text></Pressable>
          <Text testID={`${key}-value`} style={{ color: colors.text, fontSize: 18, minWidth: 64, textAlign: 'center' }}>{hh(draft.quiet[key])}</Text>
          <Pressable testID={`${key}-plus`} accessibilityLabel="+" disabled={!draft.quiet.enabled} onPress={() => step(key, 1)} style={[styles.step, { borderColor: colors.border, opacity: draft.quiet.enabled ? 1 : 0.4 }]}><Text style={{ color: colors.text, fontSize: 20 }}>+</Text></Pressable>
        </View>
      ))}
      {msg ? <Text accessibilityLiveRegion="polite" style={{ color: msg.bad ? colors.danger : colors.muted }}>{msg.text}</Text> : null}
      <Button testID="save-notifications" label={t(lang, 'save')} onPress={save} loading={busy} />
      <AppSettings />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.xl, gap: spacing.md },
  h: { fontSize: 18, fontWeight: '700', marginTop: spacing.md },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  kind: { fontSize: 16, fontWeight: '700' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  step: { width: 44, height: 44, borderWidth: 1, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
