import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatEgp } from '@wehdathub/shared';
import type { ApiUnitListItem, Lang } from '@wehdathub/shared';
import { t } from '../i18n';
import { radius, spacing, useTheme } from '../theme';

export function UnitCard({ unit, lang, onPress, onEdit }: { unit: ApiUnitListItem; lang: Lang; onPress: () => void; onEdit?: () => void }) {
  const { colors } = useTheme();
  const facts = [unit.bedrooms !== null ? `${unit.bedrooms} ${t(lang, 'beds')}` : null, unit.bathrooms !== null ? `${unit.bathrooms} ${t(lang, 'baths')}` : null, unit.area !== null ? `${Math.round(unit.area)} ${t(lang, 'sqm')}` : null].filter(Boolean);
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.9 : 1 }]}>
      {unit.photo ? <Image source={{ uri: unit.photo }} style={styles.photo} resizeMode="cover" /> : null}
      <View style={styles.info}>
        <View style={styles.row}>
          <Text style={[styles.code, { color: colors.primary }]}>{unit.code}</Text>
          {unit.mine ? <Text style={[styles.badge, { color: colors.accent }]}>{t(lang, 'mine')}</Text> : null}
          {onEdit ? <Pressable testID={`edit-${unit.code}`} accessibilityRole="button" accessibilityLabel={t(lang, 'editUnit')} hitSlop={12} onPress={onEdit}><Text style={[styles.badge, { color: colors.primary }]}>✎ {t(lang, 'editUnit')}</Text></Pressable> : null}
        </View>
        {unit.compound ? <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{unit.compound}</Text> : null}
        {unit.price !== null ? <Text style={[styles.price, { color: colors.text }]}>{formatEgp(unit.price)} {t(lang, 'egp')}</Text> : null}
        {facts.length ? <Text style={[styles.facts, { color: colors.muted }]}>{facts.join(' · ')}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden', marginHorizontal: spacing.lg, marginBottom: spacing.md },
  photo: { height: 160, width: '100%' },
  info: { padding: spacing.md, gap: spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  code: { fontSize: 15, fontWeight: '800' },
  badge: { fontSize: 13, fontWeight: '700' },
  title: { fontSize: 16, fontWeight: '600' },
  price: { fontSize: 18, fontWeight: '800' },
  facts: { fontSize: 14 },
});
