import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { AppText as Text } from '../components/AppText';
import { BusySwitch } from '../components/BusySwitch';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../api';
import { usageOptions } from '../queries';
import { UNLIMITED_UNITS } from '@wehdathub/shared';
import type { AiUsage, Lang, PaymentChoice, PlanAllowance } from '@wehdathub/shared';
import { planT } from '../planText';
import { priceRows, unitWarnPct } from '../planState';
import { currentLang } from '../auth';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Field } from '../components/Field';
import { Icon } from '../components/Icon';
import { StatRow } from '../components/StatRow';
import { ErrorView, Loading } from '../components/StateViews';
import { errorText } from '../errors';
import { t } from '../i18n';
import { enter, layout } from '../motion';
import { useRights } from '../rights';
import { clientLang } from '../prefs';
import type { RootStackParams } from '../navigation';
import { radius, spacing, useTheme } from '../theme';
import { toast, toastError } from '../components/Toast';

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const num = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : Number(v).toLocaleString('en-US'));
/** "used / limit" kept in that order when the screen is right-to-left (an isolated left-to-right run, so Arabic does not flip it). */
export const ratioText = (used: unknown, limit: unknown) => `⁦${num(used)} / ${num(limit)}⁩`;
/** Fill {name} slots in a translated string. */
const fill = (s: string, v: Record<string, unknown>) => s.replace(/\{(\w+)\}/g, (_, k: string) => str(v[k]));

function Panel({ children, testID }: { children: React.ReactNode; testID?: string }) {
  return <Card variant="elevated" testID={testID} style={styles.panel}>{children}</Card>;
}

function Gate<T>({ q, children }: { q: { isPending: boolean; isError: boolean; error: unknown; data?: T; refetch: () => Promise<unknown> }; children: (d: T) => React.ReactElement }) {
  const lang = currentLang();
  if (q.isPending) return <Loading kind="cards" label={t(lang, 'loading')} />;
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
          {d.items.map((g, i) => (
            <Animated.View key={str(g.id)} entering={enter(Math.min(i, 8))} layout={layout}>
              <Panel testID={`lib-${str(g.id)}`}>
                <Text variant="body" weight="bold" style={{ color: colors.text }}>{str(g.name)}</Text>
                {g.used ? <Text style={{ color: colors.muted }}>{t(lang, 'mrHaveCopy')}</Text> : <Button testID={`lib-use-${str(g.id)}`} variant="secondary" label={t(lang, 'mrCopyToMine')} onPress={() => use(str(g.id))} />}
              </Panel>
            </Animated.View>
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
  const [codes, setCodes] = useState(['', '', '']);
  const [url, setUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const make = async () => {
    setMsg(null); setUrl(null);
    try { const r = await api.compare(codes.map((c) => c.trim()).filter(Boolean), clientLang()); setUrl(r.url); } catch (e) { setMsg(toastError(errorText(e, lang))); }
  };
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
      {codes.map((c, i) => <Field key={i} label={`${t(lang, 'mrCode')} ${i + 1}`} value={c} onChangeText={(v) => setCodes(codes.map((x, j) => (j === i ? v : x)))} autoCapitalize="characters" testID={`compare-code-${i}`} />)}
      {msg ? <Text testID="compare-msg" style={{ color: colors.danger }}>{msg}</Text> : null}
      {url ? <Text testID="compare-url" selectable style={{ color: colors.text }}>{url}</Text> : null}
      <Button testID="compare-make" label={t(lang, 'mrMakeLink')} onPress={make} />
    </ScrollView>
  );
}

type Allowance = PlanAllowance;

const SOURCE_LABEL: Record<string, [string, string]> = { pilot: ['تجريبي للشركاء (ببلاش)', 'Pilot (free)'], paid: ['مدفوعة', 'Paid'], trial: ['فترة تجربة', 'Trial'], free: ['مجانية', 'Free'], grace: ['فترة سماح', 'Grace period'], readonly: ['للقراءة بس', 'Read-only'], blocked: ['متوقفة', 'Stopped'] };

/** A used-of-limit bar: brand gold, accent from 80%, red at the limit. */
function Meter({ label, used, limit, testID }: { label: string; used: number; limit: number; testID?: string }) {
  const { colors } = useTheme();
  const pct = limit > 0 && limit < UNLIMITED_UNITS ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const fillColor = pct >= 100 ? colors.danger : pct >= 80 ? colors.accent : colors.primary;
  return (
    <View testID={testID} style={styles.meter}>
      <View style={styles.meterHead}>
        <Text weight="bold" style={{ color: colors.text }}>{label}</Text>
        <Text style={{ color: colors.muted }}>{limit >= UNLIMITED_UNITS ? `⁦${num(used)} / ${planT(currentLang(), 'unlimited')}⁩` : ratioText(used, limit)}</Text>
      </View>
      <View style={[styles.track, { backgroundColor: colors.border }]}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: fillColor }]} />
      </View>
    </View>
  );
}

const meters = (a: Allowance, lang: Lang, warn: string, muted: string, showAgencyCredits: boolean) => (
  <>
    {showAgencyCredits && a.credits ? <>
      <Meter testID="meter-credits" label={t(lang, 'mrCredits')} used={a.credits.used} limit={a.credits.limit} />
      <Text style={{ color: muted }}>{num(Math.max(0, a.credits.limit - a.credits.used))} {t(lang, 'mrRemaining')}</Text>
    </> : null}
    {a.seats ? <Meter testID="meter-seats" label={t(lang, 'mrUsers')} used={a.seats.used} limit={a.seats.limit} /> : null}
    {a.units ? <Meter testID="meter-units" label={t(lang, 'mrUnitsMeter')} used={a.units.used} limit={a.units.limit} /> : null}
    {unitWarnPct(a.units) !== null ? <Text testID="units-warning" weight="bold" style={{ color: warn }}>{planT(lang, 'unitsWarn', unitWarnPct(a.units)!)}</Text> : null}
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
  const lang: Lang = ar === true ? 'ar' : 'en';
  const own = ai.mine;
  return (
    <Panel testID="usage-ai">
      <Text variant="body" weight="bold" style={{ color: colors.text }}>{t(lang, 'mrMyAiUse')}</Text>
      {ai.mode === 'per_user' && own.allowance != null ? (
        <>
          <Text testID="ai-own-limit" weight="bold" style={{ color: colors.text }}>
            {fill(t(lang, 'mrAiOwnLimit'), { n: num(own.allowance), u: num(own.used) })}
          </Text>
          <Meter testID="meter-ai-own" label={t(lang, 'mrMyLimit')} used={own.used} limit={own.allowance} />
          {own.remaining != null ? <Text style={{ color: colors.muted }}>{num(own.remaining)} {t(lang, 'mrRemaining')}</Text> : null}
        </>
      ) : ai.mode === 'per_user' ? (
        <Text testID="ai-own-none" style={{ color: colors.muted }}>{fill(t(lang, 'mrAiNoLimit'), { u: num(own.used) })}</Text>
      ) : (
        <Text testID="ai-own-pool" style={[styles.note, { color: colors.text, backgroundColor: colors.bg }]}>{fill(t(lang, 'mrAiPool'), { u: num(own.used) })}</Text>
      )}
      {ai.people ? (
        <View testID="ai-people" style={styles.people}>
          {[...ai.people].sort((x, y) => y.used - x.used).map((p) => {
            const cap = p.allowance ?? Math.max(1, ...ai.people!.map((q) => q.used));
            const pct = cap > 0 ? Math.min(100, Math.round((p.used / cap) * 100)) : 0;
            return (
              <View key={p.id} style={styles.personRow}>
                <View style={[styles.personDot, { backgroundColor: colors.primary }]}>
                  <Text weight="bold" style={{ color: colors.onPrimary }}>{(p.name.trim()[0] || '?').toUpperCase()}</Text>
                </View>
                <View style={styles.personCopy}>
                  <View style={styles.meterHead}>
                    <Text numberOfLines={1} weight="bold" style={[styles.shrink, { color: colors.text }]}>{p.name}</Text>
                    <Text style={{ color: colors.muted }}>{p.allowance != null ? ratioText(p.used, p.allowance) : num(p.used)}</Text>
                  </View>
                  <View style={[styles.thin, { backgroundColor: colors.border }]}>
                    <View style={[styles.thin, { width: `${pct}%`, backgroundColor: p.allowance != null && p.used >= p.allowance ? colors.danger : colors.primary }]} />
                  </View>
                </View>
              </View>
            );
          })}
          <View style={[styles.infoBox, { backgroundColor: colors.bg }]}>
            <Icon name="help" size={18} color={colors.muted} />
            <Text style={[styles.flex, { color: colors.muted }]}>
              {t(lang, ai.canEdit ? 'mrChangeOnWeb' : 'mrManagersNotAllowed')}
            </Text>
          </View>
        </View>
      ) : null}
    </Panel>
  );
}

/** My usage and limits. Managers and the owner also see the agency's plan (name, source, price) and its payments on the same page. */
export function UsageScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const li = lang === 'ar' ? 0 : 1;
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
              <Panel testID="plan-allowance">
                <Text variant="body" weight="bold" style={{ color: colors.text }}>{pa.plan?.name ? pa.plan.name[li] : ''}</Text>
                {src ? <Text style={{ color: colors.muted }}>{src[li]}{pa.until ? ` · ${t(lang, 'mrUntil')} ${str(pa.until).slice(0, 10)}` : ''}</Text> : null}
                {pa.source === 'trial' ? (
                  <Text testID="plan-trial-copy" style={{ color: colors.muted }}>
                    {fill(t(lang, pa.plan.seats === 1 ? 'mrTrialOne' : 'mrTrial'), { s: num(pa.plan.seats), u: num(pa.plan.units), c: num(pa.plan.credits) })}
                  </Text>
                ) : null}
                {priceRows(pa.plan).length ? (
                  <View testID="plan-prices" style={styles.prices}>
                    <Text weight="bold" style={{ color: colors.text }}>{planT(lang, 'pricesTitle')}</Text>
                    {priceRows(pa.plan).map((r) => (
                      <Text key={r.months} testID={`plan-price-${r.months}`} style={{ color: colors.muted }}>
                        {r.months === 1 ? planT(lang, 'month1') : planT(lang, 'months', r.months)}: {num(r.price)} {t(lang, 'egp')}{r.perMonth !== null ? ` (${planT(lang, 'perMonth', r.perMonth)})` : ''}
                      </Text>
                    ))}
                    <Text style={{ color: colors.muted }}>{planT(lang, 'payNote')}</Text>
                  </View>
                ) : null}
              </Panel>
            ) : null}
            {rights.agencyOwner && plan ? (
              <Panel testID="billing-delegation-card">
                <Text variant="body" weight="bold" style={{ color: colors.text }}>{t(lang, 'mrBillingPerms')}</Text>
                <View style={styles.row}>
                  <Text style={[styles.flex, { color: colors.text }]}>{t(lang, 'mrAllowRenew')}</Text>
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
                  <Text style={[styles.flex, { color: colors.text }]}>{t(lang, 'mrAllowCredits')}</Text>
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
              </Panel>
            ) : null}
            {Platform.OS === 'ios' ? (
              <Panel testID="ios-billing-note">
                <Text style={{ color: colors.muted }}>{t(lang, 'iosBillingNote')}</Text>
              </Panel>
            ) : null}
            {Platform.OS !== 'ios' && plan?.payTo && (rights.agencyOwner || plan.canPay || plan.canBuyCredits) ? (
              <Panel testID="pay-to-card">
                <Text variant="body" weight="bold" style={{ color: colors.text }}>{t(lang, 'mrPayMethods')}</Text>
                {plan.payTo.instapay ? <StatRow label={t(lang, 'mrInstapay')} value={plan.payTo.instapay} /> : null}
                {plan.payTo.bank ? <StatRow label={t(lang, 'mrBank')} value={plan.payTo.bank} /> : null}
              </Panel>
            ) : null}
            {announced ? <Panel>
              <StatRow label={t(lang, 'mrPayRef')} value={announced.reference} />
              <StatRow label={t(lang, 'mrAmount')} value={`${num(announced.amount)} ${t(lang, 'egp')}`} />
            </Panel> : null}
            {Platform.OS !== 'ios' && plan?.paymentChoices?.length ? <Panel testID="payment-choices-card">
              <Text variant="body" weight="bold" style={{ color: colors.text }}>{t(lang, 'mrRequestPay')}</Text>
              {plan.paymentChoices.map((choice) => (
                <Button key={`${choice.kind}:${choice.plan ?? choice.bundle}:${choice.months ?? ''}`} variant="secondary"
                  label={`${choice.name[li]}${choice.months ? ` · ${planT(lang, 'months', choice.months)}` : ''} · ${num(choice.amount)} ${t(lang, 'egp')}`}
                  onPress={() => announce(choice)} />
              ))}
            </Panel> : null}
            <Panel testID="usage-credits">
              {meters(d.allowance, lang, colors.warn, colors.muted, rights.manager || rights.agencyOwner)}
            </Panel>
            {d.ai ? <AiUsageCard ai={d.ai} ar={lang === 'ar'} /> : null}
            {plan?.payments.length ? <Panel><Text variant="body" weight="bold" style={{ color: colors.text }}>{t(lang, 'mrPayments')}</Text>{plan.payments.map((p) => <StatRow key={str(p.id ?? p.reference)} label={str(p.reference)} value={str(p.status)} />)}</Panel> : null}
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
    try { const m = await fn(); await qc.invalidateQueries({ queryKey: ['platform'] }); setMsg(m || t(lang, 'mrDone')); } catch (e) { setMsg(toastError(errorText(e, lang))); }
  };
  return (
    <Gate q={query}>
      {(d) => (
        <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
          {msg ? <Text testID="platform-msg" selectable style={{ color: colors.text }}>{msg}</Text> : null}
          <Panel>
            <View style={styles.row}>
              <Text style={{ color: colors.text }}>{t(lang, 'mrSignupOpen')}</Text>
              <BusySwitch testID="platform-signup" value={d.signupOpen} onValueChange={(v) => run(async () => { await api.platformSignup(v); })} />
            </View>
            {d.paymentChannels ? (['sms', 'telegram'] as const).map((channel) => (
              <View key={channel} style={styles.row}>
                <Text style={[styles.flex, { color: colors.text }]}>{t(lang, channel === 'sms' ? 'mrBankSms' : 'mrTgApproval')}</Text>
                <BusySwitch value={d.paymentChannels?.[channel] === true} onValueChange={(v) => run(async () => {
                  if (d.paymentChannels) await api.platformPaymentChannels({ ...d.paymentChannels, [channel]: v });
                })} />
              </View>
            )) : null}
          </Panel>
          {d.pendingPayments?.length ? (
            <Panel testID="platform-pending-payments">
              <Text variant="body" weight="bold" style={{ color: colors.text }}>{t(lang, 'mrPending')}</Text>
              {d.pendingPayments.map((p) => (
                <View key={str(p.id)} testID={`pending-payment-${str(p.id)}`} style={[styles.gap, styles.sep, { borderTopColor: colors.border }]}>
                  <Text weight="bold" style={{ color: colors.text }}>{str(p.agency_name)} · {num(p.amount_egp)} EGP</Text>
                  <Text style={{ color: colors.muted }}>{str(p.reference)} · {str(p.kind)} {p.plan ? `(${str(p.plan)})` : ''}</Text>
                  <View style={styles.row}>
                    <Button variant="primary" label={t(lang, 'mrConfirm')} onPress={() => run(async () => { await api.platformConfirmPayment(str(p.id)); })} />
                    <Button variant="secondary" label={t(lang, 'cancel')} onPress={() => run(async () => { await api.platformCancelPayment(str(p.id)); })} />
                  </View>
                </View>
              ))}
            </Panel>
          ) : null}
          {d.agencies.map((a, i) => (
            <Animated.View key={str(a.id)} entering={enter(Math.min(i, 8))} layout={layout}>
              <Panel testID={`agency-${str(a.id)}`}>
                <Text variant="body" weight="bold" style={{ color: colors.text }}>{str(a.name)} · {str(a.plan)}</Text>
                <Text style={{ color: colors.muted }}>{num(a.brokers)} {t(lang, 'mrBrokers')} · {num(a.units)} {t(lang, 'mrUnitsWord')} · {num(a.leads30)} {t(lang, 'mrLeads30')}</Text>
                <View style={styles.row}>
                  <Button variant="secondary" label={t(lang, 'mrSuspend')} onPress={() => run(async () => { await api.platformAgency(str(a.id), 'suspend'); })} />
                  <Button variant="secondary" label={t(lang, 'mrResume')} onPress={() => run(async () => { await api.platformAgency(str(a.id), 'resume'); })} />
                </View>
              </Panel>
            </Animated.View>
          ))}
          <Panel>
            <Text variant="body" weight="bold" style={{ color: colors.text }}>{t(lang, 'mrAnnounceTitle')}</Text>
            <Field label={t(lang, 'mrTitle')} value={title} onChangeText={setTitle} />
            <Field label={t(lang, 'mrText')} value={body} onChangeText={setBody} multiline />
            <Button testID="platform-announce" variant="secondary" label={t(lang, 'mrSend')} onPress={() => run(async () => { const r = await api.platformAnnounce(title, body); setTitle(''); setBody(''); return `${r.sent}`; })} />
          </Panel>
          <Panel>
            <Text variant="body" weight="bold" style={{ color: colors.text }}>{t(lang, 'mrNewAgency')}</Text>
            <Field label={t(lang, 'mrAgencyName')} value={agency} onChangeText={setAgency} />
            <Field label={t(lang, 'mrOwnerName')} value={ownerName} onChangeText={setOwnerName} />
            <Field label={t(lang, 'mrOwnerMobile')} value={ownerPhone} onChangeText={setOwnerPhone} keyboardType="phone-pad" />
            <Button testID="platform-new-agency" label={t(lang, 'mrCreateAgency')} onPress={() => run(async () => { const r = await api.platformNewAgency({ agency, ownerName, ownerPhone }); return r.url ? `${t(lang, 'mrOwnerLink')} ${r.url}` : undefined; })} />
          </Panel>
        </ScrollView>
      )}
    </Gate>
  );
}

const styles = StyleSheet.create({
  meter: { gap: spacing.xs },
  meterHead: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  thin: { height: 6, borderRadius: 3 },
  pad: { padding: spacing.lg, gap: spacing.md },
  gap: { gap: spacing.sm },
  sep: { borderTopWidth: 1, paddingTop: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', justifyContent: 'space-between' },
  panel: { padding: spacing.md, gap: spacing.xs },
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  prices: { gap: 2 },
  note: { padding: spacing.md, borderRadius: radius.sm, overflow: 'hidden' },
  people: { gap: spacing.sm, marginTop: spacing.xs },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  personDot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  personCopy: { flex: 1, gap: 4 },
  infoBox: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: radius.sm, marginTop: spacing.xs },
});
