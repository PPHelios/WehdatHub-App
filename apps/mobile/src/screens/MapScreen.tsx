import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { formatEgp, type MapFilters } from '@wehdathub/shared';
import { api } from '../api';
import { API_BASE_URL } from '../config';
import { currentLang } from '../auth';
import { Chips } from '../components/Chips';
import { EmptyView, ErrorView, Loading } from '../components/StateViews';
import { errorText } from '../errors';
import { t } from '../i18n';
import { mapHtml } from '../mapHtml';
import type { RootStackParams } from '../navigation';
import { radius, spacing, useTheme } from '../theme';

type Deal = 'sale' | 'rent';

export function MapScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const web = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [deal, setDeal] = useState<Deal | ''>('');
  const [rooms, setRooms] = useState<string>('');
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(null);

  const filters: MapFilters = useMemo(() => ({ type: deal || undefined, rooms: rooms === '' ? undefined : Number(rooms) }), [deal, rooms]);
  const map = useQuery({ queryKey: ['map', filters], queryFn: () => api.map(filters), placeholderData: (prev) => prev });
  const units = useQuery({ queryKey: ['mapUnits', picked?.id, filters], queryFn: () => api.mapUnits(picked!.id, filters), enabled: !!picked });

  const tilesUrl = map.data?.tilesUrl ?? null;
  const html = useMemo(() => (tilesUrl ? mapHtml(tilesUrl, lang) : ''), [tilesUrl, lang]);

  useEffect(() => {
    if (!ready || !map.data) return;
    const json = JSON.stringify(map.data.pins).split(String.fromCharCode(0x2028)).join('').split(String.fromCharCode(0x2029)).join('');
    web.current?.injectJavaScript(`window.setPins(${json});true;`);
  }, [ready, map.data]);

  const onMessage = useCallback((e: WebViewMessageEvent) => {
    try {
      const m = JSON.parse(e.nativeEvent.data) as { type: string; id?: string; name?: string };
      if (m.type === 'ready') setReady(true);
      if (m.type === 'pin' && m.id) setPicked({ id: m.id, name: m.name ?? '' });
    } catch {
      // Ignore anything that is not ours.
    }
  }, []);

  if (map.isPending) return <Loading label={t(lang, 'loading')} />;
  if (map.isError && !map.data) return <ErrorView message={errorText(map.error, lang)} retryLabel={t(lang, 'retry')} onRetry={async () => { await map.refetch(); }} />;
  if (!tilesUrl) return <EmptyView title={t(lang, 'mapOff')} hint={t(lang, 'mapOffHint')} />;

  const roomOptions = [{ value: '', label: t(lang, 'anyRooms') }, ...(map.data?.facets.rooms ?? []).map((r) => ({ value: String(r), label: `${r}${r >= 5 ? '+' : ''}` }))];
  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <View style={styles.filters}>
        <Chips<Deal> testID="map-deal" value={deal} options={[{ value: 'sale', label: t(lang, 'sale') }, { value: 'rent', label: t(lang, 'rent') }]} onChange={(v) => setDeal(v === deal ? '' : v)} />
        <Chips testID="map-rooms" value={rooms} options={roomOptions} onChange={(v) => setRooms(v)} />
      </View>
      <View style={styles.flex}>
        <WebView ref={web} testID="map-web" style={styles.flex} originWhitelist={['*']} source={{ html, baseUrl: API_BASE_URL }} javaScriptEnabled onMessage={onMessage} onLoadStart={() => setReady(false)} />
        {map.isFetching ? <ActivityIndicator style={styles.busy} color={colors.primary} /> : null}
      </View>
      {picked ? (
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]} testID="map-sheet">
          <View style={styles.sheetHead}>
            <Text style={[styles.sheetTitle, { color: colors.text }]} numberOfLines={1}>{picked.name}</Text>
            <Pressable accessibilityRole="button" onPress={() => setPicked(null)}><Text style={[styles.close, { color: colors.primary }]}>{t(lang, 'closePanel')}</Text></Pressable>
          </View>
          {units.isPending ? (
            <ActivityIndicator color={colors.primary} />
          ) : units.isError ? (
            <ErrorView message={errorText(units.error, lang)} retryLabel={t(lang, 'retry')} onRetry={async () => { await units.refetch(); }} />
          ) : (
            <FlatList
              data={units.data.items}
              keyExtractor={(u) => u.code}
              ListEmptyComponent={<Text style={{ color: colors.muted }}>{t(lang, 'noUnitsHere')}</Text>}
              renderItem={({ item }) => (
                <Pressable accessibilityRole="button" onPress={() => nav.navigate('Unit', { code: item.code })} style={[styles.row, { borderColor: colors.border }]}>
                  <Text style={[styles.code, { color: colors.text }]}>{item.code}</Text>
                  <Text style={{ color: colors.muted }} numberOfLines={1}>{[item.bedrooms !== null ? `${item.bedrooms} ${t(lang, 'roomsN')}` : null, item.area ? `${item.area} m²` : null].filter(Boolean).join(' · ')}</Text>
                  {item.price !== null ? <Text style={[styles.price, { color: colors.text }]}>{formatEgp(item.price)} {t(lang, 'egp')}</Text> : null}
                </Pressable>
              )}
            />
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  filters: { padding: spacing.md, gap: spacing.sm },
  busy: { position: 'absolute', top: spacing.md, end: spacing.md },
  sheet: { maxHeight: '45%', borderTopWidth: 1, borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md, padding: spacing.lg, gap: spacing.sm },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle: { fontSize: 18, fontWeight: '800', flex: 1 },
  row: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: spacing.sm, gap: 2 },
  close: { fontWeight: '700' },
  code: { fontWeight: '700' },
  price: { fontWeight: '800' },
});
