import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text } from './AppText';
import { formatEgp } from '@wehdathub/shared';
import type { ApiUnitListItem, Lang } from '@wehdathub/shared';
import { t } from '../i18n';
import { ALL_TYPES, FINISHING, labelOf } from '../unitOptions';
import { Icon } from './Icon';
import { SmartImage } from './SmartImage';
import { Chip } from './Chip';
import { spacing, useTheme } from '../theme';

/** The height and width of the photo thumbnail: square 96px, so rows in inventory lists read compactly. */
export const UNIT_PHOTO_HEIGHT = 96;

/**
 * A unit in a list: compact horizontal row with a 96px leading thumbnail, mini status badge,
 * property type chip, title, place, clean horizontal specs line, and prominent EGP price.
 */
export const UnitCard = memo(function UnitCardRow({ unit, lang, onPress }: { unit: ApiUnitListItem; lang: Lang; onPress: (code: string) => void }) {
  const { colors, elev } = useTheme();
  const arabic = lang === 'ar';
  const facts = [unit.bedrooms !== null ? `${unit.bedrooms} ${t(lang, 'beds')}` : null, unit.bathrooms !== null ? `${unit.bathrooms} ${t(lang, 'baths')}` : null, unit.area !== null ? `${Math.round(unit.area)} ${t(lang, 'sqm')}` : null].filter((x): x is string => Boolean(x));
  const place = [unit.district, unit.city].filter(Boolean).join(' · ');
  // The compound and its phase on the title: "Madinaty · B10". A part equal to another (or to the code) is shown once.
  const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const parts = [unit.compound, lang === 'en' ? unit.phaseEn : unit.phase].filter((x): x is string => Boolean(x)).filter((x, i, all) => all.findIndex((y) => sameText(y, x)) === i);
  const name = unit.compound ? parts.join(' · ') : unit.code;
  const showCode = Boolean(unit.compound) && !parts.some((x) => sameText(x, unit.code));
  const chip = { style: styles.chip, textStyle: styles.chipText };
  const badgeStyle = [styles.chip, !arabic && { backgroundColor: colors.card }];
  const deal = unit.dealType === 'sale' || unit.dealType === 'rent' ? (
    <Chip {...chip} style={badgeStyle} testID={`deal-${unit.code}`} label={t(lang, unit.dealType)} />
  ) : null;
  const mine = unit.mine ? (
    <Chip {...chip} style={badgeStyle} testID={`owner-${unit.code}`} label={t(lang, 'mine')} />
  ) : null;

  return (
    <Pressable accessibilityRole="button" onPress={() => onPress(unit.code)} style={({ pressed }) => [styles.card, elev(pressed ? 'md' : 'sm'), { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.95 : 1 }]}>
      <View style={[styles.contentRow, arabic && styles.arabicRow]}>
        <View testID={unit.photo ? undefined : `no-photo-${unit.code}`} style={[styles.photoWrap, !unit.photo && [styles.none, { backgroundColor: colors.bg }]]}>
          {unit.photo
            ? <SmartImage key={unit.photo} uri={unit.photo} style={styles.photo} />
            : <Icon name="units" color={colors.muted} size={28} />}
          {!arabic && deal ? <View style={styles.overTop}>{deal}</View> : null}
          {!arabic && mine ? <View style={styles.overBottom}>{mine}</View> : null}
        </View>
        <View style={styles.info}>
          <View style={styles.metaRow}>
            {unit.propertyType ? (
              <Chip {...chip} testID={`type-${unit.code}`} label={labelOf(ALL_TYPES, unit.propertyType, lang) ?? ''} />
            ) : null}
            {unit.finishing ? (
              <Chip {...chip} testID={`finishing-${unit.code}`} label={labelOf(FINISHING, unit.finishing, lang) ?? ''} />
            ) : null}
            {showCode ? (
              <Chip {...chip} testID={`code-${unit.code}`} label={unit.code} />
            ) : null}
          </View>
          <Text testID={`title-${unit.code}`} style={[styles.title, { color: colors.text }]} numberOfLines={1}>{name}</Text>
          {place ? <Text testID={`place-${unit.code}`} style={[styles.place, { color: colors.muted }]} numberOfLines={1}>{place}</Text> : null}
          {facts.length ? (
            <View style={styles.specsRow}>
              <Text style={[styles.specsText, { color: colors.muted }]}>{facts.join('  ·  ')}</Text>
            </View>
          ) : null}
          {unit.price !== null ? (
            <View style={styles.priceRow}>
              <Text style={[styles.price, { color: colors.text }]}>{formatEgp(unit.price)}</Text>
              <Text style={[styles.currency, { color: colors.primary }]}>{t(lang, 'egp')}</Text>
            </View>
          ) : null}
        </View>
        {arabic && (deal || mine) ? (
          <View testID={`badges-${unit.code}`} style={styles.badgeColumn}>
            {deal}
            {mine ? <View style={styles.ownerBadge}>{mine}</View> : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginHorizontal: spacing.lg, marginBottom: 10 },
  contentRow: { flexDirection: 'row', padding: 8, gap: 10, alignItems: 'center' },
  arabicRow: { direction: 'rtl' },
  photoWrap: { direction: 'ltr', width: UNIT_PHOTO_HEIGHT, height: UNIT_PHOTO_HEIGHT, borderRadius: 10, overflow: 'hidden', position: 'relative', flexShrink: 0 },
  photo: { width: '100%', height: '100%' },
  none: { alignItems: 'center', justifyContent: 'center' },
  overTop: { position: 'absolute', top: 5, start: 5 },
  overBottom: { position: 'absolute', bottom: 5, end: 5 },
  badgeColumn: { direction: 'ltr', alignSelf: 'stretch', alignItems: 'flex-start', gap: spacing.sm },
  ownerBadge: { marginTop: 'auto' },
  info: { flex: 1, minWidth: 0, minHeight: UNIT_PHOTO_HEIGHT, justifyContent: 'space-between', paddingVertical: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 6, paddingVertical: 1 },
  chipText: { fontSize: 11, fontWeight: '800' },
  title: { fontSize: 14, fontWeight: '800', lineHeight: 18 },
  place: { fontSize: 12 },
  specsRow: { flexDirection: 'row', alignItems: 'center' },
  specsText: { fontSize: 11.5, fontWeight: '600' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  price: { fontSize: 15, fontWeight: '900' },
  currency: { fontSize: 11, fontWeight: '700' },
});
