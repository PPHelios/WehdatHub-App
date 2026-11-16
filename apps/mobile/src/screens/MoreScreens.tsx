import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BusySwitch } from '../components/BusySwitch';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../api';
import type { AiUsage } from '@wehdathub/shared';
import { currentLang } from '../auth';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { ErrorView, Loading } from '../components/StateViews';
import { errorText } from '../errors';
import { t } from '../i18n';
import { clientLang } from '../prefs';
import type { RootStackParams } from '../navigation';
import { radius, spacing, useTheme } from '../theme';

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const num = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : Number(v).toLocaleString('en-US'));

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

/** The shared project library: managers copy a project into their own. */
export function LibraryScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const query = useQuery({ queryKey: ['library'], queryFn: () => api.library() });
  const use = async (id: string) => {
    try { const r = await api.useLibrary(id); nav.navigate('Project', { id: r.projectId, name: '' }); } catch (e) { Alert.alert(errorText(e, lang)); }
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
    try { const r = await api.compare(codes.map((c) => c.trim()).filter(Boolean), clientLang()); setUrl(r.url); } catch (e) { setMsg(errorText(e, lang)); }
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

type MeterData = { used: number; limit: number };
type Allowance = { plan?: { name?: [string, string]; priceEgp?: number }; source?: string; until?: string | null; credits?: MeterData; seats?: MeterData; units?: MeterData };

const SOURCE_LABEL: Record<string, [string, string]> = { pilot: ['تجريبي للشركاء (ببلاش)', 'Pilot (free)'], paid: ['مدفوعة', 'Paid'], trial: ['فترة تجربة', 'Trial'], free: ['مجانية', 'Free'] };

/** A used-of-limit bar: brand azure, copper from 80%, red at the limit. */
function Meter({ label, used, limit, testID }: { label: string; used: number; limit: number; testID?: string }) {
  const { colors } = useTheme();
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const fill = pct >= 100 ? colors.danger : pct >= 80 ? colors.accent : colors.primary;
  return (
    <View testID={testID} style={styles.meter}>
      <View style={styles.meterHead}>
        <Text style={{ color: colors.text, fontWeight: '700' }}>{label}</Text>
        <Text style={{ color: colors.muted }}>{num(used)} / {num(limit)}</Text>
      </View>
      <View style={[styles.track, { backgroundColor: colors.border }]}>
        <View style={{ width: `${pct}%`, height: 8, borderRadius: 4, backgroundColor: fill }} />
      </View>
    </View>
  );
}

const meters = (a: Allowance, ar: boolean) => (
  <>
    {a.credits ? <Meter testID="meter-credits" label={ar ? 'رصيد الذكاء الاصطناعي (الشهر ده)' : 'AI credits (this month)'} used={a.credits.used} limit={a.credits.limit} /> : null}
    {a.seats ? <Meter testID="meter-seats" label={ar ? 'المستخدمين' : 'Users'} used={a.seats.used} limit={a.seats.limit} /> : null}
    {a.units ? <Meter testID="meter-units" label={ar ? 'الوحدات' : 'Units'} used={a.units.used} limit={a.units.limit} /> : null}
  </>
);

/** The agency's plan: its name and period, what is used of users, units and AI credits, and its payments. */
export function PlanScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const ar = lang === 'ar';
  const query = useQuery({ queryKey: ['plan'], queryFn: () => api.plan() });
  return (
    <Gate q={query}>
      {(d) => {
        const a = d.allowance as Allowance;
        const src = SOURCE_LABEL[a.source ?? ''];
        return (
          <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.pad}>
            <Card testID="plan-allowance">
              <Text style={[styles.h, { color: colors.text }]}>{a.plan?.name ? a.plan.name[ar ? 0 : 1] : ''}</Text>
              {src ? <Text style={{ color: colors.muted }}>{src[ar ? 0 : 1]}{a.until ? ` · ${ar ? 'لحد' : 'until'} ${str(a.until).slice(0, 10)}` : ''}</Text> : null}
              {a.plan?.priceEgp ? <Text style={{ color: colors.muted }}>{num(a.plan.priceEgp)} {t(lang, 'egp')} / {ar ? 'شهر' : 'month'}</Text> : null}
              {meters(a, ar)}
            </Card>
            {d.payments.length ? <Card><Text style={[styles.h, { color: colors.text }]}>{ar ? 'المدفوعات' : 'Payments'}</Text>{d.payments.map((p) => <Text key={str(p.id ?? p.reference)} style={{ color: colors.text }}>{str(p.reference)} · {str(p.status)}</Text>)}</Card> : null}
          </ScrollView>
        );
      }}
    </Gate>
  );
}

type UsageBlock = { total?: number; today?: number; actions?: { action: string; n: number; today: number }[] } | null;

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
        <Text testID="ai-own-pool" style={{ color: colors.muted }}>{ar ? `استهلكت ${num(own.used)} الشهر ده، من رصيد الشركة المشترك.` : `You used ${num(own.used)} this month, from the agency's shared pool.`}</Text>
      )}
      {ai.people ? (
        <View testID="ai-people">
          {ai.people.map((p) => (
            <Text key={p.id} style={{ color: colors.text }}>{p.name}: {num(p.used)}{p.allowance != null ? ` / ${num(p.allowance)}` : ''}</Text>
          ))}
          <Text style={{ color: colors.muted }}>
            {ai.canEdit
              ? ar ? 'غيّر الإعدادات من الموقع.' : 'Change these settings on the website.'
              : ar ? 'مالك الشركة لم يسمح للمديرين بتغيير ده.' : 'The agency owner has not allowed managers to change this'}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

export function UsageScreen() {
  const { colors } = useTheme();
  const ar = currentLang() === 'ar';
  const query = useQuery({ queryKey: ['usage'], queryFn: () => api.usage() });
  const block = (u: UsageBlock, testID: string, title: string) =>
    u ? (
      <Card testID={testID}>
        <Text style={[styles.h, { color: colors.text }]}>{title}</Text>
        <Text style={{ color: colors.muted }}>{ar ? 'النهارده' : 'Today'}: {num(u.today ?? 0)} · {ar ? 'الشهر' : 'This month'}: {num(u.total ?? 0)}</Text>
        {(u.actions ?? []).map((x) => <Text key={x.action} style={{ color: colors.text }}>{x.action.replace(/_/g, ' ')}: {num(x.n)}</Text>)}
      </Card>
    ) : null;
  return (
    <Gate q={query}>
      {(d) => {
        const st = d.state as { used?: number; limit?: number };
        return (
          <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.pad}>
            <Card testID="usage-credits">
              {meters(d.allowance as Allowance, ar)}
              {typeof st.limit === 'number' ? <Meter testID="meter-messages" label={ar ? 'رسايل البوت للشركة (الشهر ده)' : 'Agency bot messages (this month)'} used={st.used ?? 0} limit={st.limit} /> : null}
            </Card>
            {d.ai ? <AiUsageCard ai={d.ai} ar={ar} /> : null}
            {block(d.mine as UsageBlock, 'usage-mine', ar ? 'رسايلي' : 'My messages')}
            {block(d.agency as UsageBlock, 'usage-agency', ar ? 'رسايل الشركة' : 'Agency messages')}
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
    try { const m = await fn(); await qc.invalidateQueries({ queryKey: ['platform'] }); setMsg(m || (ar ? 'تمام.' : 'Done.')); } catch (e) { setMsg(errorText(e, lang)); }
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
          </Card>
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
  card: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
  h: { fontSize: 16, fontWeight: '700' },
});
