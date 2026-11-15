import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { currentLang } from '../auth';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { EmptyView, ErrorView, Loading } from '../components/StateViews';
import { errorText } from '../errors';
import { t } from '../i18n';
import { radius, spacing, useTheme } from '../theme';

const day = (plus: number) => new Date(Date.now() + plus * 86400000).toISOString().slice(0, 10);

/** Managers: the "no reply, move the lead" rule, round robin for new leads, and who is away. */
export function LeadRulesScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['team-rules'], queryFn: () => api.teamRules() });
  const [on, setOn] = useState(false);
  const [wait, setWait] = useState('30');
  const [start, setStart] = useState('9');
  const [end, setEnd] = useState('21');
  const [rr, setRr] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!q.data) return;
    setOn(q.data.rules.enabled);
    setWait(String(q.data.rules.wait_minutes));
    setStart(String(q.data.rules.start));
    setEnd(String(q.data.rules.end));
    setRr(q.data.roundRobin);
  }, [q.data]);

  if (q.isPending) return <Loading label={t(lang, 'loading')} />;
  if (q.isError || !q.data) return <ErrorView message={errorText(q.error, lang)} retryLabel={t(lang, 'retry')} onRetry={async () => { await q.refetch(); }} />;
  const d = q.data;

  const save = async () => {
    setMsg(null);
    try {
      await api.saveTeamRules({ enabled: on, wait_minutes: wait, start, end, days: d.rules.days, max_jumps: d.rules.max_jumps });
      await api.saveTeamRouting({ roundRobin: rr, order: d.order });
      await qc.invalidateQueries({ queryKey: ['team-rules'] });
      setMsg(t(lang, 'rulesSaved'));
    } catch (e) {
      setMsg(errorText(e, lang));
    }
  };
  const away = async (id: string, until: string | null) => {
    try {
      await api.setTeamAway(id, until);
      await qc.invalidateQueries({ queryKey: ['team-rules'] });
      await qc.invalidateQueries({ queryKey: ['team'] });
    } catch (e) {
      setMsg(errorText(e, lang));
    }
  };

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={[styles.h, { color: colors.text }]}>{t(lang, 'rrTitle')}</Text>
      <View style={styles.row}><Text style={{ color: colors.text, flex: 1 }}>{t(lang, 'rrOn')}</Text><Switch testID="rr-switch" value={rr} onValueChange={setRr} /></View>
      <Text style={[styles.h, { color: colors.text }]}>{t(lang, 'ruleTitle')}</Text>
      <View style={styles.row}><Text style={{ color: colors.text, flex: 1 }}>{t(lang, 'ruleOn')}</Text><Switch testID="rule-switch" value={on} onValueChange={setOn} /></View>
      <Field label={t(lang, 'ruleWait')} value={wait} onChangeText={setWait} keyboardType="number-pad" testID="rule-wait" />
      <View style={styles.row}>
        <View style={styles.flex}><Field label={t(lang, 'ruleFrom')} value={start} onChangeText={setStart} keyboardType="number-pad" /></View>
        <View style={styles.flex}><Field label={t(lang, 'ruleTo')} value={end} onChangeText={setEnd} keyboardType="number-pad" /></View>
      </View>
      {msg ? <Text testID="rules-message" style={{ color: colors.accent }}>{msg}</Text> : null}
      <Button testID="rules-save" label={t(lang, 'save')} onPress={save} />
      <Text style={[styles.h, { color: colors.text }]}>{t(lang, 'awayTitle')}</Text>
      {d.brokers.length ? null : <EmptyView title={t(lang, 'noTeam')} hint="" />}
      {d.brokers.map((b) => (
        <View key={b.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={{ color: colors.text, fontWeight: '700', flex: 1 }}>{b.name} · {b.open}</Text>
          {b.away ? (
            <Pressable testID={`back-${b.id}`} accessibilityRole="button" onPress={() => away(b.id, null)}><Text style={{ color: colors.primary, fontWeight: '700' }}>{t(lang, 'awayBack')}</Text></Pressable>
          ) : (
            <Pressable testID={`away-${b.id}`} accessibilityRole="button" onPress={() => away(b.id, day(8))}><Text style={{ color: colors.primary, fontWeight: '700' }}>{t(lang, 'awayWeek')}</Text></Pressable>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  h: { fontSize: 18, fontWeight: '700', marginTop: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1 },
});
