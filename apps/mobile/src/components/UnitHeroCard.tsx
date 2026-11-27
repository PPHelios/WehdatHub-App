import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { ApiUnitListItem, Lang } from '@wehdathub/shared';
import { t } from '../i18n';
import { radius, spacing, useTheme } from '../theme';
import { AppText as Text } from './AppText';
import { Icon } from './Icon';
import { Pill } from './Pill';
import { PressableScale } from './PressableScale';
import { SmartImage } from './SmartImage';
import { PriceLine, UpdateLabel, updateInfo } from './UnitCard';

export const HERO_CARD_WIDTH = 290;

/** Big assistant-carousel card: 16:10 photo, price (+ per m²), name, place, facts, all "why" chips, last update and the share action. */
export function UnitHeroCard({ unit, lang, onPress, onShare, onSave, reasons, photoCount }: {
  unit: ApiUnitListItem;
  lang: Lang;
  onPress: (code: string) => void;
  onShare?: (code: string) => void;
  onSave?: (code: string) => void;
  reasons?: string[];
  /** Photos in the unit when the caller knows (the list item carries only the cover). */
  photoCount?: number;
}) {
  const { colors, elev } = useTheme();
  const name = unit.compound ?? unit.code;
  const place = [unit.district, unit.city].filter(Boolean).join(' · ');
  const perSqm = unit.price !== null && unit.area ? Math.round(unit.price / unit.area).toLocaleString('en-US') : null;
  const facts = [
    unit.bedrooms !== null ? { icon: 'bed' as const, text: String(unit.bedrooms) } : null,
    unit.bathrooms !== null ? { icon: 'bath' as const, text: String(unit.bathrooms) } : null,
    unit.area !== null ? { icon: 'area' as const, text: `${Math.round(unit.area)} ${t(lang, 'sqm')}` } : null,
  ].filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <PressableScale testID={`unit-hero-${unit.code}`} onPress={() => onPress(unit.code)} style={[styles.card, elev('md'), { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.clip}>
        <View testID={unit.photo ? undefined : `no-photo-${unit.code}`} style={[styles.photoWrap, { backgroundColor: unit.photo ? colors.cardSubtle : colors.primarySoft }]}>
          {unit.photo ? <SmartImage key={unit.photo} uri={unit.photo} style={styles.photo} /> : (
            <View style={styles.none}>
              <Icon name="units" color={colors.primaryInk} size={32} />
              <Text variant="caption" style={{ color: colors.primaryInk }}>{t(lang, 'noPhotoYet')}</Text>
            </View>
          )}
          {unit.dealType === 'sale' || unit.dealType === 'rent' ? <View style={styles.overTop}><Pill solid tone="primary" testID={`deal-${unit.code}`} label={t(lang, unit.dealType)} /></View> : null}
          {photoCount ? <View testID={`photo-count-${unit.code}`} style={styles.overBottom}><Pill solid tone="accent" label={`${photoCount} ${t(lang, 'photos')}`} /></View> : null}
        </View>

        <View style={styles.body}>
          <View style={styles.priceRow}>
            <PriceLine unit={unit} lang={lang} big />
            {perSqm ? <Text testID={`per-sqm-${unit.code}`} variant="caption" style={{ color: colors.muted }}>{t(lang, 'perSqm').replace('{p}', perSqm)}</Text> : null}
          </View>
          <Text testID={`title-${unit.code}`} variant="body" weight="bold" style={{ color: colors.text }} numberOfLines={2}>{name}</Text>
          {place ? <Text testID={`place-${unit.code}`} variant="caption" style={{ color: colors.muted }} numberOfLines={1}>{place}</Text> : null}
          {facts.length ? (
            <View style={styles.facts}>
              {facts.map((f) => (
                <View key={f.icon} style={styles.fact}>
                  <Icon name={f.icon} color={colors.muted} size={16} />
                  <Text variant="bodySm" style={{ color: colors.text }}>{f.text}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {reasons?.length || updateInfo(unit, lang) ? (
            <View style={styles.chips}>
              {(reasons ?? []).map((r) => <Pill key={r} tone="primary" label={r} />)}
              <UpdateLabel unit={unit} lang={lang} />
            </View>
          ) : null}
          {onShare || onSave ? (
            <View style={styles.actions}>
              {onShare ? (
                <PressableScale testID={`share-${unit.code}`} onPress={() => onShare(unit.code)} style={[styles.primary, { backgroundColor: colors.primary }]}>
                  <Icon name="send" color={colors.onPrimary} size={16} />
                  <Text variant="bodySm" weight="bold" style={{ color: colors.onPrimary }}>{t(lang, 'sendClient')}</Text>
                </PressableScale>
              ) : null}
              {onSave ? (
                <PressableScale testID={`save-${unit.code}`} accessibilityLabel={t(lang, 'saveUnitA11y')} onPress={() => onSave(unit.code)} style={[styles.icon, { borderColor: colors.border }]}>
                  <Icon name="bookmark" color={colors.text} size={20} />
                </PressableScale>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { width: HERO_CARD_WIDTH, borderWidth: 1, borderRadius: radius.card },
  clip: { borderRadius: radius.card, overflow: 'hidden' },
  photoWrap: { width: '100%', aspectRatio: 16 / 10, position: 'relative', overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  none: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  overTop: { position: 'absolute', top: spacing.sm, start: spacing.sm },
  overBottom: { position: 'absolute', bottom: spacing.sm, end: spacing.sm },
  body: { padding: spacing.md, gap: spacing.xs },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: spacing.sm },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  fact: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  primary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, minHeight: 44, borderRadius: radius.md },
  icon: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: radius.md },
});
