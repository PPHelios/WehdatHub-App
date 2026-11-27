import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Keyboard, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '../components/AppText';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { formatUnitPrice, parseMoney, type MapFilters, type MapUnit } from '@wehdathub/shared';
import { api } from '../api';
import { API_BASE_URL } from '../config';
import { currentLang } from '../auth';
import { Chips } from '../components/Chips';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { Pill } from '../components/Pill';
import { SmartImage } from '../components/SmartImage';
import { EmptyView, ErrorView, Loading } from '../components/StateViews';
import { errorText } from '../errors';
import { t } from '../i18n';
import { mapHtml } from '../mapHtml';
import { FINISHING, FURNISHING, ALL_TYPES, PROPERTY_TYPES, labelOf, options } from '../unitOptions';
import { usePlaceSuggestions } from '../usePlaceSuggestions';
import type { RootStackParams } from '../navigation';
import { greenGradient, radius, spacing, useTheme } from '../theme';

type Deal = 'sale' | 'rent';

const MAP_GUTTER = 6;
const MAP_INSET = 10;

export function MapScreen() {
  const { colors, elev, scheme } = useTheme();
  const lang = currentLang();
  const ar = lang === 'ar';
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const web = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [deal, setDeal] = useState<Deal | ''>('');
  const [rooms, setRooms] = useState<string>('');
  const [expanded, setExpanded] = useState(false);
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
    Keyboard.dismiss();
    if (p.lat != null && p.lng != null) web.current?.injectJavaScript(`window.flyTo(${p.lat},${p.lng},${p.kind === 'compound' ? 15 : p.kind === 'subzone' ? 13 : 12});true;`);
  };
  const map = useQuery({ queryKey: ['map', filters], queryFn: () => api.map(filters), placeholderData: (prev) => prev });
  const units = useQuery({ queryKey: ['mapUnits', picked?.id, filters], queryFn: () => api.mapUnits(picked!.id, filters), enabled: !!picked });

  const tilesUrl = map.data?.tilesUrl ?? null;
  const html = useMemo(() => tilesUrl ? mapHtml(tilesUrl, lang, {
    pin: colors.primary, onPin: colors.onPrimary, selected: colors.primaryStrong,
    onSelected: colors.onPrimary, canvas: colors.cardSubtle, dark: scheme === 'dark',
  }) : '', [tilesUrl, lang, colors.primary, colors.onPrimary, colors.primaryStrong, colors.cardSubtle, scheme]);
  const selectedId = picked?.id ?? null;
  useEffect(() => {
    if (!ready || !map.data) return;
    const json = JSON.stringify(map.data.pins).split(String.fromCharCode(0x2028)).join('').split(String.fromCharCode(0x2029)).join('');
    web.current?.injectJavaScript(`window.setPins(${json},${JSON.stringify(selectedId)});true;`);
  }, [ready, map.data, selectedId]);

  const onMessage = useCallback((e: WebViewMessageEvent) => {
    try {
      const m = JSON.parse(e.nativeEvent.data) as { type: string; id?: string; name?: string };
      if (m.type === 'ready') setReady(true);
      if (m.type === 'pin' && m.id) {
        setPicked({ id: m.id, name: m.name ?? '' });
        setExpanded(false);
        setSearching(false);
        setPanel(false);
        Keyboard.dismiss();
      }
    } catch {
      // Ignore anything that is not ours.
    }
  }, []);

  if (map.isPending) return <Loading label={t(lang, 'loading')} />;
  if (map.isError && !map.data) return <ErrorView message={errorText(map.error, lang)} retryLabel={t(lang, 'retry')} onRetry={async () => { await map.refetch(); }} />;
  if (!tilesUrl) return <EmptyView title={t(lang, 'mapOff')} hint={t(lang, 'mapOffHint')} />;

  const roomOptions = [{ value: '', label: t(lang, 'anyRooms') }, ...(map.data?.facets.rooms ?? []).map((r) => ({ value: String(r), label: `${r}${r >= 5 ? '+' : ''} ${t(lang, 'roomsN')}` }))];
  const selectedPin = map.data?.pins.find((p) => p.id === selectedId);
  const count = selectedPin?.n ?? units.data?.items.length;
  const preview = units.data?.items[0];
  const previewPhoto = preview?.thumb || preview?.photo;
  const priceOf = (item: MapUnit) => formatUnitPrice(item.price, {
    currency: item.currency,
    lang,
    dealType: item.listingType,
    rentPeriod: item.rentPeriod,
    fallbackText: item.priceText,
  });
  const previewPrice = !expanded && preview ? priceOf(preview) : null;
  const submitPlace = () => { if (suggestions[0]) goTo(suggestions[0]); };
  const closePreview = () => { setPicked(null); setExpanded(false); };
  const showFilters = () => { setPanel(true); setSearching(false); Keyboard.dismiss(); };
  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={styles.intro}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{ar ? 'خريطة العقارات' : 'Map Explorer'}</Text>
        <Text style={[styles.caption, { color: colors.muted }]}>{ar ? 'اختار مشروع على الخريطة عشان تشوف الوحدات المتاحة' : 'Tap a compound pin to see available units'}</Text>
      </View>
      <View style={styles.filters}>
        <Chips<Deal | ''> animateFilter soft testID="map-deal" value={deal} options={[{ value: '', label: ar ? 'كل الوحدات' : 'All deals' }, { value: 'sale', label: t(lang, 'sale') }, { value: 'rent', label: t(lang, 'rent') }]} onChange={(v) => setDeal(v === deal ? '' : v)} />
        <Pressable testID="map-rooms-toggle" accessibilityRole="button" accessibilityState={{ expanded: panel }} onPress={showFilters}
          style={[styles.filterButton, { borderColor: rooms ? colors.primaryLine : colors.border, backgroundColor: rooms ? colors.primarySoft : colors.cardSubtle }]}>
          <Text style={[styles.caption, { color: colors.primaryInk }]}>{rooms ? roomOptions.find((o) => o.value === rooms)?.label ?? rooms : t(lang, 'fBedrooms')}</Text>
        </Pressable>
        <Pressable testID="map-filters-toggle" accessibilityRole="button" accessibilityState={{ expanded: panel }} onPress={panel ? () => setPanel(false) : showFilters}
          style={[styles.filterButton, { borderColor: active ? colors.primaryLine : colors.border, backgroundColor: active ? colors.primarySoft : colors.cardSubtle }]}>
          <Icon name="funnel" color={colors.primaryInk} size={15} />
          <Text style={[styles.caption, { color: colors.primaryInk }]}>{t(lang, 'mapFilters')}{active ? ` (${active})` : ''}</Text>
        </Pressable>
      </View>
      <View style={[styles.frame, { backgroundColor: colors.cardSubtle, borderColor: colors.border }]}>
        <WebView ref={web} testID="map-web" style={[styles.flex, { backgroundColor: colors.cardSubtle }]} originWhitelist={['*']} source={{ html, baseUrl: API_BASE_URL }} javaScriptEnabled onMessage={onMessage} onLoadStart={() => setReady(false)} />
        <View pointerEvents="box-none" style={styles.search}>
          <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }, elev('md')]}>
            <Icon name="pin" color={colors.primaryInk} size={18} />
            <TextInput testID="map-search" style={[styles.searchInput, { color: colors.text }]} value={query} onChangeText={(v) => { setQuery(v); setSearching(true); }} onFocus={() => setSearching(true)} onBlur={() => setSearching(false)} onSubmitEditing={submitPlace} placeholder={t(lang, 'mapSearchPh')} placeholderTextColor={colors.muted} autoCorrect={false} returnKeyType="go" />
            {map.isFetching && !(expanded && units.isPending) ? <ActivityIndicator color={colors.primaryInk} /> : null}
            <Pressable testID="map-go" accessibilityRole="button" accessibilityLabel={ar ? 'روح للمكان' : 'Go to place'} disabled={!suggestions.length} onPress={submitPlace}
              style={[styles.go, { backgroundColor: colors.cardSubtle, borderColor: colors.border, opacity: suggestions.length ? 1 : 0.6 }]}>
              <Text style={[styles.caption, { color: colors.primaryInk }]}>{ar ? 'روح' : 'Go'}</Text>
            </Pressable>
          </View>
          {!panel && suggestions.length ? (
            <ScrollView testID="map-suggestions" style={[styles.list, { borderColor: colors.border, backgroundColor: colors.card }]} keyboardShouldPersistTaps="handled">
              {suggestions.map((p) => (
                <Pressable key={`${p.kind}-${p.id}`} testID={`map-place-${p.id}`} accessibilityRole="button" onPress={() => goTo(p)} style={styles.item}>
                  <Text style={{ color: colors.text }}>{(ar ? p.name_ar || p.name_en : p.name_en || p.name_ar) || ''}</Text>
                  {p.path ? <Text style={[styles.caption, { color: colors.muted }]}>{p.path}</Text> : null}
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
        </View>
        {panel ? (
          <ScrollView testID="map-filters" style={[styles.overlay, styles.panel, { backgroundColor: colors.card, borderColor: colors.border }, elev('md')]} contentContainerStyle={styles.panelContent} keyboardShouldPersistTaps="handled">
            <View style={styles.sheetHead}>
              <Text accessibilityRole="header" style={[styles.sheetTitle, { color: colors.text }]}>{t(lang, 'mapFilters')}</Text>
              <Pressable testID="map-filters-close" accessibilityRole="button" accessibilityLabel={t(lang, 'closePanel')} onPress={() => setPanel(false)} style={styles.close}><Icon name="cross" color={colors.primaryInk} size={18} /></Pressable>
            </View>
            <Text style={[styles.h, { color: colors.text }]}>{t(lang, 'fBedrooms')}</Text>
            <Chips animateFilter soft testID="map-rooms" value={rooms} options={roomOptions} onChange={setRooms} />
            <Text style={[styles.h, { color: colors.text }]}>{t(lang, 'fType')}</Text>
            <Chips animateFilter soft testID="map-ptype" value={ptype} options={[{ value: '', label: t(lang, 'anyOne') }, ...options(PROPERTY_TYPES, lang).filter((o) => !map.data?.facets.types || map.data.facets.types.includes(o.value))]} onChange={setPtype} />
            <Text style={[styles.h, { color: colors.text }]}>{t(lang, 'fFinishing')}</Text>
            <Chips animateFilter soft testID="map-fin" value={fin} options={[{ value: '', label: t(lang, 'anyOne') }, ...options(FINISHING, lang)]} onChange={setFin} />
            <Text style={[styles.h, { color: colors.text }]}>{t(lang, 'fFurnishing')}</Text>
            <Chips animateFilter soft testID="map-furn" value={furn} options={[{ value: '', label: t(lang, 'anyOne') }, ...options(FURNISHING, lang)]} onChange={setFurn} />
            <Text style={[styles.h, { color: colors.text }]}>{t(lang, 'budgetTitle')}</Text>
            <View style={styles.budget}>
              <TextInput testID="map-pmin" style={[styles.input, styles.flex, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]} value={pmin} onChangeText={setPmin} placeholder={t(lang, 'budgetFrom')} placeholderTextColor={colors.muted} autoCorrect={false} />
              <TextInput testID="map-pmax" style={[styles.input, styles.flex, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]} value={pmax} onChangeText={setPmax} placeholder={t(lang, 'budgetTo')} placeholderTextColor={colors.muted} autoCorrect={false} />
            </View>
            {active ? <Button testID="map-reset" variant="secondary" label={t(lang, 'resetFilters')} onPress={reset} /> : null}
          </ScrollView>
        ) : null}
        {picked && !panel && !searching ? (
          <View style={[styles.overlay, styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }, elev('lg')]} testID="map-sheet">
            <View style={[styles.sheetHead, { direction: ar ? 'rtl' : 'ltr' }]}>
              {!expanded && previewPhoto ? <SmartImage key={previewPhoto} uri={previewPhoto} style={styles.thumb} /> : null}
              <View style={[styles.previewText, !expanded && Boolean(previewPhoto) && styles.previewTextWithPhoto]}>
                <Text accessibilityRole="header" style={[styles.previewTitle, { color: colors.text }]} numberOfLines={2}>{picked.name}</Text>
                {count != null ? <Text style={[styles.previewMeta, { color: colors.muted }]}>{ar ? `${count} وحدة متاحة` : `${count} available`}{selectedPin?.district ? ` · ${selectedPin.district}` : ''}</Text> : null}
                {previewPrice ? <Text style={[styles.previewPrice, { color: colors.primaryInk }]}>{ar ? 'مثال' : 'Example'} · {previewPrice}</Text> : null}
              </View>
              {!expanded ? (
                <Pressable testID="map-view-units" accessibilityRole="button" accessibilityLabel={ar ? 'اعرض الوحدات' : 'View units'} onPress={() => setExpanded(true)} style={styles.viewButton}>
                  <View style={[styles.viewPill, greenGradient]}>
                    <Text style={[styles.previewButtonText, { color: colors.onPrimary }]}>{ar ? 'عرض' : 'View'}</Text>
                  </View>
                </Pressable>
              ) : null}
              <Pressable testID="map-preview-close" accessibilityRole="button" accessibilityLabel={t(lang, 'closePanel')} onPress={closePreview} style={[styles.close, styles.previewClose]}><Icon name="cross" color={colors.muted} size={16} /></Pressable>
            </View>
            {expanded ? units.isPending ? (
              <ActivityIndicator color={colors.primaryInk} />
            ) : units.isError ? (
              <ErrorView message={errorText(units.error, lang)} retryLabel={t(lang, 'retry')} onRetry={async () => { await units.refetch(); }} />
            ) : (
              <FlatList
                style={styles.unitList}
                data={units.data.items}
                keyExtractor={(u) => u.code}
                ListEmptyComponent={<Text style={{ color: colors.muted }}>{t(lang, 'noUnitsHere')}</Text>}
                renderItem={({ item }) => {
                  const type = labelOf(ALL_TYPES, item.propertyType, lang);
                  const price = priceOf(item);
                  const photo = item.thumb || item.photo;
                  return (
                    <Pressable accessibilityRole="button" onPress={() => nav.navigate('Unit', { code: item.code })} style={[styles.row, { borderColor: colors.border }]}>
                      {photo ? <SmartImage testID="map-thumb" uri={photo} style={styles.thumb} /> : <View style={[styles.thumb, styles.placeholder, { backgroundColor: colors.cardSubtle }]}><Icon name="units" color={colors.muted} size={23} /></View>}
                      <View style={styles.rowText}>
                        {item.title ? <Text style={[styles.unitTitle, { color: colors.text }]} numberOfLines={2}>{item.title}</Text> : null}
                        <View style={styles.chips}>
                          {type ? <Pill testID={`pin-type-${item.code}`} tone="primary" label={type} /> : null}
                          <Pill testID={`pin-code-${item.code}`} tone="primary" label={item.code} />
                          {item.listingType === 'sale' || item.listingType === 'rent' ? <Pill testID={`pin-deal-${item.code}`} tone={item.listingType === 'rent' ? 'accent' : 'primary'} label={t(lang, item.listingType)} /> : null}
                        </View>
                        <Text style={[styles.caption, { color: colors.muted }]}>{[item.bedrooms !== null ? `${item.bedrooms} ${t(lang, 'roomsN')}` : null, item.area !== null ? `${item.area} m²` : null].filter(Boolean).join(' · ')}</Text>
                        {price ? <Text style={[styles.unitTitle, { color: colors.primaryInk }]}>{price}</Text> : null}
                      </View>
                    </Pressable>
                  );
                }}
              />
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, paddingHorizontal: MAP_GUTTER, paddingBottom: MAP_GUTTER, gap: spacing.sm },
  intro: { gap: 2 },
  title: { fontSize: 19, fontWeight: '800' },
  caption: { fontSize: 12 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  filterButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1 },
  frame: { flex: 1, borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  search: { position: 'absolute', top: MAP_INSET, start: MAP_INSET, end: MAP_INSET, gap: spacing.xs, zIndex: 2 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1 },
  searchInput: { flex: 1, minHeight: 46, paddingVertical: spacing.xs, fontSize: 14 },
  go: { minHeight: 36, minWidth: 42, justifyContent: 'center', alignItems: 'center', borderRadius: radius.sm, borderWidth: 1 },
  input: { minHeight: 44, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: 15 },
  list: { borderWidth: 1, borderRadius: radius.md, maxHeight: 200 },
  item: { minHeight: 46, justifyContent: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  overlay: { position: 'absolute', start: MAP_INSET, end: MAP_INSET, bottom: MAP_INSET, borderRadius: radius.lg, borderWidth: 1 },
  panel: { maxHeight: '68%' },
  panelContent: { padding: spacing.lg, paddingBottom: spacing.xl },
  budget: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  h: { fontWeight: '700', marginTop: spacing.md, marginBottom: spacing.xs },
  sheet: { maxHeight: '56%', padding: MAP_INSET, gap: spacing.sm },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.xs },
  sheetTitle: { fontSize: 16, fontWeight: '800' },
  previewText: { flex: 1, minWidth: 0, gap: 2 },
  previewTextWithPhoto: { marginStart: spacing.xs },
  previewTitle: { fontSize: 13, lineHeight: 15, includeFontPadding: false, fontWeight: '800' },
  previewMeta: { fontSize: 11, lineHeight: 13, includeFontPadding: false },
  previewPrice: { fontSize: 12, lineHeight: 14, includeFontPadding: false, fontWeight: '800' },
  previewButtonText: { fontSize: 11, fontWeight: '800' },
  previewClose: { alignSelf: 'flex-start', marginTop: -spacing.xs },
  row: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowText: { flex: 1, gap: spacing.xs },
  thumb: { width: 62, height: 62, borderRadius: radius.sm },
  placeholder: { justifyContent: 'center', alignItems: 'center' },
  close: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  viewButton: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  viewPill: { borderRadius: 999, paddingHorizontal: MAP_INSET, paddingVertical: spacing.xs + 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  unitList: { flexShrink: 1 },
  unitTitle: { fontSize: 14, fontWeight: '800' },
});
