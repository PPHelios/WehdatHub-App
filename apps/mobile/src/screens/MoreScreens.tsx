import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../api';
import { currentLang } from '../auth';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { ErrorView, Loading } from '../components/StateViews';
import { errorText } from '../errors';
import { t } from '../i18n';
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

/** The project catalogue. Editing projects, uploads and price sheets stay on the website. */
export function ProjectsScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const [q, setQ] = useState('');
  const query = useQuery({ queryKey: ['catalogue', q], queryFn: () => api.catalogue(q || undefined) });
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
      <Field label={lang === 'ar' ? 'ابحث في المشاريع' : 'Search projects'} value={q} onChangeText={setQ} testID="project-search" />
      <Gate q={query}>
        {(d) => (
          <View style={styles.gap}>
            {d.projects.items.map((p) => (
              <Pressable key={str(p.id)} testID={`project-${str(p.id)}`} accessibilityRole="button" onPress={() => nav.navigate('Project', { id: str(p.id), name: str(p.name) })}>
                <Card>
                  <Text style={[styles.h, { color: colors.text }]}>{str(p.name)}</Text>
                  <Text style={{ color: colors.muted }}>{str(p.district)} {str(p.city)} · {num(p.units)} {lang === 'ar' ? 'وحدة' : 'units'}</Text>
                </Card>
              </Pressable>
            ))}
          </View>
        )}
      </Gate>
    </ScrollView>
  );
}

/** One project: facts, notes, plans, materials and units. Managers can archive it. */
export function ProjectScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const ar = lang === 'ar';
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const qc = useQueryClient();
  const id = useRoute<RouteProp<RootStackParams, 'Project'>>().params.id;
  const query = useQuery({ queryKey: ['project', id], queryFn: () => api.project(id) });
  const archive = async (on: boolean) => {
    try { await api.archiveProject(id, on); await qc.invalidateQueries({ queryKey: ['catalogue'] }); nav.goBack(); } catch (e) { Alert.alert(errorText(e, lang)); }
  };
  return (
    <Gate q={query}>
      {(d) => (
        <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.pad}>
          <Card>
            <Text style={[styles.h, { color: colors.text }]}>{str(d.project.name)}</Text>
            <Text style={{ color: colors.muted }}>{str(d.project.district)} {str(d.project.city)} {d.project.delivery_year ? `· ${str(d.project.delivery_year)}` : ''}</Text>
            {d.project.notes ? <Text style={{ color: colors.text }}>{str(d.project.notes)}</Text> : null}
          </Card>
          {d.plans.length ? <Card><Text style={[styles.h, { color: colors.text }]}>{ar ? 'خطط الدفع' : 'Payment plans'}</Text>{d.plans.map((p) => <Text key={str(p.id)} style={{ color: colors.text }}>{str(p.name)} · {str(p.down_payment_pct)}% · {str(p.years)} {ar ? 'سنين' : 'years'}</Text>)}</Card> : null}
          {d.materials.length ? <Card><Text style={[styles.h, { color: colors.text }]}>{ar ? 'الملفات واللينكات' : 'Files and links'}</Text>{d.materials.map((m) => <Text key={str(m.id)} style={{ color: colors.text }}>{str(m.title ?? m.name)}</Text>)}</Card> : null}
          <Card><Text style={[styles.h, { color: colors.text }]}>{ar ? 'الوحدات' : 'Units'} ({d.units.length})</Text>{d.units.map((u) => (
            <Pressable key={str(u.id)} accessibilityRole="button" onPress={() => nav.navigate('Unit', { code: str(u.code) })}><Text style={{ color: colors.primary }}>{str(u.code)} · {num(u.price_value)} · {str(u.status)}</Text></Pressable>
          ))}</Card>
          {d.canEdit ? <Button testID="project-archive" variant="secondary" label={ar ? 'أرشفة المشروع' : 'Archive project'} onPress={() => archive(true)} /> : null}
        </ScrollView>
      )}
    </Gate>
  );
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
    try { const r = await api.compare(codes.map((c) => c.trim()).filter(Boolean), lang); setUrl(r.url); } catch (e) { setMsg(errorText(e, lang)); }
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

/** The agency's plan, credits and payments. Payment requests stay on the website. */
export function PlanScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const ar = lang === 'ar';
  const query = useQuery({ queryKey: ['plan'], queryFn: () => api.plan() });
  return (
    <Gate q={query}>
      {(d) => (
        <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.pad}>
          <Card testID="plan-allowance">
            {Object.entries(d.allowance).filter(([, v]) => typeof v === 'string' || typeof v === 'number').map(([k, v]) => <Text key={k} style={{ color: colors.text }}>{k}: {str(v)}</Text>)}
          </Card>
          {d.payments.length ? <Card><Text style={[styles.h, { color: colors.text }]}>{ar ? 'المدفوعات' : 'Payments'}</Text>{d.payments.map((p) => <Text key={str(p.id ?? p.reference)} style={{ color: colors.text }}>{str(p.reference)} · {str(p.status)}</Text>)}</Card> : null}
        </ScrollView>
      )}
    </Gate>
  );
}

/** This month's usage: yours, and the agency's for managers. */
export function UsageScreen() {
  const { colors } = useTheme();
  const query = useQuery({ queryKey: ['usage'], queryFn: () => api.usage() });
  const lines = (o: Record<string, unknown> | null) => (o ? Object.entries(o).filter(([, v]) => typeof v === 'string' || typeof v === 'number').map(([k, v]) => <Text key={k} style={{ color: colors.text }}>{k}: {str(v)}</Text>) : null);
  return (
    <Gate q={query}>
      {(d) => (
        <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.pad}>
          <Card testID="usage-mine">{lines(d.mine)}</Card>
          {d.agency ? <Card testID="usage-agency">{lines(d.agency)}</Card> : null}
        </ScrollView>
      )}
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
              <Switch testID="platform-signup" value={d.signupOpen} onValueChange={(v) => run(async () => { await api.platformSignup(v); })} />
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
  pad: { padding: spacing.lg, gap: spacing.md },
  gap: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', justifyContent: 'space-between' },
  card: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
  h: { fontSize: 16, fontWeight: '700' },
});
