import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { AppText as Text } from '../components/AppText';
import { BusySwitch } from '../components/BusySwitch';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../api';
import { usageOptions } from '../queries';
import { UNLIMITED_UNITS } from '@wehdathub/shared';
import type { AiUsage, PaymentChoice, PlanAllowance } from '@wehdathub/shared';
import { planT } from '../planText';
import { priceRows, unitWarnPct } from '../planState';
import { currentLang } from '../auth';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { StatRow } from '../components/StatRow';
import { ErrorView, Loading } from '../components/StateViews';
import { errorText } from '../errors';
import { t } from '../i18n';
import { useRights } from '../rights';
import { clientLang } from '../prefs';
import type { RootStackParams } from '../navigation';
import { radius, spacing, useTheme } from '../theme';
import { toast, toastError } from '../components/Toast';

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const num = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : Number(v).toLocaleString('en-US'));
/** "used / limit" kept in that order when the screen is right-to-left (an isolated left-to-right run, so Arabic does not flip it). */
export const ratioText = (used: unknown, limit: unknown) => `⁦${num(used)} / ${num(limit)}⁩`;

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

/** The shared project library: managers copy a project into their own. */
export function LibraryScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const query = useQuery({ queryKey: ['library'], queryFn: () => api.library() });
  const use = async (id: string) => {
    try { const r = await api.useLibrary(id); nav.navigate('Project', { id: r.projectId, name: '' }); } catch (e) { toast(errorText(e, lang), true); }
  };
  return (
    <Gate q={query}>
      {(d) => (
        <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.pad}>
          {d.items.map((g) => (
            <Card key={str(g.id)} testID={`lib-${str(g.id)}`}>
              <Text style={[styles.h, { color: colors.text }]}>{str(g.name)}</Text>
              {g.used ? <Text style={{ color: colors.muted }}>{lang === 'ar' ? 'عندك نسخة' : 'You have a copy'}</Text> : <Button testID={`lib-use-${str(g.id)}`} variant="secondary" label={lang === 'ar' ? 'انسخ لمشاريعي' : 'Copy to my projects'} onPress={() => use(str(g.id))} />}
            </Card>
          ))}
        </ScrollView>
      )}
    </Gate>
  );
}

/** Pick 2-3 unit codes and get a comparison link to send a client. */
export function CompareScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const ar = lang === 'ar';
  const [codes, setCodes] = useState(['', '', '']);
  const [url, setUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const make = async () => {
    setMsg(null); setUrl(null);
    try { const r = await api.compare(codes.map((c) => c.trim()).filter(Boolean), clientLang()); setUrl(r.url); } catch (e) { setMsg(toastError(errorText(e, lang))); }
  };
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
      {codes.map((c, i) => <Field key={i} label={`${ar ? 'كود' : 'Code'} ${i + 1}`} value={c} onChangeText={(v) => setCodes(codes.map((x, j) => (j === i ? v : x)))} autoCapitalize="characters" testID={`compare-code-${i}`} />)}
      {msg ? <Text testID="compare-msg" style={{ color: colors.danger }}>{msg}</Text> : null}
      {url ? <Text testID="compare-url" selectable style={{ color: colors.text }}>{url}</Text> : null}
      <Button testID="compare-make" label={ar ? 'اعمل رابط المقارنة' : 'Make the comparison link'} onPress={make} />
    </ScrollView>
  );
}

type Allowance = PlanAllowance;

const SOURCE_LABEL: Record<string, [string, string]> = { pilot: ['تجريبي للشركاء (ببلاش)', 'Pilot (free)'], paid: ['مدفوعة', 'Paid'], trial: ['فترة تجربة', 'Trial'], free: ['مجانية', 'Free'], grace: ['فترة سماح', 'Grace period'], readonly: ['للقراءة بس', 'Read-only'], blocked: ['متوقفة', 'Stopped'] };

/** A used-of-limit bar: brand gold, accent from 80%, red at the limit. */
function Meter({ label, used, limit, testID }: { label: string; used: number; limit: number; testID?: string }) {
  const { colors } = useTheme();
  const pct = limit > 0 && limit < UNLIMITED_UNITS ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const fill = pct >= 100 ? colors.danger : pct >= 80 ? colors.accent : colors.primary;
  return (
    <View testID={testID} style={styles.meter}>
      <View style={styles.meterHead}>
        <Text style={{ color: colors.text, fontWeight: '700' }}>{label}</Text>
        <Text style={{ color: colors.muted }}>{limit >= UNLIMITED_UNITS ? `⁦${num(used)} / ${planT(currentLang(), 'unlimited')}⁩` : ratioText(used, limit)}</Text>
      </View>
      <View style={[styles.track, { backgroundColor: colors.border }]}>
        <View style={{ width: `${pct}%`, height: 8, borderRadius: 4, backgroundColor: fill }} />
      </View>
    </View>
  );
}

const meters = (a: Allowance, ar: boolean, warn: string) => (
  <>
    {a.credits ? <Meter testID="meter-credits" label={ar ? 'رصيد الذكاء الاصطناعي (الشهر ده)' : 'AI credits (this month)'} used={a.credits.used} limit={a.credits.limit} /> : null}
    {a.seats ? <Meter testID="meter-seats" label={ar ? 'المستخدمين' : 'Users'} used={a.seats.used} limit={a.seats.limit} /> : null}
    {a.units ? <Meter testID="meter-units" label={ar ? 'الوحدات (متاحة ومؤرشفة ومباعة)' : 'Units (available, archived, sold)'} used={a.units.used} limit={a.units.limit} /> : null}
    {unitWarnPct(a.units) !== null ? <Text testID="units-warning" style={{ color: warn, fontWeight: '700' }}>{planT(ar ? 'ar' : 'en', 'unitsWarn', unitWarnPct(a.units)!)}</Text> : null}
  </>
);

/** Plan is part of Usage now (one screen): the old Plan entry opens the same page. */
export function PlanScreen() {
  return <UsageScreen />;
}


/** This month's use: AI credits, the agency's message credits, and your own messages (the agency's for managers). */
/**
 * My AI use (read only; the settings are changed on the website). In the agency's per-person mode it says the person's own
 * limit and use; in the shared-pool mode just the use. Managers also see everyone's use and whether the owner lets them edit.
 */
export function AiUsageCard({ ai, ar }: { ai: AiUsage; ar: boolean }) {
  const { colors } = useTheme();
  const own = ai.mine;
  return (
    <Card testID="usage-ai">
      <Text style={[styles.h, { color: colors.text }]}>{ar ? 'استهلاكي للذكاء الاصطناعي' : 'My AI use'}</Text>
      {ai.mode === 'per_user' && own.allowance != null ? (
        <>
          <Text testID="ai-own-limit" style={{ color: colors.text, fontWeight: '700' }}>
            {ar ? `حدك في الذكاء الاصطناعي: ${num(own.allowance)} الشهر ده، استهلكت ${num(own.used)}` : `Your AI limit: ${num(own.allowance)} this month, used ${num(own.used)}`}
          </Text>
          <Meter testID="meter-ai-own" label={ar ? 'حدي' : 'My limit'} used={own.used} limit={own.allowance} />
        </>
      ) : ai.mode === 'per_user' ? (
        <Text testID="ai-own-none" style={{ color: colors.muted }}>{ar ? `مفيش حد شخصي ليك. استهلكت ${num(own.used)} الشهر ده.` : `You have no personal limit. Used ${num(own.used)} this month.`}</Text>
      ) : (
        <Text testID="ai-own-pool" style={{ color: colors.text, backgroundColor: colors.bg, padding: spacing.md, borderRadius: radius.sm, overflow: 'hidden' }}>{ar ? `استهلكت ${num(own.used)} الشهر ده، من رصيد الشركة المشترك.` : `You used ${num(own.used)} this month, from the agency's shared pool.`}</Text>
      )}
      {ai.people ? (
        <View testID="ai-people" style={{ gap: spacing.sm, marginTop: spacing.xs }}>
          {[...ai.people].sort((x, y) => y.used - x.used).map((p) => {
            const cap = p.allowance ?? Math.max(1, ...ai.people!.map((q) => q.used));
            const pct = cap > 0 ? Math.min(100, Math.round((p.used / cap) * 100)) : 0;
            return (
              <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: colors.onPrimary, fontWeight: '700' }}>{(p.name.trim()[0] || '?').toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '600', flexShrink: 1 }}>{p.name}</Text>
                    <Text style={{ color: colors.muted }}>{p.allowance != null ? ratioText(p.used, p.allowance) : num(p.used)}</Text>
                  </View>
                  <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.border }}>
                    <View style={{ width: `${pct}%`, height: 6, borderRadius: 3, backgroundColor: p.allowance != null && p.used >= p.allowance ? colors.danger : colors.primary }} />
                  </View>
                </View>
              </View>
            );
          })}
          <View style={{ flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: radius.sm, backgroundColor: colors.bg, marginTop: spacing.xs }}>
            <Text>ℹ️</Text>
            <Text style={{ color: colors.muted, flex: 1 }}>
              {ai.canEdit
                ? ar ? 'غيّر الإعدادات من الموقع.' : 'Change these settings on the website.'
                : ar ? 'مالك الشركة لم يسمح للمديرين بتغيير ده.' : 'The agency owner has not allowed managers to change this'}
            </Text>
          </View>
        </View>
      ) : null}
    </Card>
  );
}

/** My usage and limits. Managers and the owner also see the agency's plan (name, source, price) and its payments on the same page. */
export function UsageScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const ar = lang === 'ar';
  const rights = useRights();
  const qc = useQueryClient();
  const query = useQuery(usageOptions());
  const planQ = useQuery({ queryKey: ['plan'], queryFn: () => api.plan(), enabled: rights.manager || rights.agencyOwner });
  const [announced, setAnnounced] = useState<{ reference: string; amount: number } | null>(null);
  async function announce(choice: PaymentChoice) {
    try {
      const { kind, plan, months, bundle } = choice;
      const { payment } = await api.planPay({ kind, plan, months, bundle });
      setAnnounced({ reference: str(payment.reference), amount: Number(payment.amount_egp ?? choice.amount) });
      await qc.invalidateQueries({ queryKey: ['plan'] });
    } catch (error) {
      toast(errorText(error, lang), true);
    }
  }
  return (
    <Gate q={query}>
      {(d) => {
        const plan = planQ.data;
        const pa = plan?.allowance as Allowance | undefined;
        const src = pa ? SOURCE_LABEL[pa.source ?? ''] : undefined;
        return (
          <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.pad}>
            {pa ? (
              <Card testID="plan-allowance">
                <Text style={[styles.h, { color: colors.text }]}>{pa.plan?.name ? pa.plan.name[ar ? 0 : 1] : ''}</Text>
                {src ? <Text style={{ color: colors.muted }}>{src[ar ? 0 : 1]}{pa.until ? ` · ${ar ? 'لحد' : 'until'} ${str(pa.until).slice(0, 10)}` : ''}</Text> : null}
                {pa.source === 'trial' ? <Text testID="plan-trial-copy" style={{ color: colors.muted }}>{planT(lang, 'trial')}</Text> : null}
                {priceRows(pa.plan).length ? (
                  <View testID="plan-prices" style={{ gap: 2 }}>
                    <Text style={{ color: colors.text, fontWeight: '700' }}>{planT(lang, 'pricesTitle')}</Text>
                    {priceRows(pa.plan).map((r) => (
                      <Text key={r.months} testID={`plan-price-${r.months}`} style={{ color: colors.muted }}>
                        {r.months === 1 ? planT(lang, 'month1') : planT(lang, 'months', r.months)}: {num(r.price)} {t(lang, 'egp')}{r.perMonth !== null ? ` (${planT(lang, 'perMonth', r.perMonth)})` : ''}
                      </Text>
                    ))}
                    <Text style={{ color: colors.muted }}>{planT(lang, 'payNote')}</Text>
                  </View>
                ) : null}
              </Card>
            ) : null}
            {rights.agencyOwner && plan ? (
              <Card testID="billing-delegation-card">
                <Text style={[styles.h, { color: colors.text }]}>{ar ? 'صلاحيات المديرين في الفواتير' : 'Manager Billing Permissions'}</Text>
                <View style={styles.row}>
                  <Text style={[styles.flex, { color: colors.text }]}>{ar ? 'السماح للمديرين بتجديد الباقة' : 'Allow managers to renew plan'}</Text>
                  <BusySwitch
                    testID="sw-manager-renew"
                    value={Boolean(plan.managerCanRenewPlan)}
                    onValueChange={async (v) => {
                      try {
                        await api.updateBillingPermissions({ managerCanRenewPlan: v });
                        await qc.invalidateQueries({ queryKey: ['plan'] });
                      } catch (e) {
                        toast(errorText(e, lang), true);
                      }
                    }}
                  />
                </View>
                <View style={styles.row}>
                  <Text style={[styles.flex, { color: colors.text }]}>{ar ? 'السماح للمديرين بشحن باقات الذكاء الاصطناعي' : 'Allow managers to buy AI credits'}</Text>
                  <BusySwitch
                    testID="sw-manager-credits"
                    value={Boolean(plan.managerCanBuyCredits)}
                    onValueChange={async (v) => {
                      try {
                        await api.updateBillingPermissions({ managerCanBuyCredits: v });
                        await qc.invalidateQueries({ queryKey: ['plan'] });
                      } catch (e) {
                        toast(errorText(e, lang), true);
                      }
                    }}
                  />
                </View>
              </Card>
            ) : null}
            {plan?.payTo && (rights.agencyOwner || plan.canPay || plan.canBuyCredits) ? (
              <Card testID="pay-to-card">
                <Text style={[styles.h, { color: colors.text }]}>{ar ? 'طرق الدفع' : 'Payment methods'}</Text>
                {plan.payTo.instapay ? <StatRow label={ar ? 'عنوان إنستاباي' : 'InstaPay address'} value={plan.payTo.instapay} /> : null}
                {plan.payTo.bank ? <StatRow label={ar ? 'الحساب البنكي' : 'Bank account'} value={plan.payTo.bank} /> : null}
              </Card>
            ) : null}
            {announced ? <Card>
              <StatRow label={ar ? 'مرجع الدفع' : 'Payment reference'} value={announced.reference} />
              <StatRow label={ar ? 'المبلغ' : 'Amount'} value={`${num(announced.amount)} ${t(lang, 'egp')}`} />
            </Card> : null}
            {plan?.paymentChoices?.length ? <Card>
              <Text style={[styles.h, { color: colors.text }]}>{ar ? 'اعمل طلب دفع' : 'Request a payment reference'}</Text>
              {plan.paymentChoices.map((choice) => (
                <Button key={`${choice.kind}:${choice.plan ?? choice.bundle}:${choice.months ?? ''}`} variant="secondary"
                  label={`${choice.name[ar ? 0 : 1]}${choice.months ? ` · ${planT(lang, 'months', choice.months)}` : ''} · ${num(choice.amount)} ${t(lang, 'egp')}`}
                  onPress={() => announce(choice)} />
              ))}
            </Card> : null}
            <Card testID="usage-credits">
              {meters(d.allowance, ar, colors.warn)}
            </Card>
            {d.ai ? <AiUsageCard ai={d.ai} ar={ar} /> : null}
            {plan?.payments.length ? <Card><Text style={[styles.h, { color: colors.text }]}>{ar ? 'المدفوعات' : 'Payments'}</Text>{plan.payments.map((p) => <StatRow key={str(p.id ?? p.reference)} label={str(p.reference)} value={str(p.status)} />)}</Card> : null}
          </ScrollView>
        );
      }}
    </Gate>
  );
}

/** The app owner's pages: agencies, suspend or resume, sign-up switch, announcements and a new agency. */
export function PlatformScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const ar = lang === 'ar';
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['platform'], queryFn: () => api.platform() });
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [agency, setAgency] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const run = async (fn: () => Promise<string | void>) => {
    setMsg(null);
    try { const m = await fn(); await qc.invalidateQueries({ queryKey: ['platform'] }); setMsg(m || (ar ? 'تمام.' : 'Done.')); } catch (e) { setMsg(toastError(errorText(e, lang))); }
  };
  return (
    <Gate q={query}>
      {(d) => (
        <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
          {msg ? <Text testID="platform-msg" selectable style={{ color: colors.text }}>{msg}</Text> : null}
          <Card>
            <View style={styles.row}>
              <Text style={{ color: colors.text }}>{ar ? 'التسجيل مفتوح' : 'Sign-up open'}</Text>
              <BusySwitch testID="platform-signup" value={d.signupOpen} onValueChange={(v) => run(async () => { await api.platformSignup(v); })} />
            </View>
            {d.paymentChannels ? (['sms', 'telegram'] as const).map((channel) => (
              <View key={channel} style={styles.row}>
                <Text style={[styles.flex, { color: colors.text }]}>{channel === 'sms'
                  ? (ar ? 'التحقق برسائل البنك' : 'Bank SMS verification')
                  : (ar ? 'الموافقة اليدوية في تليجرام' : 'Manual Telegram approval')}</Text>
                <BusySwitch value={d.paymentChannels?.[channel] === true} onValueChange={(v) => run(async () => {
                  if (d.paymentChannels) await api.platformPaymentChannels({ ...d.paymentChannels, [channel]: v });
                })} />
              </View>
            )) : null}
          </Card>
          {d.pendingPayments?.length ? (
            <Card testID="platform-pending-payments">
              <Text style={[styles.h, { color: colors.text }]}>{ar ? 'مدفوعات مستنية التأكيد' : 'Pending payments'}</Text>
              {d.pendingPayments.map((p) => (
                <View key={str(p.id)} testID={`pending-payment-${str(p.id)}`} style={[styles.gap, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.xs }]}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{str(p.agency_name)} · {num(p.amount_egp)} EGP</Text>
                  <Text style={{ color: colors.muted }}>{str(p.reference)} · {str(p.kind)} {p.plan ? `(${str(p.plan)})` : ''}</Text>
                  <View style={styles.row}>
                    <Button variant="primary" label={ar ? '✅ تأكيد' : '✅ Confirm'} onPress={() => run(async () => { await api.platformConfirmPayment(str(p.id)); })} />
                    <Button variant="secondary" label={ar ? '❌ إلغاء' : '❌ Cancel'} onPress={() => run(async () => { await api.platformCancelPayment(str(p.id)); })} />
                  </View>
                </View>
              ))}
            </Card>
          ) : null}
          {d.agencies.map((a) => (
            <Card key={str(a.id)} testID={`agency-${str(a.id)}`}>
              <Text style={[styles.h, { color: colors.text }]}>{str(a.name)} · {str(a.plan)}</Text>
              <Text style={{ color: colors.muted }}>{num(a.brokers)} {ar ? 'بروكر' : 'brokers'} · {num(a.units)} {ar ? 'وحدة' : 'units'} · {num(a.leads30)} {ar ? 'عميل/٣٠ يوم' : 'leads/30d'}</Text>
              <View style={styles.row}>
                <Button variant="secondary" label={ar ? 'إيقاف' : 'Suspend'} onPress={() => run(async () => { await api.platformAgency(str(a.id), 'suspend'); })} />
                <Button variant="secondary" label={ar ? 'رجّعها' : 'Resume'} onPress={() => run(async () => { await api.platformAgency(str(a.id), 'resume'); })} />
              </View>
            </Card>
          ))}
          <Card>
            <Text style={[styles.h, { color: colors.text }]}>{ar ? 'إعلان للمديرين' : 'Announce to managers'}</Text>
            <Field label={ar ? 'العنوان' : 'Title'} value={title} onChangeText={setTitle} />
            <Field label={ar ? 'النص' : 'Text'} value={body} onChangeText={setBody} multiline />
            <Button testID="platform-announce" variant="secondary" label={ar ? 'ابعت' : 'Send'} onPress={() => run(async () => { const r = await api.platformAnnounce(title, body); setTitle(''); setBody(''); return `${r.sent}`; })} />
          </Card>
          <Card>
            <Text style={[styles.h, { color: colors.text }]}>{ar ? 'شركة جديدة' : 'New agency'}</Text>
            <Field label={ar ? 'اسم الشركة' : 'Agency name'} value={agency} onChangeText={setAgency} />
            <Field label={ar ? 'اسم المالك' : 'Owner name'} value={ownerName} onChangeText={setOwnerName} />
            <Field label={ar ? 'موبايل المالك' : 'Owner mobile'} value={ownerPhone} onChangeText={setOwnerPhone} keyboardType="phone-pad" />
            <Button testID="platform-new-agency" label={ar ? 'اعمل الشركة' : 'Create agency'} onPress={() => run(async () => { const r = await api.platformNewAgency({ agency, ownerName, ownerPhone }); return r.url ? `${ar ? 'لينك المالك (مرة واحدة):' : 'Owner link (one use):'} ${r.url}` : undefined; })} />
          </Card>
        </ScrollView>
      )}
    </Gate>
  );
}

const styles = StyleSheet.create({
  meter: { gap: spacing.xs },
  meterHead: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  pad: { padding: spacing.lg, gap: spacing.md },
  gap: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', justifyContent: 'space-between' },
  card: { borderWidth: 1, borderRadius: radius.card, padding: spacing.md, gap: spacing.xs },
  flex: { flex: 1 },
  h: { fontSize: 16, fontWeight: '700' },
});
