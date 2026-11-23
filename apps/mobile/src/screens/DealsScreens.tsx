import React, { memo, useCallback, useMemo, useState } from 'react';
import { ltr } from '@wehdathub/shared';
import type { Lang } from '@wehdathub/shared';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { AppText as Text } from '../components/AppText';
import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { api } from '../api';
import { currentLang } from '../auth';
import { Button } from '../components/Button';
import { Chips } from '../components/Chips';
import { DealForm } from '../components/DealForm';
import { Field } from '../components/Field';
import { Section } from '../components/Section';
import { StatRow } from '../components/StatRow';
import { useRights } from '../rights';
import { ErrorView, Loading } from '../components/StateViews';
import { rowDate } from '../dates';
import { errorText } from '../errors';
import { t } from '../i18n';
import type { RootStackParams } from '../navigation';
import { radius, spacing, useTheme } from '../theme';
import { toast, toastError } from '../components/Toast';

const num = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : Number(v).toLocaleString('en-US'));
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));

function Card({ children, testID }: { children: React.ReactNode; testID?: string }) {
  const { colors, elev } = useTheme();
  return <View testID={testID} style={[styles.card, elev('md'), { backgroundColor: colors.card, borderColor: colors.border }]}>{children}</View>;
}

function Gate<T>({ q, children }: { q: { isPending: boolean; isError: boolean; error: unknown; data?: T; refetch: () => Promise<unknown> }; children: (d: T) => React.ReactElement }) {
  const lang = currentLang();
  if (q.isPending) return <Loading label={t(lang, 'loading')} />;
  if (q.isError || !q.data) return <ErrorView message={errorText(q.error, lang)} retryLabel={t(lang, 'retry')} onRetry={async () => { await q.refetch(); }} />;
  return children(q.data);
}

/** A deal's status in the screen's language (the server sends the English key). */
export const dealStatusLabel = (s: string, ar: boolean) => (ar ? ({ pending: 'مستني', signed: 'اتوقّع', paid: 'اتدفع', cancelled: 'اتلغى' } as Record<string, string>)[s] : undefined) ?? s;

/** Deals: the monthly totals and the list; whoever may edit a deal can change its status. */
export function DealsScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const ar = lang === 'ar';
  const qc = useQueryClient();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const rights = useRights();
  const [fix, setFix] = useState<Record<string, string>>({});
  const [status, setStatus] = useState('');
  const q = useQuery({ queryKey: ['deals', status], queryFn: () => api.deals(status || undefined) });
  const setDeal = async (ref: string, to: string, version: unknown) => {
    try { await api.dealStatus(ref, to, Number(version)); await qc.invalidateQueries({ queryKey: ['deals'] }); } catch (e) { toast(errorText(e, lang), true); }
  };
  return (
    <Gate q={q}>
      {(d) => (
        <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.pad}>
          <Section testID="sec-new-deal" title={t(lang, 'newDeal')}><DealForm /></Section>
          <Chips testID="deal-status" value={status} onChange={(v) => setStatus(v === status ? '' : v)} options={d.statuses.map((s) => ({ value: s, label: dealStatusLabel(s, ar) }))} />
          <Card>
            <Text style={[styles.h, { color: colors.text }]}>{ar ? 'إجمالي الشهور' : 'Monthly totals'}</Text>
            {d.totals.map((m) => <StatRow key={str(m.month)} label={str(m.month)} value={`${num(m.deals)} ${ar ? 'صفقة' : 'deals'} · ${num(m.commission ?? m.mine)}`} pct={(Number(m.deals) / Math.max(1, ...d.totals.map((x) => Number(x.deals)))) * 100} />)}
          </Card>
          {d.items.map((x) => (
            <Card key={str(x.ref)} testID={`deal-${str(x.ref)}`}>
              <Text style={[styles.h, { color: colors.text }]}>#{str(x.ref)} · {dealStatusLabel(str(x.status), ar)}</Text>
              <Text style={{ color: colors.text }}>{[str(x.client_name), str(x.unit_code), str(x.price) ? num(x.price) : ''].filter(Boolean).join(' · ')}</Text>
              {str(x.deal_type) === 'rent' && x.unit_code ? <Button testID={`add-lease-${str(x.ref)}`} variant="secondary" label={`🔑 ${t(lang, 'addLease')}`} onPress={() => nav.navigate('Unit', { code: str(x.unit_code), lease: { tenantName: x.lead_ref ? `L-${String(x.lead_ref).padStart(4, '0')}` : str(x.client_name), startDate: str(x.closed_at).slice(0, 10), rent: x.price === null || x.price === undefined ? '' : String(Math.round(Number(x.price))) } })} /> : null}
              {rights.manager || rights.agencyOwner ? (
                <Section testID={`sec-fix-${str(x.ref)}`} title={t(lang, 'correctDeal')}>
                  <Field label={t(lang, 'dealCommission')} value={fix[str(x.ref)] ?? ''} onChangeText={(v) => setFix({ ...fix, [str(x.ref)]: v })} />
                  <Button testID={`fix-${str(x.ref)}`} label={t(lang, 'save')} disabled={!(fix[str(x.ref)] ?? '').trim()} onPress={async () => { try { await api.correctDeal(`D-${String(x.ref).padStart(4, '0')}`, { commission: fix[str(x.ref)], version: Number(x.version) }); await qc.invalidateQueries({ queryKey: ['deals'] }); } catch (e) { toast(errorText(e, lang), true); } }} />
                </Section>
              ) : null}
              {d.statuses.length ? <Chips value={str(x.status)} onChange={(s) => { void setDeal(str(x.ref), s, x.version); }} options={(Array.isArray(x.allowed) ? (x.allowed as string[]) : d.statuses).map((s) => ({ value: s, label: dealStatusLabel(s, ar) }))} /> : null}
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
  const signedOnly = Boolean(useRoute<RouteProp<RootStackParams, 'Sources'>>().params?.signedOnly);
  const q = useQuery({ queryKey: ['sources', signedOnly], queryFn: () => signedOnly ? api.sources(undefined, true) : api.sources() });
  const [spend, setSpend] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const save = async (month: string) => {
    setMsg(null);
    try { await api.saveSpend(month, spend); await qc.invalidateQueries({ queryKey: ['sources'] }); setMsg(ar ? 'اتحفظ.' : 'Saved.'); } catch (e) { setMsg(toastError(errorText(e, lang))); }
  };
  return (
    <Gate q={q}>
      {(d) => (
        <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
          <Text style={[styles.h, { color: colors.text }]}>{d.month}</Text>
          {signedOnly ? <Text style={{ color: colors.muted }}>{ar
            ? 'صفقات اتسجلت في الشهر ده وحالتها اتوقّعت أو اتدفعت. عدد العملاء بيتحسب حسب يوم إضافتهم.'
            : 'Deals dated in this month and currently signed or paid. Leads are counted by their creation date.'}</Text> : null}
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
    try { await api.assignEnquiry(id, { phone: phones[id] ?? '' }); await qc.invalidateQueries({ queryKey: ['portal'] }); } catch (e) { toast(errorText(e, lang), true); }
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

type LinkRowData = Record<string, unknown>;
const whenText = (v: unknown, lang: Lang) => (v ? rowDate(lang, String(v)) : '');

const LinkItem = memo(function LinkItem({ x, lang }: { x: LinkRowData; lang: Lang }) {
  const { colors } = useTheme();
  const ar = lang === 'ar';
  const lead = x.lead as { name?: string | null; ref?: string | null; phone?: string | null } | null;
  return (
    <View style={styles.item}><Card testID="link-row">
      <View style={styles.rowBetween}>
        <Text style={{ color: colors.primaryInk, fontWeight: '800', flex: 1 }}>{str(x.unit_code)}{x.compound ? ` · ${str(x.compound)}` : ''}</Text>
        <Text style={{ color: Number(x.open_count) ? colors.accentInk : colors.muted, fontWeight: '700' }}>{Number(x.open_count) ? `${num(x.open_count)} ${ar ? 'فتحة' : 'opens'} · ${num(x.devices)} ${ar ? 'جهاز' : 'devices'}` : ar ? 'ما اتفتحش' : 'Not opened'}</Text>
      </View>
      <Text style={{ color: colors.text }}>{[lead?.name || lead?.ref, (str(x.recipient_phone) || lead?.phone) ? ltr(str(x.recipient_phone) || lead?.phone || '') : ''].filter(Boolean).join(' · ') || (ar ? 'من غير عميل' : 'No client')}</Text>
      <Text style={{ color: colors.muted }}>{ar ? 'اتبعت' : 'Sent'} {whenText(x.created_at, lang)}{x.sent_by ? ` · ${str(x.sent_by)}` : ''}</Text>
      {x.last_opened_at ? <Text style={{ color: colors.muted }}>{ar ? 'آخر فتح' : 'Last opened'} {whenText(x.last_opened_at, lang)}</Text> : null}
    </Card></View>
  );
});

/** Links sent to clients: when, to whom, by whom, how often opened. Last 7 days first; filters and "load more" keep it short as it grows. */
export function LinksScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const ar = lang === 'ar';
  const picked = useRoute<RouteProp<RootStackParams, 'Links'>>().params;
  const [days, setDays] = useState(picked?.days ? String(picked.days) : picked?.leadRef ? 'all' : '7');
  const [status, setStatus] = useState(picked?.opened ? 'opened' : 'all');
  const [text, setText] = useState(picked?.search ?? '');
  const [search, setSearch] = useState(picked?.search ?? '');
  const list = useInfiniteQuery({
    queryKey: ['openedLinks', days, status, search, picked?.leadRef],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api.openedLinks(status === 'all' ? undefined : status, pageParam, search || undefined, days === 'all' ? undefined : Number(days), picked?.leadRef),
    getNextPageParam: (last) => (last.page + 1 < last.pages ? last.page + 1 : undefined),
  });
  const rows = useMemo(() => list.data?.pages.flatMap((p) => p.rows) ?? [], [list.data]);
  const total = list.data?.pages[0]?.total ?? 0;
  const renderItem = useCallback(({ item }: { item: LinkRowData }) => <LinkItem x={item} lang={lang} />, [lang]);
  return (
    <FlashList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.listPad}
      keyboardShouldPersistTaps="handled"
      data={rows}
      keyExtractor={(x, i) => str(x.token_hash ?? i)}
      renderItem={renderItem}
      onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
      onEndReachedThreshold={0.6}
      ListHeaderComponent={(
        <View style={styles.head}>
          {picked?.leadRef ? <Text style={{ color: colors.text }}>{[picked.leadLabel, picked.leadRef].filter(Boolean).join(' · ')}</Text> : null}
          <Chips testID="links-days" value={days} options={[{ value: '7', label: ar ? 'آخر 7 أيام' : 'Last 7 days' }, { value: '30', label: ar ? 'آخر 30 يوم' : 'Last 30 days' }, { value: 'all', label: ar ? 'الكل' : 'All' }]} onChange={setDays} />
          <Chips testID="links-status" value={status} options={[{ value: 'all', label: ar ? 'كل الحالات' : 'Any' }, { value: 'opened', label: ar ? 'اتفتحت' : 'Opened' }, { value: 'never', label: ar ? 'ما اتفتحتش' : 'Not opened' }, { value: 'repeat', label: ar ? 'اتفتحت أكتر من مرة' : 'Opened twice or more' }]} onChange={setStatus} />
          <Field testID="links-search" label={ar ? 'ابحث بكود الوحدة أو اسم العميل أو رقمه' : 'Search by unit code, client name or number'} value={text} onChangeText={setText} returnKeyType="search" onSubmitEditing={() => setSearch(text.trim())} />
          <Button testID="links-search-go" variant="secondary" label={ar ? 'بحث' : 'Search'} onPress={() => setSearch(text.trim())} />
          {!list.isPending && !list.isError ? <Text style={{ color: colors.muted }}>{total} {ar ? 'لينك' : total === 1 ? 'link' : 'links'}</Text> : null}
        </View>
      )}
      ListEmptyComponent={list.isPending ? <Loading label={t(lang, 'loading')} /> : list.isError ? <ErrorView message={errorText(list.error, lang)} retryLabel={t(lang, 'retry')} onRetry={async () => { await list.refetch(); }} /> : <Text style={{ color: colors.muted }}>{ar ? 'مفيش لينكات بالفلتر ده.' : 'No links with this filter.'}</Text>}
      ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator style={styles.footer} color={colors.primaryInk} /> : null}
    />
  );
}

const styles = StyleSheet.create({
  pad: { padding: spacing.lg, gap: spacing.md },
  listPad: { padding: spacing.lg },
  item: { marginBottom: spacing.md },
  head: { gap: spacing.md, marginBottom: spacing.md },
  footer: { padding: spacing.lg },
  card: { borderWidth: 1, borderRadius: radius.card, padding: spacing.md, gap: spacing.xs },
  h: { fontSize: 16, fontWeight: '700' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
