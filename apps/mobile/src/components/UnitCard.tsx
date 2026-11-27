import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { formatEgp, formatUnitPrice } from '@wehdathub/shared';
import type { ApiUnit, ApiUnitListItem, Lang } from '@wehdathub/shared';
import { t } from '../i18n';
import { ALL_TYPES, FINISHING, labelOf } from '../unitOptions';
import { radius, spacing, useTheme } from '../theme';
import { AppText as Text } from './AppText';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';
import { Pill } from './Pill';
import { SmartImage } from './SmartImage';

/** Width of the full-height leading photo; the card's height follows its content. */
export const UNIT_PHOTO_WIDTH = 108;
const FRESH_DAYS = 14;

/** Price split into the number and its muted tail (currency, rent period), built from formatUnitPrice so USD/EUR stay right. */
export function splitPrice(unit: ApiUnit, lang: Lang): { amount: string; unitLabel: string } | null {
  const full = formatUnitPrice(unit.price, { currency: unit.currency, lang, dealType: unit.dealType, rentPeriod: unit.rentPeriod, fallbackText: unit.priceText });
  if (!full) return null;
  if (unit.price === null) return { amount: full, unitLabel: '' };
  const amount = formatEgp(unit.price);
  return { amount, unitLabel: full.slice(amount.length).trim() };
}

/** "2d ago" label and whether it is fresh, from `updatedAt`; null when the unit has none. */
export function updateInfo(unit: ApiUnit, lang: Lang, now = Date.now()): { label: string; fresh: boolean } | null {
  const ts = unit.updatedAt ? Date.parse(unit.updatedAt) : NaN;
  if (!Number.isFinite(ts)) return null;
  const days = Math.max(0, Math.floor((now - ts) / 86_400_000));
  const label = days === 0 ? t(lang, 'ago0') : days === 1 ? t(lang, 'ago1') : days === 2 ? t(lang, 'ago2') : t(lang, days <= 10 ? 'agoFew' : 'agoMany').replace('{n}', String(days));
  return { label, fresh: days <= FRESH_DAYS };
}

export function UpdateLabel({ unit, lang }: { unit: ApiUnit; lang: Lang }) {
  const { colors } = useTheme();
  const info = updateInfo(unit, lang);
  if (!info) return null;
  return (
    <View testID={`updated-${unit.code}`} style={styles.update}>
      <View style={[styles.dot, { backgroundColor: info.fresh ? colors.ok : colors.warn }]} />
      <Text variant="caption" style={{ color: colors.muted }}>{info.label}</Text>
    </View>
  );
}

export function PriceLine({ unit, lang, big }: { unit: ApiUnit; lang: Lang; big?: boolean }) {
  const { colors } = useTheme();
  const price = splitPrice(unit, lang);
  if (!price) return null;
  return (
    <Text testID={`price-${unit.code}`} variant={big ? 'title' : 'heading'} style={[styles.num, { color: colors.primaryInk }]}>
      {price.amount}
      {price.unitLabel ? <Text variant="caption" weight="regular" style={{ color: colors.muted }}>{` ${price.unitLabel}`}</Text> : null}
    </Text>
  );
}

/**
 * Inventory card: a full-height photo at the start edge (deal pill top, "Mine" pill bottom), then price,
 * title (2 lines), place, facts and a "why it matches" / last-update row.
 */
export const UnitCard = memo(function UnitCardRow({ unit, lang, onPress, reasons }: { unit: ApiUnitListItem; lang: Lang; onPress: (code: string) => void; reasons?: string[] }) {
  const { colors, elev } = useTheme();
  const place = [unit.district, unit.city].filter(Boolean).join(' · ');
  const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const parts = [unit.compound, lang === 'en' ? unit.phaseEn : unit.phase]
    .filter((x): x is string => Boolean(x))
    .filter((x, i, all) => all.findIndex((y) => sameText(y, x)) === i);
  const name = unit.compound ? parts.join(' · ') : unit.code;
  const showCode = Boolean(unit.compound) && !parts.some((x) => sameText(x, unit.code));
  const typeLabel = unit.propertyType ? labelOf(ALL_TYPES, unit.propertyType, lang) : null;
  const finishingLabel = unit.finishing ? labelOf(FINISHING, unit.finishing, lang) : null;
  const facts: { text: string; testID?: string }[] = [
    typeLabel ? { text: typeLabel, testID: `type-${unit.code}` } : null,
    unit.bedrooms !== null ? { text: `${unit.bedrooms} ${t(lang, 'beds')}` } : null,
    unit.bathrooms !== null ? { text: `${unit.bathrooms} ${t(lang, 'baths')}` } : null,
    unit.area !== null ? { text: `${Math.round(unit.area)} ${t(lang, 'sqm')}` } : null,
    finishingLabel ? { text: finishingLabel, testID: `finishing-${unit.code}` } : null,
  ].filter((x): x is { text: string; testID?: string } => x !== null);
  const shown = (reasons ?? []).slice(0, 2);

  return (
    <PressableScale
      testID={`unit-card-${unit.code}`}
      onPress={() => onPress(unit.code)}
      style={[styles.card, elev('sm'), { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={styles.row}>
        <View testID={unit.photo ? undefined : `no-photo-${unit.code}`} style={[styles.photoWrap, { backgroundColor: unit.photo ? colors.cardSubtle : colors.primarySoft }]}>
          {unit.photo
            ? <SmartImage key={unit.photo} uri={unit.photo} style={styles.photo} />
            : (
              <View style={styles.none}>
                <Icon name="units" color={colors.primaryInk} size={28} />
                <Text variant="micro" style={[styles.noText, { color: colors.primaryInk }]}>{t(lang, 'noPhotoYet')}</Text>
              </View>
            )}
          {unit.dealType === 'sale' || unit.dealType === 'rent' ? (
            <View style={styles.overTop}><Pill solid tone="primary" testID={`deal-${unit.code}`} label={t(lang, unit.dealType)} /></View>
          ) : null}
          {unit.mine ? (
            <View style={styles.overBottom}><Pill solid tone="accent" testID={`owner-${unit.code}`} label={t(lang, 'mine')} /></View>
          ) : null}
        </View>

        <View style={styles.content}>
          <PriceLine unit={unit} lang={lang} />
          <Text testID={`title-${unit.code}`} variant="bodySm" weight="bold" style={{ color: colors.text }} numberOfLines={2}>{name}</Text>
          {place || showCode ? (
            <View style={styles.placeRow}>
              {place ? <Text testID={`place-${unit.code}`} variant="caption" style={[styles.flex, { color: colors.muted }]} numberOfLines={1}>{place}</Text> : null}
              {showCode ? <Text testID={`code-${unit.code}`} variant="caption" style={{ color: colors.muted }}>{unit.code}</Text> : null}
            </View>
          ) : null}
          {facts.length ? (
            <Text variant="caption" weight="bold" style={[styles.facts, { color: colors.muted }]} numberOfLines={1}>
              {facts.map((f, i) => <Text key={i} testID={f.testID}>{i ? ' · ' : ''}{f.text}</Text>)}
            </Text>
          ) : null}
          <View style={styles.bottom}>
            {shown.map((r) => <Pill key={r} tone="primary" label={r} />)}
            <UpdateLabel unit={unit} lang={lang} />
          </View>
        </View>
      </View>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.card, marginHorizontal: spacing.lg, marginBottom: spacing.md, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'stretch' },
  photoWrap: { width: UNIT_PHOTO_WIDTH, alignSelf: 'stretch', minHeight: 124, position: 'relative', overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  none: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, padding: spacing.sm },
  noText: { textAlign: 'center' },
  overTop: { position: 'absolute', top: spacing.xs, start: spacing.xs },
  overBottom: { position: 'absolute', bottom: spacing.xs, start: spacing.xs },
  content: { flex: 1, minWidth: 0, padding: spacing.md, gap: spacing.xs, justifyContent: 'center' },
  flex: { flex: 1 },
  num: { fontVariant: ['tabular-nums'] },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  facts: { fontVariant: ['tabular-nums'] },
  bottom: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  update: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
