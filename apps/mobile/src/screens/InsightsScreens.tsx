import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { api } from '../api';
import { currentLang } from '../auth';
import { Button } from '../components/Button';
import { Chips } from '../components/Chips';
import { Field } from '../components/Field';
import { ErrorView, Loading } from '../components/StateViews';
import { errorText } from '../errors';
import { t } from '../i18n';
import { radius, spacing, useTheme } from '../theme';

const num = (n: number) => Number(n).toLocaleString('en-US');
const DAYS = ['30', '90', '365'] as const;

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.h, { color: colors.text }]}>{title}</Text>
      {children}
    </View>
  );
}

/** The agency dashboard for managers: pipeline, the period's totals and the leaderboard. */
export function DashboardScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const [days, setDays] = useState<(typeof DAYS)[number]>('30');
  const q = useQuery({ queryKey: ['dashboard', days], queryFn: () => api.dashboard(Number(days)) });
  if (q.isPending) return <Loading label={t(lang, 'loading')} />;
  if (q.isError) return <ErrorView message={errorText(q.error, lang)} retryLabel={t(lang, 'retry')} onRetry={async () => { await q.refetch(); }} />;
  const d = q.data;
  const ar = lang === 'ar';
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.pad}>
      <Chips<(typeof DAYS)[number]> testID="dash-days" value={days} onChange={setDays} options={DAYS.map((x) => ({ value: x, label: ar ? `${x} يوم` : `${x} days` }))} />
      <Card title={ar ? 'دلوقتي' : 'Now'}>
        <Text style={{ color: colors.text }}>{ar ? 'عملاء من غير بروكر' : 'Unassigned leads'}: {d.unassigned}</Text>
        <Text style={{ color: colors.text }}>{ar ? 'ماتكلمش' : 'Not contacted'}: {d.uncontacted}</Text>
        <Text style={{ color: d.overdue ? colors.danger : colors.text }}>{ar ? 'متابعات متأخرة' : 'Overdue follow-ups'}: {d.overdue}</Text>
        <Text style={{ color: colors.text }}>{ar ? 'وحدات متاحة' : 'Active units'}: {d.units.active} ({ar ? 'قديمة' : 'stale'} {d.units.stale})</Text>
      </Card>
      <Card title={ar ? 'الفترة' : 'This period'}>
        <Text style={{ color: colors.text }}>{ar ? 'عملاء جدد' : 'Leads'}: {d.leads}</Text>
        <Text style={{ color: colors.text }}>{ar ? 'صفقات' : 'Deals'}: {d.deals.n} · {num(d.deals.value)} {t(lang, 'egp')}</Text>
        <Text style={{ color: colors.text }}>{ar ? 'العمولة' : 'Commission'}: {num(d.deals.commission)}</Text>
        {d.sources.length ? <Text style={{ color: colors.muted }}>{d.sources.map((s) => `${s.source} ${s.n}`).join(' · ')}</Text> : null}
      </Card>
      <Card title={ar ? 'المراحل' : 'Pipeline'}>
        {Object.entries(d.pipeline).map(([k, v]) => <Text key={k} style={{ color: colors.text }}>{k}: {v}</Text>)}
      </Card>
      <Card title={ar ? 'ترتيب البروكرز' : 'Leaderboard'}>
        {d.board.map((b) => (
          <Text key={b.id} testID={`board-${b.id}`} style={{ color: colors.text }}>{b.name}: {b.deals} {ar ? 'صفقة' : 'deals'} · {b.leads} {ar ? 'عميل' : 'leads'} · {b.contacted} {ar ? 'تواصل' : 'contacted'}</Text>
        ))}
      </Card>
    </ScrollView>
  );
}

/** Price per m² by compound or area, from the agency's own active units. */
export function PricesScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const q = useQuery({ queryKey: ['prices'], queryFn: () => api.pricePerM2() });
  if (q.isPending) return <Loading label={t(lang, 'loading')} />;
  if (q.isError) return <ErrorView message={errorText(q.error, lang)} retryLabel={t(lang, 'retry')} onRetry={async () => { await q.refetch(); }} />;
  const ar = lang === 'ar';
  const kinds: ('sale' | 'rent')[] = ['sale', 'rent'];
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.pad}>
      <Text style={{ color: colors.muted }}>{ar ? `من وحداتك المتاحة بس، لكل مكان فيه ${q.data.minUnits} وحدات أو أكتر. الوسيط = نص الوحدات أغلى ونصها أرخص.` : `From your own active units, for places with ${q.data.minUnits}+ units. Median: half cost more, half less.`}</Text>
      {kinds.map((k) => {
        const rows = q.data.items.filter((r) => r.listing_type === k);
        return (
          <Card key={k} title={k === 'sale' ? (ar ? '🏷️ بيع (ج.م للمتر)' : '🏷️ Sale (EGP per m²)') : (ar ? '🔑 إيجار (ج.م للمتر/شهر)' : '🔑 Rent (EGP per m² a month)')}>
            {rows.length ? rows.map((r) => (
              <Text key={r.place} testID={`price-${k}-${r.place}`} style={{ color: colors.text }}>{r.place} · {r.units} · <Text style={styles.b}>{num(r.median)}</Text> ({num(r.low)}–{num(r.high)})</Text>
            )) : <Text style={{ color: colors.muted }}>{ar ? 'مفيش لسه.' : 'None yet.'}</Text>}
          </Card>
        );
      })}
    </ScrollView>
  );
}

/** Win and loss for managers: won, lost, why, and per broker and source. */
export function WinLossScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const [days, setDays] = useState<(typeof DAYS)[number]>('30');
  const q = useQuery({ queryKey: ['winloss', days], queryFn: () => api.winLoss(Number(days)) });
  if (q.isPending) return <Loading label={t(lang, 'loading')} />;
  if (q.isError) return <ErrorView message={errorText(q.error, lang)} retryLabel={t(lang, 'retry')} onRetry={async () => { await q.refetch(); }} />;
  const d = q.data;
  const ar = lang === 'ar';
  const rate = (r: number | null) => (r === null ? '—' : `${r}%`);
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.pad}>
      <Chips<(typeof DAYS)[number]> testID="wl-days" value={days} onChange={setDays} options={DAYS.map((x) => ({ value: x, label: ar ? `${x} يوم` : `${x} days` }))} />
      <Card title={ar ? 'الملخص' : 'Summary'}>
        <Text testID="wl-summary" style={{ color: colors.text }}>{ar ? 'اتقفلت' : 'Won'} {d.won} · {ar ? 'ضاعت' : 'Lost'} {d.lost} · {rate(d.rate)}</Text>
      </Card>
      <Card title={ar ? 'ليه العملاء ضاعوا' : 'Why leads were lost'}>
        {d.reasons.length ? d.reasons.map((r) => <Text key={r.key} style={{ color: colors.text }}>{r.key.replace(/_/g, ' ')}: {r.n} ({r.pct}%)</Text>) : <Text style={{ color: colors.muted }}>{ar ? 'مفيش.' : 'None.'}</Text>}
      </Card>
      <Card title={ar ? 'لكل بروكر' : 'Per broker'}>
        {d.brokers.map((g) => <Text key={g.key} style={{ color: colors.text }}>{g.name || '—'}: {g.won}/{g.lost} · {rate(g.rate)}</Text>)}
      </Card>
      <Card title={ar ? 'لكل مصدر' : 'Per source'}>
        {d.sources.map((g) => <Text key={g.key} style={{ color: colors.text }}>{g.key}: {g.won}/{g.lost} · {rate(g.rate)}</Text>)}
      </Card>
    </ScrollView>
  );
}

/** A broker's bug report to the team. */
export function ReportScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const nav = useNavigation();
  const [text, setText] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const ar = lang === 'ar';
  const send = async () => {
    setMsg(null);
    if (text.trim().length < 3) return;
    try {
      const r = await api.report(text.trim());
      setMsg(`${ar ? 'وصلنا البلاغ' : 'Report sent'} #R${r.id}`);
      setText('');
      setTimeout(() => nav.goBack(), 1200);
    } catch (e) {
      setMsg(errorText(e, lang));
    }
  };
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
      <Field label={ar ? 'اكتب اللي حصل واللي كنت متوقعه' : 'What happened and what you expected'} value={text} onChangeText={setText} multiline testID="report-text" />
      {msg ? <Text testID="report-msg" style={{ color: colors.text }}>{msg}</Text> : null}
      <Button testID="report-send" label={ar ? 'ابعت البلاغ' : 'Send report'} onPress={send} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: spacing.lg, gap: spacing.md },
  card: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
  h: { fontSize: 16, fontWeight: '700' },
  b: { fontWeight: '700' },
});
