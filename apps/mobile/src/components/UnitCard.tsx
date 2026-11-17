import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatEgp } from '@wehdathub/shared';
import type { ApiUnitListItem, Lang } from '@wehdathub/shared';
import { t } from '../i18n';
import { Icon } from './Icon';
import { Pill } from './Pill';
import { SmartImage } from './SmartImage';
import { lift, radius, spacing, useTheme } from '../theme';

/** The height of the photo area: the same on every card, so a list reads as even rows. */
export const UNIT_PHOTO_HEIGHT = 180;

/**
 * A unit in a list: the photo with its status on it, the compound and code, the price, the facts as pills. The same card language as the
 * project cards (Pill, 16 px corners, the same spacing).
 */
export function UnitCard({ unit, lang, onPress, onEdit }: { unit: ApiUnitListItem; lang: Lang; onPress: () => void; onEdit?: () => void }) {
  const { colors } = useTheme();
  const facts = [unit.bedrooms !== null ? `${unit.bedrooms} ${t(lang, 'beds')}` : null, unit.bathrooms !== null ? `${unit.bathrooms} ${t(lang, 'baths')}` : null, unit.area !== null ? `${Math.round(unit.area)} ${t(lang, 'sqm')}` : null].filter((x): x is string => Boolean(x));
  const place = [unit.district, unit.city].filter(Boolean).join(' · ');
  const deal = unit.dealType === 'sale' || unit.dealType === 'rent' ? <Pill testID={`deal-${unit.code}`} solid tone={unit.dealType === 'rent' ? 'accent' : 'primary'} label={t(lang, unit.dealType)} /> : null;
  const mine = unit.mine ? <Pill solid tone="accent" label={t(lang, 'mine')} /> : null;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.92 : 1 }]}>
      {unit.photo ? (
        <View>
          <SmartImage uri={unit.photo} style={styles.photo} />
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
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{unit.compound ?? unit.code}</Text>
          {unit.compound ? <Text style={[styles.code, { color: colors.muted }]}>{unit.code}</Text> : null}
        </View>
        {place ? <Text testID={`place-${unit.code}`} style={[styles.place, { color: colors.muted }]} numberOfLines={1}>{place}</Text> : null}
        {unit.price !== null ? <Text style={[styles.price, { color: colors.primary }]}>{formatEgp(unit.price)} {t(lang, 'egp')}</Text> : null}
        {facts.length || unit.finishing ? <View style={styles.facts}>{facts.map((f) => <Pill key={f} label={f} />)}{unit.finishing ? <Pill testID={`finishing-${unit.code}`} tone="accent" label={unit.finishing} /> : null}</View> : null}
        {onEdit ? (
          <Pressable testID={`edit-${unit.code}`} accessibilityRole="button" accessibilityLabel={t(lang, 'editUnit')} hitSlop={8} onPress={onEdit} style={[styles.edit, { borderColor: colors.border }]}>
            <Icon name="edit" color={colors.primary} size={16} />
            <Text style={{ color: colors.primary, fontWeight: '700' }}>{t(lang, 'editUnit')}</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { ...lift, borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden', marginHorizontal: spacing.lg, marginBottom: spacing.md },
  photo: { height: UNIT_PHOTO_HEIGHT, width: '100%' },
  none: { alignItems: 'center', justifyContent: 'center' },
  place: { fontSize: 14 },
  over: { position: 'absolute', top: spacing.sm, start: spacing.sm, end: spacing.sm, flexDirection: 'row', justifyContent: 'space-between' },
  info: { padding: spacing.md, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm },
  title: { fontSize: 17, fontWeight: '800', flexShrink: 1 },
  code: { fontSize: 13, fontWeight: '700' },
  price: { fontSize: 22, fontWeight: '800' },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  edit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, minHeight: 44, borderWidth: 1, borderRadius: radius.md },
});
