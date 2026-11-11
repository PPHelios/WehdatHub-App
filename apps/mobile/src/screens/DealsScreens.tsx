import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../api';
import { currentLang } from '../auth';
import { Button } from '../components/Button';
import { Chips } from '../components/Chips';
import { Field } from '../components/Field';
import { ErrorView, Loading } from '../components/StateViews';
import { errorText } from '../errors';
import { t } from '../i18n';
import { radius, spacing, useTheme } from '../theme';

const num = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : Number(v).toLocaleString('en-US'));
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));

function Card({ children, testID }: { children: React.ReactNode; testID?: string }) {
  const { colors } = useTheme();
  return <View testID={testID} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>{children}</View>;
}

function Gate<T>({ q, children }: { q: { isPending: boolean; isError: boolean; error: unknown; data?: T; refetch: () => Promise<unknown> }; children: (d: T) => React.ReactElement }) {
  const lang = currentLang();
  if (q.isPending) return <Loading label={t(lang, 'loading')} />;
  if (q.isError || !q.data) return <ErrorView message={errorText(q.error, lang)} retryLabel={t(lang, 'retry')} onRetry={async () => { await q.refetch(); }} />;
  return children(q.data);
}

/** Deals: the monthly totals and the list; whoever may edit a deal can change its status. */
export function DealsScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const ar = lang === 'ar';
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const q = useQuery({ queryKey: ['deals', status], queryFn: () => api.deals(status || undefined) });
  const setDeal = async (ref: string, to: string, version: unknown) => {
    try { await api.dealStatus(ref, to, Number(version)); await qc.invalidateQueries({ queryKey: ['deals'] }); } catch (e) { Alert.alert(errorText(e, lang)); }
  };
  return (
    <Gate q={q}>
      {(d) => (
        <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.pad}>
          <Chips testID="deal-status" value={status} onChange={(v) => setStatus(v === status ? '' : v)} options={d.statuses.map((s) => ({ value: s, label: s }))} />
          <Card>
            <Text style={[styles.h, { color: colors.text }]}>{ar ? 'إجمالي الشهور' : 'Monthly totals'}</Text>
            {d.totals.map((m) => <Text key={str(m.month)} style={{ color: colors.text }}>{str(m.month)} · {num(m.deals)} {ar ? 'صفقة' : 'deals'} · {num(m.commission ?? m.mine)}</Text>)}
          </Card>
          {d.items.map((x) => (
            <Card key={str(x.ref)} testID={`deal-${str(x.ref)}`}>
              <Text style={[styles.h, { color: colors.text }]}>#{str(x.ref)} · {str(x.status)}</Text>
              <Text style={{ color: colors.text }}>{str(x.client_name)} · {str(x.unit_code)} · {num(x.price)}</Text>
              {d.statuses.length ? <Chips value={str(x.status)} onChange={(s) => { void setDeal(str(x.ref), s, x.version); }} options={d.statuses.map((s) => ({ value: s, label: s }))} /> : null}
            </Card>
          ))}
        </ScrollView>
      )}
    </Gate>
  );
}

/** Commissions: resale (from deals) or developer commissions with the tracker status. */
export function CommissionsScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const ar = lang === 'ar';
  const [kind, setKind] = useState<'resale' | 'developers'>('resale');
  const q = useQuery({ queryKey: ['commissions', kind], queryFn: () => api.commissions(kind) });
  return (
    <Gate q={q}>
      {(d) => (
        <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.pad}>
          <Chips<'resale' | 'developers'> testID="comm-kind" value={kind} onChange={setKind} options={[{ value: 'resale', label: ar ? 'ريسيل' : 'Resale' }, { value: 'developers', label: ar ? 'مطورين' : 'Developers' }]} />
          <Text style={{ color: colors.muted }}>{d.total} · {d.period}</Text>
          {d.items.map((x, i) => (
            <Card key={str(x.id ?? i)} testID={`comm-${str(x.id ?? i)}`}>
              <Text style={[styles.h, { color: colors.text }]}>{str(x.unit_code)} {x.status ? `· ${str(x.status)}` : ''}</Text>
              <Text style={{ color: colors.text }}>{num(x.amount ?? x.commission_total ?? x.expected_amount ?? x.mine)}</Text>
            </Card>
          ))}
        </ScrollView>
      )}
    </Gate>
  );
}

/** Lead sources for a month, with the ad spend managers can type. */
export function SourcesScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const ar = lang === 'ar';
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['sources'], queryFn: () => api.sources() });
  const [spend, setSpend] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const save = async (month: string) => {
    setMsg(null);
    try { await api.saveSpend(month, spend); await qc.invalidateQueries({ queryKey: ['sources'] }); setMsg(ar ? 'اتحفظ.' : 'Saved.'); } catch (e) { setMsg(errorText(e, lang)); }
  };
  return (
    <Gate q={q}>
      {(d) => (
        <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
          <Text style={[styles.h, { color: colors.text }]}>{d.month}</Text>
          {d.rows.map((r) => (
            <Card key={r.source} testID={`source-${r.source}`}>
              <Text style={[styles.h, { color: colors.text }]}>{r.source}</Text>
              <Text style={{ color: colors.text }}>{r.leads} {ar ? 'عميل' : 'leads'} · {r.deals} {ar ? 'صفقة' : 'deals'} · {num(r.commission)}</Text>
              <Text style={{ color: colors.muted }}>{ar ? 'تكلفة العميل' : 'Per lead'} {num(r.perLead)} · {ar ? 'تكلفة الصفقة' : 'Per deal'} {num(r.perDeal)}</Text>
              <Field label={ar ? 'المصروف (جنيه)' : 'Spend (EGP)'} value={spend[r.source] ?? str(r.spend ?? '')} onChangeText={(v) => setSpend({ ...spend, [r.source]: v })} keyboardType="numeric" />
            </Card>
          ))}
          {msg ? <Text testID="sources-msg" style={{ color: colors.text }}>{msg}</Text> : null}
          <Button testID="sources-save" label={ar ? 'احفظ المصروف' : 'Save spend'} onPress={() => save(d.month)} />
        </ScrollView>
      )}
    </Gate>
  );
}

/** Portal enquiries (Bayut, Dubizzle, Nawy): add the number to turn one into a lead. */
export function PortalScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const ar = lang === 'ar';
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['portal'], queryFn: () => api.portalEnquiries() });
  const [phones, setPhones] = useState<Record<string, string>>({});
  const assign = async (id: string) => {
    try { await api.assignEnquiry(id, { phone: phones[id] ?? '' }); await qc.invalidateQueries({ queryKey: ['portal'] }); } catch (e) { Alert.alert(errorText(e, lang)); }
  };
  return (
    <Gate q={q}>
      {(d) => (
        <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
          {d.items.length === 0 ? <Text style={{ color: colors.muted }}>{ar ? 'مفيش استفسارات.' : 'No enquiries.'}</Text> : null}
          {d.items.map((x) => (
            <Card key={str(x.id)} testID={`enquiry-${str(x.id)}`}>
              <Text style={[styles.h, { color: colors.text }]}>{str(x.name) || '—'} · {str(x.portal)}</Text>
              <Text style={{ color: colors.muted }}>{str(x.unit_code)} {str(x.status)}</Text>
              <Field label={ar ? 'الموبايل' : 'Mobile'} value={phones[str(x.id)] ?? ''} onChangeText={(v) => setPhones({ ...phones, [str(x.id)]: v })} keyboardType="phone-pad" />
              <Button testID={`enquiry-assign-${str(x.id)}`} variant="secondary" label={ar ? 'حوّل لعميل' : 'Make a lead'} onPress={() => assign(str(x.id))} />
            </Card>
          ))}
        </ScrollView>
      )}
    </Gate>
  );
}

/** Links sent to clients and whether they were opened. */
export function LinksScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const q = useQuery({ queryKey: ['openedLinks'], queryFn: () => api.openedLinks() });
  return (
    <Gate q={q}>
      {(d) => (
        <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.pad}>
          <Text style={{ color: colors.muted }}>{d.total}</Text>
          {d.rows.map((x, i) => (
            <Card key={str(x.id ?? i)}>
              <Text style={{ color: colors.text }}>{str(x.lead_name ?? x.client_name)} · {str(x.unit_code)} · {str(x.status)}</Text>
              <Text style={{ color: colors.muted }}>{str(x.channel)} · {str(x.sent_at ?? x.created_at).slice(0, 16)}</Text>
            </Card>
          ))}
        </ScrollView>
      )}
    </Gate>
  );
}

const styles = StyleSheet.create({
  pad: { padding: spacing.lg, gap: spacing.md },
  card: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
  h: { fontSize: 16, fontWeight: '700' },
});
