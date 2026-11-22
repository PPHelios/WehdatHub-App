import { track } from '../analytics';
import React, { useState } from 'react';
import { timed, usage } from '../usage';
import { UnitLifecycle } from '../components/UnitLifecycle';
import { UnitPrivateForms } from '../components/UnitPrivateForms';
import { Image, Linking, Modal, ScrollView, Share, StyleSheet, View } from 'react-native';
import { AppText as Text } from '../components/AppText';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { ApiClientError, formatEgp } from '@wehdathub/shared';
import type { ApiUnitDetail, UnitStatus } from '@wehdathub/shared';
import { api } from '../api';
import { currentLang } from '../auth';
import { Button } from '../components/Button';
import { Chips } from '../components/Chips';
import { Field } from '../components/Field';
import { ClientLinkModal } from '../components/ClientLinkModal';
import { ShareMessageModal } from '../components/ShareMessageModal';
import { PhotoGallery } from '../components/PhotoGallery';
import { Pill } from '../components/Pill';
import { sharePhotos } from '../sharePhotos';
import { ErrorView, Loading } from '../components/StateViews';
import { errorText } from '../errors';
import { t } from '../i18n';
import { featureChip } from '../featureLabels';
import { ALL_TYPES, FINISHING, FURNISHING, labelOf } from '../unitOptions';
import type { RootStackParams } from '../navigation';
import { radius, spacing, useTheme } from '../theme';
import { clientLang } from '../prefs';
import { toast } from '../components/Toast';

type FlyerKind = 'dark' | 'light' | 'nobrand';

function ColleagueUnitEdit({ unit, edit }: { unit: ApiUnitDetail; edit: NonNullable<ApiUnitDetail['colleagueEdit']> }) {
  const lang = currentLang();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState(edit.version);
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState(unit.status);
  const [busy, setBusy] = useState(false);
  const start = () => {
    setVersion(edit.version);
    setPrice(unit.price === null ? '' : String(unit.price));
    setDescription(edit.description ?? '');
    setStatus(unit.status);
    setOpen(true);
  };
  const save = async () => {
    const nextPrice = price.trim() === '' ? null : Number(price);
    if (nextPrice !== null && (!Number.isFinite(nextPrice) || nextPrice <= 0)) {
      toast(lang === 'ar' ? 'اكتب سعر صحيح.' : 'Enter a valid price.', true);
      return;
    }
    setBusy(true);
    try {
      await api.editColleagueUnit(unit.code, {
        version,
        ...(nextPrice !== null && nextPrice !== unit.price ? { price: nextPrice } : {}),
        ...(description !== (edit.description ?? '') ? { description } : {}),
        ...(status !== unit.status ? { status } : {}),
      });
      setOpen(false);
      await Promise.all(['unit', 'units'].map((key) => qc.invalidateQueries({ queryKey: [key] })));
    } catch (e) {
      toast(errorText(e, lang), true);
      if (e instanceof ApiClientError && e.status === 409) {
        setOpen(false);
        await qc.invalidateQueries({ queryKey: ['unit', unit.code] });
      }
    } finally {
      setBusy(false);
    }
  };
  if (!open) return <Button testID="edit-colleague-unit" variant="secondary" label={t(lang, 'editUnit')} onPress={start} />;
  return <>
    <Field label={lang === 'ar' ? 'السعر' : 'Price'} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
    <Field label={lang === 'ar' ? 'الوصف' : 'Description'} value={description} onChangeText={setDescription} multiline />
    <Chips<UnitStatus> options={[
      { value: 'active', label: t(lang, 'stActive') },
      { value: 'sold', label: t(lang, 'stSold') },
      { value: 'archived', label: t(lang, 'stArchived') },
    ]} value={status} onChange={setStatus} />
    <Button testID="save-colleague-unit" label={t(lang, 'save')} onPress={save} loading={busy} />
    <Button label={t(lang, 'cancel')} variant="secondary" onPress={() => setOpen(false)} disabled={busy} />
  </>;
}

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
  // One flyer is made at a time: while one is being made, every flyer button is disabled and only the chosen one spins.
  const [flyerBusy, setFlyerBusy] = useState<FlyerKind | null>(null);
  const [sharingFlyer, setSharingFlyer] = useState(false);
  const [flyerKind, setFlyerKind] = useState<FlyerKind>('dark');
  const makeFlyer = async (kind: FlyerKind) => {
    setFlyerBusy(kind);
    try {
      setFlyer((await timed('flyer_make', () => api.unitFlyer(unitCode, kind === 'light' ? 'light' : 'dark', kind === 'nobrand', clientLang()), { kind })).url);
      setFlyerKind(kind);
    } catch (e) {
      toast(e instanceof ApiClientError && e.status === 503 ? t(lang, 'flyerBusy') : t(lang, 'flyerFailed'), true);
    } finally {
      setFlyerBusy(null);
    }
  };
  const shareFlyer = async () => {
    if (!flyer) return;
    setSharingFlyer(true);
    try {
      if ((await sharePhotos([flyer], '', 'flyer_share', { kind: flyerKind })) === 'failed') toast(t(lang, 'flyerFailed'), true);
    } finally {
      setSharingFlyer(false);
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
      toast(t(lang, 'serverError'), true);
    } finally {
      setAsking(false);
    }
  };
  const [msgOpen, setMsgOpen] = useState(false);
  const sendMessage = async (text: string) => {
    const imgs = unit.data?.images ?? [];
    const r = imgs.length ? await sharePhotos(imgs.slice(0, 6).map((i) => i.url), text, 'unit_share') : 'failed';
    if (r === 'failed') {
      // Pictures failed (logged in sharePhotos): say so, then still send the text.
      if (imgs.length) toast(t(lang, 'shareFailed'), true);
      await Share.share({ message: text }).catch(() => undefined);
    }
    setMsgOpen(false);
  };
  const shareLink = async (to: string) => {
    setSharing(true);
    setClientErr(null);
    try {
      const { url } = await timed('client_link', () => api.unitShareLink(unitCode, clientLang(), to || undefined), { kind: to ? 'to_client' : 'open' });
      setPickClient(false);
      const shared = await Share.share({ message: url });
      if (shared.action === Share.sharedAction) void track('link_shared');
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 422) setClientErr(t(lang, 'badRecipient'));
      else {
        setPickClient(false);
        toast(t(lang, 'linkFailed'), true);
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
        <View style={styles.head}>
          {u.dealType === 'sale' || u.dealType === 'rent' ? <Pill solid tone={u.dealType === 'rent' ? 'accent' : 'primary'} label={t(lang, u.dealType)} /> : null}
          <Text style={[styles.code, { color: colors.muted }]}>{u.code}</Text>
        </View>
        {u.compound || u.compoundEn || u.phase ? <Text testID="unit-place" style={[styles.title, { color: colors.text }]}>{[u.compound || u.compoundEn, lang === 'en' ? u.phaseEn : u.phase].filter(Boolean).join(' · ')}</Text> : null}
        {u.priceText ? <Text style={[styles.price, { color: colors.primaryInk }]}>{u.priceText}</Text> : u.price !== null ? <Text style={[styles.price, { color: colors.primaryInk }]}>{formatEgp(u.price)} {t(lang, 'egp')}</Text> : null}
        <View style={styles.chips}>
          {u.propertyType ? <Pill testID="unit-type" tone="primary" label={labelOf(ALL_TYPES, u.propertyType, lang) ?? ''} /> : null}
          {rows.slice(0, 3).filter(([, v]) => v).map(([k, v]) => <Pill key={k} label={`${v} ${k}`} />)}
        </View>
        {rows.slice(3).filter(([, v]) => v).map(([, v], i) => (
          <Text key={i} style={[styles.row, { color: colors.muted }]}>{v}</Text>
        ))}
        {contact.data?.phone ? (
          <View style={styles.actions}>
            <View style={styles.flex}><Button testID="call-owner" label={`${t(lang, 'callOwner')}`} onPress={() => { Linking.openURL(`tel:${contact.data?.phone}`).catch(() => undefined); }} /></View>
            <View style={styles.flex}><Button testID="whatsapp-owner" variant="whatsapp" label={`${t(lang, 'whatsappOwner')}`} onPress={() => { usage('whatsapp_tap', true, undefined, { kind: 'owner' }); Linking.openURL(`https://wa.me/${waNumber(contact.data?.phone ?? '')}`).catch(() => undefined); }} /></View>
          </View>
        ) : null}
        {hidden === 'pending' ? <Text testID="access-pending" style={{ color: colors.muted }}>{t(lang, 'accessPending')}</Text> : null}
        {hidden === 'ask' ? <Button testID="request-access" variant="secondary" label={t(lang, 'requestAccess')} loading={asking} onPress={requestAccess} /> : null}
        <Button testID="flyer" variant="secondary" label={`${t(lang, 'flyer')}`} loading={flyerBusy === 'dark'} disabled={flyerBusy !== null} onPress={() => makeFlyer('dark')} />
        <Button testID="flyer-light" variant="secondary" label={`${t(lang, 'flyer')} · ${t(lang, 'flyerLight')}`} loading={flyerBusy === 'light'} disabled={flyerBusy !== null} onPress={() => makeFlyer('light')} />
        <Button testID="flyer-nobrand" variant="secondary" label={`${t(lang, 'flyer')} · ${t(lang, 'flyerNoBrand')}`} loading={flyerBusy === 'nobrand'} disabled={flyerBusy !== null} onPress={() => makeFlyer('nobrand')} />
        {flyer ? (
          <Modal visible transparent animationType="fade" onRequestClose={() => setFlyer(null)}>
            <View style={[styles.flyerBack, { paddingTop: spacing.xl, paddingBottom: 64 /* clears the system navigation bar */ }]}>
              <Image testID="flyer-image" source={{ uri: flyer }} style={styles.flyerImg} resizeMode="contain" />
              {/* The buttons sit on a solid card so they read on any theme and clear the system navigation bar. */}
              <View style={[styles.flyerButtons, { backgroundColor: colors.bg }]}>
                <Button testID="flyer-share" label={t(lang, 'shareFlyer')} loading={sharingFlyer} disabled={sharingFlyer} onPress={shareFlyer} />
                <Button label={t(lang, 'closePanel')} variant="secondary" onPress={() => setFlyer(null)} />
              </View>
            </View>
          </Modal>
        ) : null}
        {u.canEdit ? <Button testID="edit-unit" variant="secondary" label={`${t(lang, 'editUnit')}`} onPress={() => nav.navigate('AddUnit', { edit: u.code })} /> : null}
        {u.canEditColleague && u.colleagueEdit ? <ColleagueUnitEdit unit={u} edit={u.colleagueEdit} /> : null}
        {u.canEdit || u.canDelete ? <UnitLifecycle code={u.code} status={u.status} canChangeStatus={u.canEdit} canDelete={u.canDelete ?? u.canEdit} /> : null}
        {(u.canManagePrivate ?? u.canEdit) ? <UnitPrivateForms code={u.code} prefill={routeParams?.lease} /> : null}
        <Button testID="share-link" label={t(lang, 'shareLink')} onPress={() => { setClientErr(null); setPickClient(true); }} />
        <ClientLinkModal visible={pickClient} busy={sharing} error={clientErr} onSubmit={shareLink} onCancel={() => setPickClient(false)} />
        <Button
          testID="share-unit"
          variant="secondary"
          label={`${t(lang, 'shareUnit')}`}
          onPress={() => setMsgOpen(true)}
        />
        <ShareMessageModal visible={msgOpen} code={u.code} startLang={clientLang()} lang={lang} onSend={sendMessage} onCancel={() => setMsgOpen(false)} />
        {u.features.length ? (
          <View testID="features" style={styles.featBox}>
            <Text style={[styles.featTitle, { color: colors.text }]}>{t(lang, 'features')}</Text>
            <View style={styles.chips}>
              {u.features.map((k) => {
                const f = featureChip(k, lang);
                return (
                  <View key={f.key} style={[styles.chip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={{ color: colors.text }}>{f.label}</Text>
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
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  body: { paddingBottom: spacing.xl },
  info: { padding: spacing.lg, gap: spacing.sm },
  code: { fontSize: 16, fontWeight: '800' },
  title: { fontSize: 22, fontWeight: '700' },
  price: { fontSize: 24, fontWeight: '800' },
  row: { fontSize: 16 },
});
