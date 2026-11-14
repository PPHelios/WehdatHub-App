import React, { useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { formatEgp } from '@wehdathub/shared';
import { api } from '../api';
import { currentLang } from '../auth';
import { t } from '../i18n';
import { radius, spacing, useTheme } from '../theme';
import { Button } from './Button';
import { Chips } from './Chips';

/** Ask's project results: offers grouped by project, a chip per filter that can be dropped, a sort, and pages. */
export function AskResults({ q }: { q: string }) {
  const { colors } = useTheme();
  const lang = currentLang();
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<'best' | 'cheap'>('best');
  const [drop, setDrop] = useState<string[]>([]);
  const r = useQuery({ queryKey: ['askResults', q, page, sort, drop.join(',')], queryFn: () => api.askResults(q, page, sort, drop) });
  if (!r.data || (!r.data.projects.length && !drop.length)) return null;
  const d = r.data;
  return (
    <View testID="ask-results" style={styles.wrap}>
      <Text style={[styles.title, { color: colors.text }]}>{t(lang, 'askResultsTitle')}: {d.total_projects} {t(lang, 'totalProjects')} · {d.total_offers} {t(lang, 'totalOffers')}</Text>
      <View style={styles.chips}>
        {d.chips.map((c) => (
          <Pressable key={c.key} testID={`ask-chip-${c.key}`} accessibilityRole="button" onPress={() => { setDrop([...drop, c.key]); setPage(1); }} style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Text style={{ color: colors.text }}>{c.value} ✕</Text>
          </Pressable>
        ))}
      </View>
      <Chips<'best' | 'cheap'> testID="ask-sort" value={sort} options={[{ value: 'best', label: t(lang, 'sortBest') }, { value: 'cheap', label: t(lang, 'sortCheap') }]} onChange={(v) => { setSort(v); setPage(1); }} />
      {d.projects.map((p) => (
        <View key={p.name} testID="ask-project" style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>{lang === 'en' && p.name_en ? p.name_en : p.name}{p.place ? ` · ${p.place}` : ''}</Text>
          {p.offers.map((o, i) => (
            <Text key={i} style={{ color: colors.text }}>{[`${o.area} m²`, o.floor !== null && o.floor !== undefined && o.floor !== '' ? String(o.floor) : null, `${formatEgp(o.price)} ${t(lang, 'egp')}`, o.down ? `↓ ${formatEgp(o.down)}` : null, o.monthly ? `${formatEgp(o.monthly)}/${lang === 'ar' ? 'شهر' : 'mo'}` : null].filter(Boolean).join(' · ')}</Text>
          ))}
          <Button variant="secondary" label={t(lang, 'copyAnswer')} onPress={() => { Share.share({ message: p.client_text }).catch(() => undefined); }} />
        </View>
      ))}
      {d.pages > 1 ? (
        <View style={styles.chips}>
          <View style={styles.flex}><Button testID="ask-prev" variant="secondary" label={t(lang, 'prevPage')} disabled={d.page <= 1} onPress={() => setPage(d.page - 1)} /></View>
          <View style={styles.flex}><Button testID="ask-next" variant="secondary" label={t(lang, 'nextPage')} disabled={d.page >= d.pages} onPress={() => setPage(d.page + 1)} /></View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  title: { fontSize: 16, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  card: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  flex: { flex: 1 },
});
