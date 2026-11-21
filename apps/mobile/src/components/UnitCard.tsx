import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text } from './AppText';
import { formatEgp } from '@wehdathub/shared';
import type { ApiUnitListItem, Lang } from '@wehdathub/shared';
import { t } from '../i18n';
import { ALL_TYPES, FINISHING, labelOf } from '../unitOptions';
import { Icon } from './Icon';
import { Pill } from './Pill';
import { SmartImage } from './SmartImage';
import { radius, spacing, useTheme } from '../theme';

/** The height of the photo area: the same on every card, so a list reads as even rows. */
export const UNIT_PHOTO_HEIGHT = 180;

/**
 * A unit in a list: the photo with its status on it, the compound and code, the price, the facts as pills. The same card language as the
 * project cards (Pill, 16 px corners, the same spacing).
 */
export const UnitCard = memo(function UnitCard({ unit, lang, onPress, onEdit }: { unit: ApiUnitListItem; lang: Lang; onPress: (code: string) => void; onEdit?: (code: string) => void }) {
  const { colors, elev } = useTheme();
  const facts = [unit.bedrooms !== null ? `${unit.bedrooms} ${t(lang, 'beds')}` : null, unit.bathrooms !== null ? `${unit.bathrooms} ${t(lang, 'baths')}` : null, unit.area !== null ? `${Math.round(unit.area)} ${t(lang, 'sqm')}` : null].filter((x): x is string => Boolean(x));
  const place = [unit.district, unit.city].filter(Boolean).join(' · ');
  // The compound and its phase on the title: "Madinaty · B10". A part equal to another (or to the code) is shown once.
  const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const parts = [unit.compound, lang === 'en' ? unit.phaseEn : unit.phase].filter((x): x is string => Boolean(x)).filter((x, i, all) => all.findIndex((y) => sameText(y, x)) === i);
  const name = unit.compound ? parts.join(' · ') : unit.code;
  const showCode = Boolean(unit.compound) && !parts.some((x) => sameText(x, unit.code));
  const deal = unit.dealType === 'sale' || unit.dealType === 'rent' ? <Pill testID={`deal-${unit.code}`} solid tone={unit.dealType === 'rent' ? 'accent' : 'primary'} label={t(lang, unit.dealType)} /> : null;
  const mine = unit.mine ? <Pill solid tone="accent" label={t(lang, 'mine')} /> : null;
  return (
    <Pressable accessibilityRole="button" onPress={() => onPress(unit.code)} style={({ pressed }) => [styles.card, elev(pressed ? 'lg' : 'md'), { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.95 : 1 }]}>
      {unit.photo ? (
        <View>
          <SmartImage key={unit.photo} uri={unit.photo} style={styles.photo} />
          <View style={styles.over}>{deal}{mine}</View>
        </View>
      ) : (
        // No photo yet: the same area, so cards in a list keep one height.
        <View testID={`no-photo-${unit.code}`} style={[styles.photo, styles.none, { backgroundColor: colors.bg }]}>
          <Icon name="units" color={colors.muted} size={32} />
          <View style={styles.over}>{deal}{mine}</View>
        </View>
      )}
      <View style={styles.info}>
        <View style={styles.row}>
          <Text testID={`title-${unit.code}`} style={[styles.title, { color: colors.text }]} numberOfLines={1}>{name}</Text>
          {showCode ? <Text style={[styles.code, { color: colors.muted }]}>{unit.code}</Text> : null}
        </View>
        {place ? <Text testID={`place-${unit.code}`} style={[styles.place, { color: colors.muted }]} numberOfLines={1}>{place}</Text> : null}
        {unit.price !== null ? <Text style={[styles.price, { color: colors.primaryInk }]}>{formatEgp(unit.price)} {t(lang, 'egp')}</Text> : null}
        {facts.length || unit.finishing || unit.propertyType ? <View style={styles.facts}>{unit.propertyType ? <Pill testID={`type-${unit.code}`} tone="primary" label={labelOf(ALL_TYPES, unit.propertyType, lang) ?? ''} /> : null}{facts.map((f) => <Pill key={f} label={f} />)}{unit.finishing ? <Pill testID={`finishing-${unit.code}`} tone="accent" label={labelOf(FINISHING, unit.finishing, lang) ?? ''} /> : null}</View> : null}
        {onEdit ? (
          <Pressable testID={`edit-${unit.code}`} accessibilityRole="button" accessibilityLabel={t(lang, 'editUnit')} hitSlop={8} onPress={() => onEdit(unit.code)} style={[styles.edit, { borderColor: colors.border }]}>
            <Icon name="edit" color={colors.primaryInk} size={16} />
            <Text style={{ color: colors.primaryInk, fontWeight: '700' }}>{t(lang, 'editUnit')}</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, borderWidth: 1, overflow: 'hidden', marginHorizontal: spacing.lg, marginBottom: spacing.md },
  photo: { height: UNIT_PHOTO_HEIGHT, width: '100%' },
  none: { alignItems: 'center', justifyContent: 'center' },
  place: { fontSize: 14 },
  over: { position: 'absolute', top: spacing.sm, start: spacing.sm, end: spacing.sm, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.xs },
  info: { padding: spacing.md, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  title: { flex: 1, minWidth: 0, fontSize: 17, fontWeight: '800' },
  code: { flexShrink: 0, fontSize: 13, fontWeight: '700' },
  price: { fontSize: 22, fontWeight: '800' },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  edit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, minHeight: 44, borderWidth: 1, borderRadius: radius.md },
});
