import React, { useState } from 'react';
import { timed, usage } from '../usage';
import { UnitLifecycle } from '../components/UnitLifecycle';
import { UnitPrivateForms } from '../components/UnitPrivateForms';
import { Alert, Image, Linking, Modal, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { ApiClientError, formatEgp } from '@wehdathub/shared';
import { api } from '../api';
import { currentLang } from '../auth';
import { Button } from '../components/Button';
import { ClientLinkModal } from '../components/ClientLinkModal';
import { PhotoGallery } from '../components/PhotoGallery';
import { ErrorView, Loading } from '../components/StateViews';
import { errorText } from '../errors';
import { t } from '../i18n';
import { featureChip } from '../featureLabels';
import { saveToGallery } from '../saveImage';
import { FINISHING, FURNISHING, labelOf } from '../unitOptions';
import type { RootStackParams } from '../navigation';
import { radius, spacing, useTheme } from '../theme';
import { clientLang } from '../prefs';

export function UnitScreen({ code }: { code?: string } = {}) {
  const { colors } = useTheme();
  const lang = currentLang();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const routeParams = useRoute<NativeStackScreenProps<RootStackParams, 'Unit'>['route']>().params;
  const routeCode = routeParams?.code;
  const unitCode = code ?? routeCode ?? '';
  const unit = useQuery({ queryKey: ['unit', unitCode], queryFn: () => api.unit(unitCode) });
  // The owner's number comes only when the agency's privacy rules let this broker see it; otherwise the buttons stay hidden.
  const contact = useQuery({ queryKey: ['unit', unitCode, 'contact'], queryFn: () => api.unitContact(unitCode), retry: false, enabled: unit.isSuccess });
  const [flyer, setFlyer] = useState<string | null>(null);
  const [flyerBusy, setFlyerBusy] = useState<'main' | 'nb' | null>(null); // each flyer button spins on its own
  const [saving, setSaving] = useState(false);
  const saveFlyer = async () => {
    if (!flyer) return;
    setSaving(true);
    try {
      const ok = await saveToGallery(flyer);
      usage('flyer_save', ok);
      Alert.alert(t(lang, ok ? 'savedToGallery' : 'galleryDenied'));
    } catch {
      Alert.alert(t(lang, 'flyerFailed'));
    } finally {
      setSaving(false);
    }
  };
  const makeFlyer = async (unbranded = false) => {
    setFlyerBusy(unbranded ? 'nb' : 'main');
    try {
      setFlyer((await timed('flyer_make', () => api.unitFlyer(unitCode, 'dark', unbranded, clientLang()))).url);
    } catch (e) {
      Alert.alert(e instanceof ApiClientError && e.status === 503 ? t(lang, 'flyerBusy') : t(lang, 'flyerFailed'));
    } finally {
      setFlyerBusy(null);
    }
  };
  const [asking, setAsking] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [clientErr, setClientErr] = useState<string | null>(null);
  const [pickClient, setPickClient] = useState(false);
  const qc = useQueryClient();
  // 403 "hidden" says whether the person can ask for access, or has already asked.
  const hidden = contact.error instanceof ApiClientError && contact.error.code === 'hidden' ? String(contact.error.extra.access ?? 'ask') : null;
  const requestAccess = async () => {
    setAsking(true);
    try {
      await api.unitAccessRequest(unitCode);
      await qc.invalidateQueries({ queryKey: ['unit', unitCode, 'contact'] });
    } catch {
      Alert.alert(t(lang, 'serverError'));
    } finally {
      setAsking(false);
    }
  };
  const shareLink = async (to: string) => {
    setSharing(true);
    setClientErr(null);
    try {
      const { url } = await timed('client_link', () => api.unitShareLink(unitCode, clientLang(), to || undefined), { kind: to ? 'to_client' : 'open' });
      setPickClient(false);
      await Share.share({ message: url });
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 422) setClientErr(t(lang, 'badRecipient'));
      else {
        setPickClient(false);
        Alert.alert(t(lang, 'linkFailed'));
      }
    } finally {
      setSharing(false);
    }
  };

  if (unit.isPending) return <Loading label={t(lang, 'loading')} />;
  if (unit.isError) return <ErrorView message={errorText(unit.error, lang)} retryLabel={t(lang, 'retry')} onRetry={() => unit.refetch()} altLabel={t(lang, 'backToUnits')} onAlt={() => nav.goBack()} />;

  const u = unit.data;
  const rows: [string, string | null][] = [
    [t(lang, 'beds'), u.bedrooms !== null ? String(u.bedrooms) : null],
    [t(lang, 'baths'), u.bathrooms !== null ? String(u.bathrooms) : null],
    [t(lang, 'sqm'), u.area !== null ? String(Math.round(u.area)) : null],
    ['', [u.district, u.city].filter(Boolean).join(' · ') || null],
    ['', [labelOf(FINISHING, u.finishing, lang), labelOf(FURNISHING, u.furnishing, lang)].filter(Boolean).join(' · ') || null],
  ];
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.body}>
      <PhotoGallery photos={u.images} closeLabel={t(lang, 'closePanel')} />
      <View style={styles.info}>
        <Text style={[styles.code, { color: colors.primary }]}>{u.code}</Text>
        {u.compound ? <Text style={[styles.title, { color: colors.text }]}>{u.compound}</Text> : null}
        {u.price !== null ? <Text style={[styles.price, { color: colors.text }]}>{formatEgp(u.price)} {t(lang, 'egp')}</Text> : null}
        {rows.filter(([, v]) => v).map(([k, v], i) => (
          <Text key={i} style={[styles.row, { color: colors.muted }]}>{k ? `${k}: ` : ''}{v}</Text>
        ))}
        {contact.data?.phone ? (
          <View style={styles.actions}>
            <View style={styles.flex}><Button testID="call-owner" label={`📞 ${t(lang, 'callOwner')}`} onPress={() => { Linking.openURL(`tel:${contact.data?.phone}`).catch(() => undefined); }} /></View>
            <View style={styles.flex}><Button testID="whatsapp-owner" variant="secondary" label={`💬 ${t(lang, 'whatsappOwner')}`} onPress={() => { usage('whatsapp_tap', true, undefined, { kind: 'owner' }); Linking.openURL(`https://wa.me/${waNumber(contact.data?.phone ?? '')}`).catch(() => undefined); }} /></View>
          </View>
        ) : null}
        {hidden === 'pending' ? <Text testID="access-pending" style={{ color: colors.muted }}>{t(lang, 'accessPending')}</Text> : null}
        {hidden === 'ask' ? <Button testID="request-access" variant="secondary" label={t(lang, 'requestAccess')} loading={asking} onPress={requestAccess} /> : null}
        <Button testID="flyer" variant="secondary" label={`🖼 ${t(lang, 'flyer')}`} loading={flyerBusy === 'main'} disabled={flyerBusy === 'nb'} onPress={() => makeFlyer(false)} />
        <Button testID="flyer-nobrand" variant="secondary" label={`🖼 ${t(lang, 'flyer')} · ${t(lang, 'flyerNoBrand')}`} loading={flyerBusy === 'nb'} disabled={flyerBusy === 'main'} onPress={() => makeFlyer(true)} />
        {flyer ? (
          <Modal visible transparent animationType="fade" onRequestClose={() => setFlyer(null)}>
            <View style={[styles.flyerBack, { paddingTop: spacing.xl, paddingBottom: 64 /* clears the system navigation bar */ }]}>
              <Image testID="flyer-image" source={{ uri: flyer }} style={styles.flyerImg} resizeMode="contain" />
              {/* The buttons sit on a solid card so they read on any theme and clear the system navigation bar. */}
              <View style={[styles.flyerButtons, { backgroundColor: colors.bg }]}>
                <Button testID="flyer-share" label={t(lang, 'shareFlyer')} onPress={() => { Share.share({ message: flyer }).catch(() => undefined); }} />
                <Button testID="flyer-save" variant="secondary" label={t(lang, 'saveToGallery')} loading={saving} onPress={saveFlyer} />
                <Button label={t(lang, 'closePanel')} variant="secondary" onPress={() => setFlyer(null)} />
              </View>
            </View>
          </Modal>
        ) : null}
        {u.canEdit ? <Button testID="edit-unit" variant="secondary" label={`✎ ${t(lang, 'editUnit')}`} onPress={() => nav.navigate('AddUnit', { edit: u.code })} /> : null}
        {u.canEdit ? <UnitLifecycle code={u.code} status={u.status} /> : null}
        {u.canEdit ? <UnitPrivateForms code={u.code} prefill={routeParams?.lease} /> : null}
        <Button testID="share-link" label={t(lang, 'shareLink')} onPress={() => { setClientErr(null); setPickClient(true); }} />
        <ClientLinkModal visible={pickClient} busy={sharing} error={clientErr} onSubmit={shareLink} onCancel={() => setPickClient(false)} />
        <Button testID="share-unit" variant="secondary" label={t(lang, 'shareUnit')} onPress={() => { Share.share({ message: [u.code, u.compound, u.price !== null ? `${formatEgp(u.price)} ${t(lang, 'egp')}` : null, [u.bedrooms !== null ? `${u.bedrooms} ${t(lang, 'beds')}` : null, u.area !== null ? `${Math.round(u.area)} ${t(lang, 'sqm')}` : null].filter(Boolean).join(' · ')].filter(Boolean).join('\n') }).catch(() => undefined); }} />
        {u.features.length ? (
          <View testID="features" style={styles.featBox}>
            <Text style={[styles.featTitle, { color: colors.text }]}>{t(lang, 'features')}</Text>
            <View style={styles.chips}>
              {u.features.map((k) => {
                const f = featureChip(k, lang);
                return (
                  <View key={f.key} style={[styles.chip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={{ color: colors.text }}>{f.icon} {f.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

/** A phone number as WhatsApp wants it: digits only, with Egypt's country code when it starts with 0. */
export function waNumber(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (d.startsWith('00')) return d.slice(2);
  if (d.startsWith('0')) return `20${d.slice(1)}`;
  return d;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  featBox: { gap: spacing.sm, marginTop: spacing.md },
  featTitle: { fontSize: 16, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2 },
  flyerBack: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: spacing.lg, gap: spacing.sm },
  flyerImg: { flex: 1, width: '100%', maxWidth: 420, alignSelf: 'center' },
  flyerButtons: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg },
  actions: { flexDirection: 'row', gap: spacing.sm },
  body: { paddingBottom: spacing.xl },
  info: { padding: spacing.lg, gap: spacing.sm },
  code: { fontSize: 16, fontWeight: '800' },
  title: { fontSize: 22, fontWeight: '700' },
  price: { fontSize: 24, fontWeight: '800' },
  row: { fontSize: 16 },
});
