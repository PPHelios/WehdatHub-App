import React from 'react';
import { Linking, Pressable, Share, StyleSheet, View } from 'react-native';
import { AppText as Text } from './AppText';
import { formatEgp } from '@wehdathub/shared';
import type { AskOffer, Lang, ProjectCard } from '@wehdathub/shared';
import { deliveryOf, developerOf, factPills, pageWindow, placeOf, projectName, STATUS_TEXT } from '../projectRules';
import { fill, pt } from '../projectText';
import { radius, spacing, useTheme } from '../theme';
import { Pill } from './Pill';
import { SmartImage } from './SmartImage';

// One list of project cards for the catalogue and for Ask's results (the website's catalogueList.js projectCard): cover, name, developer,
// place and governorate, fact pills, delivery, status, counts; and when the card comes from Ask, its offers or the notes that fit.

/** Opens WhatsApp with the text; the share sheet when WhatsApp cannot be opened. */
export async function sendOnWhatsApp(message: string): Promise<void> {
  try {
    await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(message)}`);
  } catch {
    await Share.share({ message }).catch(() => undefined);
  }
}

export const offerLine = (o: AskOffer, lang: Lang): string => [
  o.type || null,
  o.area ? `${o.area} m²` : null,
  o.floor !== null && o.floor !== undefined && o.floor !== '' ? String(o.floor) : null,
  o.bedrooms ? `${o.bedrooms} ${lang === 'ar' ? 'غرف' : 'bed'}` : null,
  o.price ? `${formatEgp(o.price)} ${lang === 'ar' ? 'ج.م' : 'EGP'}` : null,
  o.down ? `↓ ${formatEgp(o.down)}` : null,
  o.monthly ? `${formatEgp(o.monthly)}/${lang === 'ar' ? 'شهر' : 'mo'}` : null,
  o.years ? `${o.years} ${lang === 'ar' ? 'سنين' : 'yrs'}` : null,
  o.discount_pct ? `-${o.discount_pct}%` : null,
].filter(Boolean).join(' · ');

export function ProjectCardView({ p, lang, onOpen, onSend }: { p: ProjectCard; lang: Lang; onOpen?: () => void; onSend?: () => void }) {
  const { colors, elev } = useTheme();
  const T = pt(lang);
  const pills = factPills(p, lang);
  const dev = developerOf(p, lang);
  const place = placeOf(p);
  const delivery = deliveryOf(p);
  const status = p.status ? STATUS_TEXT[p.status]?.[lang] ?? p.status : null;
  const offers = p.offers ?? [];
  const more = (p.offers_total ?? offers.length) - offers.length;
  return (
    <View testID="project-card" style={[styles.card, elev('md'), { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={projectName(p, lang)} onPress={onOpen} disabled={!onOpen} style={styles.top} testID={p.id ? `project-${p.id}` : undefined}>
        <View style={[styles.cover, { backgroundColor: colors.border }]}>
          {p.cover_url ? <SmartImage uri={p.cover_url} style={styles.coverImg} /> : null}
          {status ? <View style={styles.badge}><Pill solid tone="primary" label={status} /></View> : null}
        </View>
        <View style={styles.body}>
          <Text style={[styles.name, { color: colors.text }]}>{projectName(p, lang)}</Text>
          <Text style={{ color: colors.muted }}>{[dev, place].filter(Boolean).join(' · ') || '—'}</Text>
          {pills.length ? (
            <View style={styles.pills}>{pills.map((f) => <Pill key={f} label={f} />)}</View>
          ) : null}
          {p.matched?.length ? <Text testID="project-matched" style={{ color: colors.primaryInk, fontSize: 13 }}>{T.matches}: {p.matched.map((k) => (T as Record<string, string>)[`m_${k}`] ?? k).join('، ')}</Text> : null}
          {delivery ? <Text style={{ color: colors.muted, fontSize: 13 }}>{T.delivery}: {delivery}</Text> : null}
          {p.units !== undefined || p.plans !== undefined ? <Text style={{ color: colors.muted, fontSize: 13 }}>{p.units ?? 0} {T.units} · {p.plans ?? 0} {T.plans}</Text> : null}
        </View>
      </Pressable>
      {offers.length ? (
        <View style={styles.offers} testID="project-offers">
          {offers.map((o, i) => <Text key={i} style={{ color: colors.text }}>{offerLine(o, lang)}</Text>)}
          {more > 0 ? <Text style={{ color: colors.muted }}>{fill(T.moreOffers, { n: String(more) })}</Text> : null}
        </View>
      ) : p.free_text ? (
        <View style={styles.offers} testID="project-free-text">
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>{T.freeText}</Text>
          <Text style={{ color: colors.text }}>{p.free_text}</Text>
        </View>
      ) : null}
      {p.client_text ? (
        <Pressable testID="project-whatsapp" accessibilityRole="button" onPress={() => { onSend?.(); void sendOnWhatsApp(p.client_text as string); }} style={({ pressed }) => [styles.send, { borderColor: pressed ? '#1EBE5A' : '#25D366', backgroundColor: pressed ? '#1EBE5A' : '#25D366' }]}>
          <Text style={{ color: '#06260F', fontWeight: '700' }}>{T.whatsapp}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** "N projects · M options" (options only when the list knows them). */
export function Count({ projects, options, lang }: { projects: number; options?: number; lang: Lang }) {
  const { colors } = useTheme();
  const T = pt(lang);
  return <Text testID="project-count" style={[styles.count, { color: colors.text }]}>{projects} {T.projectsCount}{options !== undefined ? ` · ${options} ${T.optionsCount}` : ''}</Text>;
}

/** Previous, the first, the last and the current page ±2, next. */
export function Pager({ page, pages, onPage, lang }: { page: number; pages: number; onPage: (n: number) => void; lang: Lang }) {
  const { colors } = useTheme();
  const T = pt(lang);
  if (pages <= 1) return null;
  const btn = (key: string, label: string, to: number, on = false, disabled = false) => (
    <Pressable key={key} testID={`page-${key}`} accessibilityRole="button" accessibilityState={{ selected: on, disabled }} disabled={disabled || on} onPress={() => onPage(to)} style={[styles.pageBtn, { borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primary : colors.card, opacity: disabled ? 0.4 : 1 }]}>
      <Text style={{ color: on ? colors.onPrimary : colors.text, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
  return (
    <View testID="pager" style={styles.pager}>
      {btn('prev', T.prev, page - 1, false, page <= 1)}
      {pageWindow(page, pages).map((n, i) => (n === null ? <Text key={`gap${i}`} style={{ color: colors.muted }}>…</Text> : btn(String(n), String(n), n, n === page)))}
      {btn('next', T.next, page + 1, false, page >= pages)}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.card, overflow: 'hidden' },
  top: { gap: 0 },
  cover: { height: 150, justifyContent: 'flex-start', alignItems: 'flex-start' },
  coverImg: { ...StyleSheet.absoluteFill },
  badge: { margin: spacing.sm },
  body: { padding: spacing.md, gap: spacing.xs },
  name: { fontSize: 17, fontWeight: '800' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  offers: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.xs },
  send: { margin: spacing.md, marginTop: 0, minHeight: 44, borderWidth: 1, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  count: { fontSize: 16, fontWeight: '800' },
  pager: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  pageBtn: { minHeight: 44, minWidth: 44, paddingHorizontal: spacing.md, borderWidth: 1, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
