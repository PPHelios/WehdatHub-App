import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { ApiClientError } from '@wehdathub/shared';
import type { ApiLead, ViewingSet } from '@wehdathub/shared';
import { api } from '../api';
import { currentLang } from '../auth';
import { errorText } from '../errors';
import { tick } from '../haptics';
import { t } from '../i18n';
import { leadLang } from '../prefs';
import { radius, spacing, useTheme } from '../theme';
import { Button } from './Button';
import { Chips } from './Chips';
import { Field } from './Field';

const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

/** Date and time as the server wants them: a local day and hour, as an ISO instant. */
export function viewingInstant(dayOffset: number, hour: number, now = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

/**
 * Sets a viewing on a lead. Nothing goes to the client: the broker sees the message under the (i) button and can send it
 * on WhatsApp or leave it.
 */
export function ViewingForm({ lead, unitCode = '' }: { lead: ApiLead; unitCode?: string }) {
  const { colors } = useTheme();
  const lang = currentLang();
  const qc = useQueryClient();
  const [day, setDay] = useState(1);
  const [hour, setHour] = useState(11);
  const [place, setPlace] = useState('');
  const [unit, setUnit] = useState(unitCode);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<ViewingSet | null>(null);
  const [showMessage, setShowMessage] = useState(false);

  const days = Array.from({ length: 8 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return { value: String(i), label: i === 0 ? t(lang, 'today') : d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) };
  });
  const save = async () => {
    setError(null);
    try {
      const cur = (qc.getQueryData(['lead', lead.ref]) as { lead: ApiLead } | undefined)?.lead ?? lead;
      const r = await api.setViewing(lead.ref, { version: cur.version, at: viewingInstant(day, hour), unitCode: unit.trim() || undefined, place: place.trim() || undefined, lang: leadLang(cur) });
      tick();
      setDone(r);
      await Promise.all([qc.invalidateQueries({ queryKey: ['lead', lead.ref] }), qc.invalidateQueries({ queryKey: ['leads'] }), qc.invalidateQueries({ queryKey: ['today'] }), qc.invalidateQueries({ queryKey: ['viewings'] })]);
    } catch (e) {
      setError(e instanceof ApiClientError && e.code === 'past' ? t(lang, 'pastTime') : e instanceof ApiClientError && e.status === 409 ? t(lang, 'leadChanged') : errorText(e, lang));
    }
  };

  return (
    <View style={styles.box}>
      <Text style={{ color: colors.muted }}>{t(lang, 'viewingDay')}</Text>
      <Chips options={days} value={String(day)} onChange={(v) => setDay(Number(v))} />
      <Text style={{ color: colors.muted }}>{t(lang, 'viewingTime')}</Text>
      <Chips options={HOURS.map((h) => ({ value: String(h), label: `${h}:00` }))} value={String(hour)} onChange={(v) => setHour(Number(v))} />
      <Field testID="viewing-unit" label={t(lang, 'viewingUnit')} value={unit} onChangeText={setUnit} autoCapitalize="characters" autoCorrect={false} />
      <Field testID="viewing-place" label={t(lang, 'viewingPlace')} value={place} onChangeText={setPlace} />
      {error ? <Text testID="viewing-error" style={{ color: colors.danger }}>{error}</Text> : null}
      <Button testID="viewing-save" label={t(lang, 'saveViewing')} onPress={save} />
      {done ? (
        <View testID="viewing-done" style={[styles.result, { borderColor: colors.border }]}>
          <View style={styles.row}>
            <Text style={[styles.flex, { color: colors.accent }]}>{t(lang, 'viewingSaved')}</Text>
            <Pressable testID="viewing-info" accessibilityRole="button" accessibilityLabel={t(lang, 'clientMessage')} hitSlop={12} onPress={() => setShowMessage((s) => !s)}>
              <Text style={{ color: colors.primary, fontSize: 18, fontWeight: '800' }}>ⓘ</Text>
            </Pressable>
          </View>
          {showMessage ? <Text testID="viewing-message" style={{ color: colors.text }}>{done.message}</Text> : null}
          {done.wa ? <Button testID="viewing-send" variant="secondary" label={t(lang, 'sendToClient')} onPress={() => { Linking.openURL(done.wa ?? '').catch(() => undefined); }} /> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.sm },
  result: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
});
