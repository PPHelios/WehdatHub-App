import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { formatEgp, parseMoney, type MapFilters } from '@wehdathub/shared';
import { api } from '../api';
import { API_BASE_URL } from '../config';
import { currentLang } from '../auth';
import { Chips } from '../components/Chips';
import { Button } from '../components/Button';
import { EmptyView, ErrorView, Loading } from '../components/StateViews';
import { errorText } from '../errors';
import { t } from '../i18n';
import { mapHtml } from '../mapHtml';
import { FINISHING, FURNISHING, PROPERTY_TYPES, options } from '../unitOptions';
import { usePlaceSuggestions } from '../usePlaceSuggestions';
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

  const [ptype, setPtype] = useState('');
  const [fin, setFin] = useState('');
  const [furn, setFurn] = useState('');
  const [pmin, setPmin] = useState('');
  const [pmax, setPmax] = useState('');
  const [panel, setPanel] = useState(false);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const suggestions = usePlaceSuggestions(searching ? query : '').filter((p) => p.lat != null && p.lng != null);

  const filters: MapFilters = useMemo(
    () => ({
      type: deal || undefined,
      rooms: rooms === '' ? undefined : Number(rooms),
      ptype: ptype || undefined,
      fin: fin || undefined,
      furn: furn || undefined,
      pmin: parseMoney(pmin) ?? undefined,
      pmax: parseMoney(pmax) ?? undefined,
    }),
    [deal, rooms, ptype, fin, furn, pmin, pmax],
  );
  const active = [ptype, fin, furn, pmin, pmax].filter(Boolean).length;
  const reset = () => { setPtype(''); setFin(''); setFurn(''); setPmin(''); setPmax(''); };
  // Picking a suggestion moves the map to the place (a compound closer than an area).
  const goTo = (p: { kind: string; name_en: string | null; name_ar: string | null; lat?: number | null; lng?: number | null }) => {
    setQuery(lang === 'en' ? p.name_en || p.name_ar || '' : p.name_ar || p.name_en || '');
    setSearching(false);
    if (p.lat != null && p.lng != null) web.current?.injectJavaScript(`window.flyTo(${p.lat},${p.lng},${p.kind === 'compound' ? 15 : p.kind === 'subzone' ? 13 : 12});true;`);
  };
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
      <View style={styles.search}>
        <TextInput testID="map-search" style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]} value={query} onChangeText={(v) => { setQuery(v); setSearching(true); }} placeholder={t(lang, 'mapSearchPh')} placeholderTextColor={colors.muted} autoCorrect={false} returnKeyType="search" />
        {suggestions.length ? (
          <View testID="map-suggestions" style={[styles.list, { borderColor: colors.border, backgroundColor: colors.card }]}>
            {suggestions.map((p) => (
              <Pressable key={`${p.kind}-${p.id}`} testID={`map-place-${p.id}`} accessibilityRole="button" onPress={() => goTo(p)} style={styles.item}>
                <Text style={{ color: colors.text, fontSize: 16 }}>{(lang === 'en' ? p.name_en || p.name_ar : p.name_ar || p.name_en) || ''}</Text>
                {p.path ? <Text style={{ color: colors.muted, fontSize: 13 }}>{p.path}</Text> : null}
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
      <View style={styles.filters}>
        <Chips<Deal> testID="map-deal" value={deal} options={[{ value: 'sale', label: t(lang, 'sale') }, { value: 'rent', label: t(lang, 'rent') }]} onChange={(v) => setDeal(v === deal ? '' : v)} />
        <Chips testID="map-rooms" value={rooms} options={roomOptions} onChange={(v) => setRooms(v)} />
        <Button testID="map-filters-toggle" variant="secondary" label={`${t(lang, 'mapFilters')}${active ? ` (${active})` : ''}`} onPress={() => setPanel((o) => !o)} />
      </View>
      <View style={styles.flex}>
        <WebView ref={web} testID="map-web" style={styles.flex} originWhitelist={['*']} source={{ html, baseUrl: API_BASE_URL }} javaScriptEnabled onMessage={onMessage} onLoadStart={() => setReady(false)} />
        {map.isFetching ? <ActivityIndicator style={styles.busy} color={colors.primary} /> : null}
      </View>
      {panel ? (
        <ScrollView testID="map-filters" style={[styles.overlay, styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]} keyboardShouldPersistTaps="handled">
          <Text style={[styles.h, { color: colors.text }]}>{t(lang, 'fType')}</Text>
          <Chips testID="map-ptype" value={ptype} options={[{ value: '', label: t(lang, 'anyOne') }, ...options(PROPERTY_TYPES, lang).filter((o) => !map.data?.facets.types || map.data.facets.types.includes(o.value))]} onChange={setPtype} />
          <Text style={[styles.h, { color: colors.text }]}>{t(lang, 'fFinishing')}</Text>
          <Chips testID="map-fin" value={fin} options={[{ value: '', label: t(lang, 'anyOne') }, ...options(FINISHING, lang)]} onChange={setFin} />
          <Text style={[styles.h, { color: colors.text }]}>{t(lang, 'fFurnishing')}</Text>
          <Chips testID="map-furn" value={furn} options={[{ value: '', label: t(lang, 'anyOne') }, ...options(FURNISHING, lang)]} onChange={setFurn} />
          <Text style={[styles.h, { color: colors.text }]}>{t(lang, 'budgetTitle')}</Text>
          <View style={styles.budget}>
            <TextInput testID="map-pmin" style={[styles.input, styles.flex, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]} value={pmin} onChangeText={setPmin} placeholder={t(lang, 'budgetFrom')} placeholderTextColor={colors.muted} autoCorrect={false} />
            <TextInput testID="map-pmax" style={[styles.input, styles.flex, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]} value={pmax} onChangeText={setPmax} placeholder={t(lang, 'budgetTo')} placeholderTextColor={colors.muted} autoCorrect={false} />
          </View>
          {active ? <Button testID="map-reset" variant="secondary" label={t(lang, 'resetFilters')} onPress={reset} /> : null}
        </ScrollView>
      ) : null}
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
                  {item.photo ? <Image testID="map-thumb" source={{ uri: item.photo }} style={[styles.thumb, { backgroundColor: colors.card }]} accessibilityIgnoresInvertColors /> : <View style={[styles.thumb, { backgroundColor: colors.card }]} />}
                  <View style={styles.rowText}>
                    <Text style={[styles.code, { color: colors.text }]}>{item.code}</Text>
                    <Text style={{ color: colors.muted }} numberOfLines={1}>{[item.bedrooms !== null ? `${item.bedrooms} ${t(lang, 'roomsN')}` : null, item.area ? `${item.area} m²` : null].filter(Boolean).join(' · ')}</Text>
                    {item.price !== null ? <Text style={[styles.price, { color: colors.text }]}>{formatEgp(item.price)} {t(lang, 'egp')}</Text> : null}
                  </View>
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
  search: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.xs, zIndex: 2 },
  input: { minHeight: 44, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: 16 },
  list: { borderWidth: 1, borderRadius: radius.md, overflow: 'hidden' },
  item: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  panel: { maxHeight: '60%', padding: spacing.md },
  overlay: { position: 'absolute', start: 0, end: 0, bottom: 0, borderTopWidth: 1, borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md },
  budget: { flexDirection: 'row', gap: spacing.sm },
  h: { fontWeight: '700', marginTop: spacing.sm },
  busy: { position: 'absolute', top: spacing.md, end: spacing.md },
  sheet: { position: 'absolute', start: 0, end: 0, bottom: 0, maxHeight: '38%', borderTopWidth: 1, borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md, padding: spacing.lg, gap: spacing.sm },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle: { fontSize: 18, fontWeight: '800', flex: 1 },
  row: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowText: { flex: 1, gap: 2 },
  thumb: { width: 64, height: 64, borderRadius: radius.sm },
  close: { fontWeight: '700' },
  code: { fontWeight: '700' },
  price: { fontWeight: '800' },
});
