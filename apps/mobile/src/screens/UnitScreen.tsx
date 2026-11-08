import React from 'react';
import { FlatList, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { formatEgp } from '@wehdathub/shared';
import { api } from '../api';
import { currentLang } from '../auth';
import { ErrorView, Loading } from '../components/StateViews';
import { errorText } from '../errors';
import { t } from '../i18n';
import type { RootStackParams } from '../navigation';
import { spacing, useTheme } from '../theme';

export function UnitScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const { params } = useRoute<NativeStackScreenProps<RootStackParams, 'Unit'>['route']>();
  const unit = useQuery({ queryKey: ['unit', params.code], queryFn: () => api.unit(params.code) });

  if (unit.isPending) return <Loading label={t(lang, 'loading')} />;
  if (unit.isError) return <ErrorView message={errorText(unit.error, lang)} retryLabel={t(lang, 'retry')} onRetry={() => unit.refetch()} altLabel={t(lang, 'backToUnits')} onAlt={() => nav.goBack()} />;

  const u = unit.data;
  const rows: [string, string | null][] = [
    [t(lang, 'beds'), u.bedrooms !== null ? String(u.bedrooms) : null],
    [t(lang, 'baths'), u.bathrooms !== null ? String(u.bathrooms) : null],
    [t(lang, 'sqm'), u.area !== null ? String(Math.round(u.area)) : null],
    ['', [u.district, u.city].filter(Boolean).join(' · ') || null],
    ['', [u.finishing, u.furnishing].filter(Boolean).join(' · ') || null],
  ];
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.body}>
      {u.images.length ? (
        <FlatList horizontal data={u.images} keyExtractor={(i) => i.id} showsHorizontalScrollIndicator={false} renderItem={({ item }) => <Image source={{ uri: item.url }} style={styles.image} resizeMode="cover" />} />
      ) : null}
      <View style={styles.info}>
        <Text style={[styles.code, { color: colors.primary }]}>{u.code}</Text>
        {u.compound ? <Text style={[styles.title, { color: colors.text }]}>{u.compound}</Text> : null}
        {u.price !== null ? <Text style={[styles.price, { color: colors.text }]}>{formatEgp(u.price)} {t(lang, 'egp')}</Text> : null}
        {rows.filter(([, v]) => v).map(([k, v], i) => (
          <Text key={i} style={[styles.row, { color: colors.muted }]}>{k ? `${k}: ` : ''}{v}</Text>
        ))}
        {u.features.length ? <Text style={[styles.row, { color: colors.text }]}>{t(lang, 'features')}: {u.features.join(' · ')}</Text> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { paddingBottom: spacing.xl },
  image: { width: 320, height: 240, marginEnd: spacing.sm },
  info: { padding: spacing.lg, gap: spacing.sm },
  code: { fontSize: 16, fontWeight: '800' },
  title: { fontSize: 22, fontWeight: '700' },
  price: { fontSize: 24, fontWeight: '800' },
  row: { fontSize: 16 },
});
