import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText as Text } from '../components/AppText';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../api';
import { currentLang } from '../auth';
import { Button } from '../components/Button';
import { CatalogueBox } from '../components/CatalogueBox';
import { CatalogueForms } from '../components/CatalogueForms';
import { Chips } from '../components/Chips';
import { Field } from '../components/Field';
import { PhotoGallery } from '../components/PhotoGallery';
import { ProjectGallery } from '../components/ProjectGallery';
import { Count, Pager, ProjectCardView } from '../components/ProjectList';
import { ErrorView, Loading } from '../components/StateViews';
import { errorText } from '../errors';
import { featureChip } from '../featureLabels';
import { t } from '../i18n';
import type { RootStackParams } from '../navigation';
import { EMPTY_SEARCH, STATUS_TEXT, deliveryOf, isFiltered, moneyShort, numberOf } from '../projectRules';
import type { CatalogueSearch } from '../projectRules';
import { pt } from '../projectText';
import { plain, withCommas } from '../readback';
import { radius, spacing, useTheme } from '../theme';
import { useDebounced } from '../useDebounced';
import { toast } from '../components/Toast';

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const num = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : Number(v).toLocaleString('en-US'));
const has = (v: unknown) => v !== null && v !== undefined && v !== '' && Number(v) !== 0;

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

/** The developer catalogue: one search box with chips, a bedrooms and price filter, project cards, the count and pages. Managers add projects here. */
export function ProjectsScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const T = pt(lang);
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const [search, setSearchState] = useState<CatalogueSearch>(EMPTY_SEARCH);
  const [page, setPage] = useState(1);
  const setSearch = (s: CatalogueSearch) => { setSearchState(s); setPage(1); };
  const max = useDebounced(numberOf(search.max ?? ''), 500);
  const query = useQuery({
    queryKey: ['catalogue', search.q, search.place?.id, search.features.map((f) => f.key).join(), search.developer?.id, search.bed, max, page],
    queryFn: () => api.catalogue({ q: search.q || undefined, page, place: search.place?.id, features: search.features.map((f) => f.key), developer: search.developer?.id, bed: search.bed, max }),
  });
  const filtered = isFiltered(search);
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
      <CatalogueBox
        search={search}
        onChange={setSearch}
        lang={lang}
        onOpenProject={(id, name) => nav.navigate('Project', { id, name })}
      />
      <View style={styles.filters}>
        <Text style={{ color: colors.muted, fontWeight: '600' }}>{T.bedrooms}</Text>
        <Chips<string> animateFilter testID="catalogue-bed" options={[1, 2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: String(n) }))} value={search.bed ? String(search.bed) : ''} onChange={(v) => setSearch({ ...search, bed: search.bed === Number(v) ? undefined : Number(v) })} />
        <Field testID="catalogue-max" label={T.priceUpTo} value={withCommas(search.max ?? '')} onChangeText={(v) => setSearch({ ...search, max: plain(v) })} keyboardType="number-pad" placeholder="5,000,000" />
        {filtered ? <Button testID="catalogue-clear" variant="secondary" label={T.clear} onPress={() => setSearch(EMPTY_SEARCH)} /> : null}
      </View>
      <Gate q={query}>
        {(d) => (
          <View style={styles.gap}>
            {d.canEdit ? <Button testID="new-project" label={T.newProject} onPress={() => nav.navigate('ProjectForm', {})} /> : null}
            <Count projects={d.projects.total} lang={lang} />
            {d.projects.items.length ? d.projects.items.map((p, i) => (
              <ProjectCardView key={p.id ?? i} p={p} lang={lang} onOpen={p.id ? () => nav.navigate('Project', { id: p.id as string, name: p.name }) : undefined} />
            )) : <Card><Text style={{ color: colors.muted }}>{filtered ? T.noMatch : T.noProjects}</Text></Card>}
            <Pager page={page} pages={d.projects.pages} onPage={setPage} lang={lang} />
            {d.canEdit ? <CatalogueForms /> : null}
          </View>
        )}
      </Gate>
    </ScrollView>
  );
}

const Fact = ({ label, value }: { label: string; value: string | null }) => {
  const { colors } = useTheme();
  return value ? <View style={styles.fact}><Text style={{ color: colors.muted }}>{label}</Text><Text style={{ color: colors.text, fontWeight: '700', flexShrink: 1, textAlign: 'right' }}>{value}</Text></View> : null;
};

/** One project: a photo carousel, its facts, offers, plans, files and units. Managers can edit and archive it. */
export function ProjectScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const T = pt(lang);
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const qc = useQueryClient();
  const id = useRoute<RouteProp<RootStackParams, 'Project'>>().params.id;
  const query = useQuery({ queryKey: ['project', id], queryFn: () => api.project(id) });
  const archive = async (on: boolean) => {
    try { await api.archiveProject(id, on); await qc.invalidateQueries({ queryKey: ['catalogue'] }); nav.goBack(); } catch (e) { toast(errorText(e, lang), true); }
  };
  return (
    <Gate q={query}>
      {(d) => {
        const p = d.project;
        const shared = (d.images ?? []).filter((i) => (!i.role || i.role === 'shared') && (!i.mime || i.mime.startsWith('image/')));
        const photos = shared.length ? shared : p.cover_url ? [{ id: 'cover', url: str(p.cover_url) }] : [];
        const feats = Array.isArray(p.feature_keys) ? (p.feature_keys as string[]) : [];
        const other = Array.isArray(p.features_other) ? (p.features_other as string[]) : [];
        const beds = Array.isArray(p.bedroom_options) ? (p.bedroom_options as number[]) : [];
        const size = has(p.area_acres) ? `${Number(p.area_acres)} ${T.feddan}` : null;
        const delivery = deliveryOf({ name: '', delivery_year: p.delivery_year as number | null, delivery_quarter: p.delivery_quarter as number | null, delivery_raw: p.delivery_raw as string | null });
        const facts = d.facts ?? [];
        return (
          <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.pad}>
            {photos.length ? <PhotoGallery photos={photos} closeLabel={t(lang, 'closePanel')} /> : <Text testID="project-no-photos" style={{ color: colors.muted }}>{T.noPhotos}</Text>}
            {d.canEdit ? <ProjectGallery projectId={id} images={d.images ?? []} lang={lang} onChanged={() => { void qc.invalidateQueries({ queryKey: ['project', id] }); }} /> : null}
            <Card>
              <Text style={[styles.h, { color: colors.text }]}>{lang === 'en' ? str(p.name_en) || str(p.name) : str(p.name)}</Text>
              {p.status ? <Text style={{ color: colors.primaryInk, fontWeight: '700' }}>{STATUS_TEXT[str(p.status)]?.[lang] ?? str(p.status)}</Text> : null}
              <Fact label={T.developer} value={d.developer ? str(d.developer.name) : null} />
              <Fact label={T.place} value={str(p.district) || null} />
              <Fact label={T.governorate} value={str(p.city) || null} />
            </Card>
            <Card testID="project-facts">
              <Text style={[styles.h, { color: colors.text }]}>{T.facts}</Text>
              <Fact label={T.priceFrom} value={moneyShort(p.price_from, lang)} />
              <Fact label={T.size} value={size} />
              <Fact label={T.bedrooms} value={beds.length ? beds.join(' · ') : null} />
              <Fact label={T.lowestDown} value={has(p.down_pct_min) ? `${Number(p.down_pct_min)}%` : null} />
              <Fact label={T.longestTerm} value={has(p.years_max) ? `${Number(p.years_max)} ${T.years}` : null} />
              <Fact label={T.discount} value={has(p.discount_pct) ? `${Number(p.discount_pct)}%` : null} />
              <Fact label={T.maintenance} value={has(p.maintenance_pct) ? `${Number(p.maintenance_pct)}%` : null} />
              <Fact label={T.deliveryAsWritten} value={delivery} />
              {facts.map((f, i) => <Fact key={i} label={str(lang === 'en' ? f.label_en || f.label_ar : f.label_ar || f.label_en)} value={str(f.value) || null} />)}
              {feats.length || other.length ? (
                <View style={styles.chips}>
                  {feats.map((k) => <View key={k} style={[styles.chip, { borderColor: colors.primary, backgroundColor: colors.primary + '22' }]}><Text style={{ color: colors.text }}>{featureChip(k, lang).label}</Text></View>)}
                  {other.map((o) => <View key={o} style={[styles.chip, { borderColor: colors.border }]}><Text style={{ color: colors.muted }}>{o}</Text></View>)}
                </View>
              ) : null}
            </Card>
            {p.notes ? <Card><Text style={[styles.h, { color: colors.text }]}>{T.notes}</Text><Text style={{ color: colors.text }}>{str(p.notes)}</Text></Card> : null}
            {d.plans.length ? <Card><Text style={[styles.h, { color: colors.text }]}>{T.payPlans}</Text>{d.plans.map((pl) => <Text key={str(pl.id)} style={{ color: colors.text }}>{str(pl.name)} · {str(pl.down_payment_pct)}% · {str(pl.years)} {T.years}</Text>)}</Card> : null}
            {d.materials.length ? <Card><Text style={[styles.h, { color: colors.text }]}>{T.files}</Text>{d.materials.map((m) => <Text key={str(m.id)} style={{ color: colors.text }}>{str(m.title ?? m.name)}</Text>)}</Card> : null}
            <Card><Text style={[styles.h, { color: colors.text }]}>{T.projectUnits} ({d.units.length})</Text>{d.units.map((u) => (
              <Pressable key={str(u.id)} accessibilityRole="button" onPress={() => nav.navigate('Unit', { code: str(u.code) })}><Text style={{ color: colors.primaryInk }}>{str(u.code)} · {num(u.price_value)} · {str(u.status)}</Text></Pressable>
            ))}</Card>
            {d.canEdit ? <Button testID="project-edit" label={T.editProject} onPress={() => nav.navigate('ProjectForm', { id })} /> : null}
            {d.canEdit ? <Button testID="project-archive" variant="secondary" label={T.archive} onPress={() => archive(true)} /> : null}
          </ScrollView>
        );
      }}
    </Gate>
  );
}

const styles = StyleSheet.create({
  pad: { padding: spacing.lg, gap: spacing.md },
  gap: { gap: spacing.md },
  filters: { gap: spacing.sm },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  h: { fontSize: 17, fontWeight: '800' },
  fact: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, minHeight: 28, alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 6 },
});
