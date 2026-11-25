import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { formatEgp } from '@wehdathub/shared';
import type { ApiUnitListItem, Lang } from '@wehdathub/shared';
import { t } from '../i18n';
import { ALL_TYPES, FINISHING, labelOf } from '../unitOptions';
import { radius, spacing, useTheme } from '../theme';
import { AppText as Text } from './AppText';
import { Chevron, Icon } from './Icon';
import { Pill } from './Pill';
import { SmartImage } from './SmartImage';

/** Square 96px leading thumbnail so inventory lists stay compact and uniform across cards. */
export const UNIT_PHOTO_HEIGHT = 96;

/**
 * Inventory card styled identically to LeadCard, SectionCard & ProjectCardView:
 * `radius.card`, `spacing.md`, `Pill` hierarchy, readable `primaryInk` price, and leading thumbnail.
 */
export const UnitCard = memo(function UnitCardRow({ unit, lang, onPress }: { unit: ApiUnitListItem; lang: Lang; onPress: (code: string) => void }) {
  const { colors, elev } = useTheme();
  const ar = lang === 'ar';
  const facts = [
    unit.bedrooms !== null ? `${unit.bedrooms} ${t(lang, 'beds')}` : null,
    unit.bathrooms !== null ? `${unit.bathrooms} ${t(lang, 'baths')}` : null,
    unit.area !== null ? `${Math.round(unit.area)} ${t(lang, 'sqm')}` : null,
  ].filter((x): x is string => Boolean(x));
  const place = [unit.district, unit.city].filter(Boolean).join(' · ');
  const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const parts = [unit.compound, lang === 'en' ? unit.phaseEn : unit.phase]
    .filter((x): x is string => Boolean(x))
    .filter((x, i, all) => all.findIndex((y) => sameText(y, x)) === i);
  const name = unit.compound ? parts.join(' · ') : unit.code;
  const showCode = Boolean(unit.compound) && !parts.some((x) => sameText(x, unit.code));

  return (
    <Pressable
      testID={`unit-card-${unit.code}`}
      accessibilityRole="button"
      onPress={() => onPress(unit.code)}
      style={({ pressed }) => [
        styles.card,
        elev(pressed ? 'md' : 'sm'),
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.88 : 1 },
      ]}
    >
      <View
        testID={unit.photo ? undefined : `no-photo-${unit.code}`}
        style={[styles.photoWrap, { backgroundColor: colors.cardSubtle, borderColor: colors.border }, !unit.photo && styles.none]}
      >
        {unit.photo
          ? <SmartImage key={unit.photo} uri={unit.photo} style={styles.photo} />
          : <Icon name="units" color={colors.muted} size={28} />}
        {unit.dealType === 'sale' || unit.dealType === 'rent' ? (
          <View style={styles.overTop}>
            <Pill solid tone="primary" testID={`deal-${unit.code}`} label={t(lang, unit.dealType)} />
          </View>
        ) : null}
        {unit.mine ? (
          <View style={styles.overBottom}>
            <Pill solid tone="accent" testID={`owner-${unit.code}`} label={t(lang, 'mine')} />
          </View>
        ) : null}
      </View>

      <View style={styles.content}>
        <Text testID={`title-${unit.code}`} style={[styles.title, { color: colors.text }]} numberOfLines={1}>{name}</Text>
        {place ? <Text testID={`place-${unit.code}`} style={[styles.caption, { color: colors.muted }]} numberOfLines={1}>{place}</Text> : null}

        {(unit.propertyType || showCode || unit.finishing) ? (
          <View style={styles.chips}>
            {unit.propertyType ? <Pill tone="primary" testID={`type-${unit.code}`} label={labelOf(ALL_TYPES, unit.propertyType, lang) ?? ''} /> : null}
            {showCode ? <Pill testID={`code-${unit.code}`} label={unit.code} /> : null}
            {unit.finishing ? <Pill tone="accent" testID={`finishing-${unit.code}`} label={labelOf(FINISHING, unit.finishing, lang) ?? ''} /> : null}
          </View>
        ) : null}

        {facts.length ? <Text style={[styles.specs, { color: colors.muted }]} numberOfLines={1}>{facts.join(' · ')}</Text> : null}

        {unit.price !== null ? (
          <Text testID={`price-${unit.code}`} style={[styles.price, { color: colors.primaryInk }]}>
            {`${formatEgp(unit.price)} ${t(lang, 'egp')}`}
          </Text>
        ) : null}
      </View>

      <Chevron rtl={ar} color={colors.muted} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.card,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  photoWrap: {
    width: UNIT_PHOTO_HEIGHT,
    height: UNIT_PHOTO_HEIGHT,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    flexShrink: 0,
  },
  photo: { width: '100%', height: '100%' },
  none: { alignItems: 'center', justifyContent: 'center' },
  overTop: { position: 'absolute', top: spacing.xs, start: spacing.xs },
  overBottom: { position: 'absolute', bottom: spacing.xs, end: spacing.xs },
  content: { flex: 1, minWidth: 0, gap: spacing.xs },
  title: { fontSize: 16, fontWeight: '800' },
  caption: { fontSize: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  specs: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  price: { fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
