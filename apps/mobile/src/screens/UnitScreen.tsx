import { track } from '../analytics';
import React, { useState } from 'react';
import { timed, usage } from '../usage';
import { UnitLifecycle } from '../components/UnitLifecycle';
import { UnitPrivateForms } from '../components/UnitPrivateForms';
import { Image, Linking, Modal, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { AppText as Text } from '../components/AppText';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { ApiClientError, currencyLabel, formatUnitPrice, looksLikePhone } from '@wehdathub/shared';
import type { ApiUnitDetail, UnitStatus } from '@wehdathub/shared';
import { api } from '../api';
import { currentLang } from '../auth';
import { Button } from '../components/Button';
import { Chips } from '../components/Chips';
import { Field } from '../components/Field';
import { LeadPicker } from '../components/LeadPicker';
import { useRights } from '../rights';
import type { ApiLead } from '@wehdathub/shared';
import { waNumber } from '../components/ContactRow';
import { ClientLinkModal } from '../components/ClientLinkModal';
import { ShareMessageModal } from '../components/ShareMessageModal';
import { PhotoGallery } from '../components/PhotoGallery';
import { Chevron, Icon } from '../components/Icon';
import type { IconName } from '../components/Icon';
import { MAX_WIDTH } from '../layout';
import { PhoneText } from '../components/PhoneText';
import { Pill } from '../components/Pill';
import { Chip } from '../components/Chip';
import { Section } from '../components/Section';
import { sharePhotos } from '../sharePhotos';
import { ErrorView, Loading } from '../components/StateViews';
import { errorText } from '../errors';
import { t } from '../i18n';
import { featureChip } from '../featureLabels';
import { ALL_TYPES, FINISHING, FURNISHING, labelOf } from '../unitOptions';
import type { RootStackParams } from '../navigation';
import { wantsRtl } from '../direction';
import { greenGradient, radius, spacing, typeScale, useTheme } from '../theme';
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
  const priceLabel = `${lang === 'ar' ? 'السعر' : 'Price'} (${currencyLabel(unit.currency, lang)})`;
  return <>
    <Field label={priceLabel} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
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
  const rights = useRights();
  const [pickLead, setPickLead] = useState(false);
  const [recipient, setRecipient] = useState<ApiLead | null>(null);
  const [leadSharing, setLeadSharing] = useState(false);
  const sendToLead = async () => {
    if (!recipient || leadSharing) return;
    setLeadSharing(true);
    try {
      const { url } = await api.leadSend(recipient.ref, unitCode, recipient.lang ?? clientLang());
      await Linking.openURL(url);
      setPickLead(false);
      setRecipient(null);
    } catch {
      toast(t(lang, 'linkFailed'), true);
    } finally {
      setLeadSharing(false);
    }
  };
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

  const back = !code ? (
    <Pressable testID="unit-back" accessibilityRole="button" accessibilityLabel={t(lang, 'awayBack')} style={[styles.circle, styles.heroButton]} onPress={() => nav.goBack()}>
      <Chevron color={colors.onPrimary} rtl={!wantsRtl(lang)} />
    </Pressable>
  ) : null;
  if (unit.isPending || unit.isError) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.bg }]}>
        {back ? <View style={styles.loadingBack}>{back}</View> : null}
        {unit.isPending
          ? <Loading label={t(lang, 'loading')} />
          : <ErrorView message={errorText(unit.error, lang)} retryLabel={t(lang, 'retry')} onRetry={() => unit.refetch()} />}
      </View>
    );
  }

  const u = unit.data;
  const ar = lang === 'ar';
  const propertyType = labelOf(ALL_TYPES, u.propertyType, lang);
  const finishing = labelOf(FINISHING, u.finishing, lang);
  const furnishing = labelOf(FURNISHING, u.furnishing, lang);
  const compound = (ar ? u.compound || u.compoundEn : u.compoundEn || u.compound);
  const phase = ar ? u.phase || u.phaseEn : u.phaseEn || u.phase;
  const placeName = [...new Set([compound, phase].filter(Boolean))].join(' · ');
  const title = u.title?.trim() || placeName || propertyType || u.code;
  const place = [...new Set([title !== placeName ? placeName : null, u.district, u.city].filter(Boolean))].join(' · ');
  const price = formatUnitPrice(u.price, {
    currency: u.currency,
    lang,
    dealType: u.dealType,
    rentPeriod: u.rentPeriod,
    fallbackText: u.priceText,
  });
  const facts: { label: string; value: string | null; icon: IconName }[] = [
    { label: t(lang, 'fBedrooms'), value: u.bedrooms == null ? null : String(u.bedrooms), icon: 'bed' },
    { label: t(lang, 'fBathrooms'), value: u.bathrooms == null ? null : String(u.bathrooms), icon: 'bath' },
    { label: t(lang, 'fArea'), value: u.area == null ? null : String(Math.round(u.area)), icon: 'area' },
  ];
  const availableFacts = facts.filter((fact) => fact.value !== null);
  const phone = contact.data?.phone;
  const contactName = contact.data?.name?.trim();
  const nameIsPhone = Boolean(contactName && looksLikePhone(contactName));
  const ownerName = nameIsPhone ? undefined : contactName;
  const ownerNumber = phone || (nameIsPhone ? contactName : undefined);
  const ownerTextDirection = ar ? styles.ownerTextAr : styles.ownerTextEn;
  const ownerInitials = ownerName?.split(/\s+/).slice(0, 2).map((word) => Array.from(word)[0]).join('').toUpperCase();
  const openClientLink = () => { setClientErr(null); setPickClient(true); };
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.body}>
      <View style={[styles.hero, { backgroundColor: colors.cardSubtle }]}>
        {u.images.length ? <PhotoGallery photos={u.images} closeLabel={t(lang, 'closePanel')} hero /> : (
          <View testID="unit-no-photos" style={styles.noPhotos}>
            <Icon name="units" color={colors.muted} size={36} />
          </View>
        )}
        <View pointerEvents="box-none" style={styles.heroActions}>
          {back ?? <View />}
          <Pressable testID="share-unit" accessibilityRole="button" accessibilityLabel={t(lang, 'shareUnit')} style={[styles.circle, styles.heroButton]} onPress={() => setMsgOpen(true)}>
            <Icon name="share" color={colors.onPrimary} size={21} />
          </Pressable>
        </View>
      </View>
      <View style={[styles.info, { backgroundColor: colors.card }]}>
        {ownerNumber || ownerName ? (
          <View testID="unit-owner" style={[styles.owner, { backgroundColor: colors.cardSubtle, borderColor: colors.border }]}>
            <View style={[styles.circle, greenGradient]}>
              {ownerInitials ? <Text variant="bodySm" weight="bold" style={{ color: colors.onPrimary }} numberOfLines={1}>{ownerInitials}</Text> : <Icon name="owners" color={colors.onPrimary} size={20} />}
            </View>
            <View style={styles.flex}>
              <Text variant="bodySm" weight="bold" style={[ownerTextDirection, { color: colors.text }]}>{ownerName || t(lang, 'unitOwnerGeneric')}</Text>
              {ownerNumber ? <PhoneText testID="owner-phone" value={ownerNumber} style={[styles.caption, ownerTextDirection, { color: colors.muted }]} /> : null}
            </View>
            {phone ? (
              <>
                <Pressable testID="call-owner" accessibilityRole="button" accessibilityLabel={t(lang, 'callOwner')} style={[styles.circle, { backgroundColor: colors.primarySoft }]} onPress={() => { Linking.openURL(`tel:${phone}`).catch(() => undefined); }}>
                  <Icon name="phone" color={colors.primaryInk} size={20} />
                </Pressable>
                <Pressable testID="whatsapp-owner" accessibilityRole="button" accessibilityLabel={t(lang, 'whatsappOwner')} style={[styles.circle, greenGradient]} onPress={() => { usage('whatsapp_tap', true, undefined, { kind: 'owner' }); Linking.openURL(`https://wa.me/${waNumber(phone)}`).catch(() => undefined); }}>
                  <Icon name="chat" color={colors.onPrimary} size={20} />
                </Pressable>
              </>
            ) : null}
          </View>
        ) : null}
        {hidden === 'pending' ? <Text testID="access-pending" style={{ color: colors.muted }}>{t(lang, 'accessPending')}</Text> : null}
        {hidden === 'ask' ? <Button testID="request-access" variant="secondary" label={t(lang, 'requestAccess')} loading={asking} onPress={requestAccess} /> : null}
        <View style={styles.section}>
          <View style={styles.chips}>
            {u.dealType === 'sale' || u.dealType === 'rent' ? <Pill tone="primary" label={t(lang, u.dealType)} /> : null}
            {propertyType ? <Pill testID="unit-type" tone="primary" label={propertyType} /> : null}
            {title !== u.code ? <Pill testID="unit-code" tone="primary" label={u.code} /> : null}
            {finishing ? <Pill testID="unit-finishing" tone="primary" label={finishing} /> : null}
          </View>
          <Text variant="title" accessibilityRole="header" testID="unit-place" style={{ color: colors.text }}>{title}</Text>
          {place ? <View style={styles.place}>
            <Icon name="pin" color={colors.primaryInk} size={16} />
            <Text variant="caption" style={[styles.flex, { color: colors.muted }]}>{place}</Text>
          </View> : null}
          {price ? <Text variant="title" testID="unit-price" style={{ color: colors.primaryInk }}>{price}</Text> : null}
        </View>
        {availableFacts.length ? <View testID="unit-facts" style={[styles.facts, { backgroundColor: colors.cardSubtle, borderColor: colors.border }]}>
          {availableFacts.map(({ icon, label, value }, i) => (
            <View key={icon} style={[styles.fact, i > 0 && { borderStartWidth: StyleSheet.hairlineWidth, borderStartColor: colors.border }]}>
              <Icon name={icon} color={colors.primaryInk} size={18} />
              <Text variant="bodySm" weight="bold" style={[styles.centered, { color: colors.text }]}>{value}</Text>
              <Text variant="caption" style={[styles.centered, { color: colors.muted }]}>{label}</Text>
            </View>
          ))}
        </View> : null}
        {furnishing ? <Text variant="caption" style={{ color: colors.muted }}>{furnishing}</Text> : null}
        {u.features.length ? (
          <View testID="features" style={styles.section}>
            <Text variant="bodySm" weight="bold" accessibilityRole="header" style={{ color: colors.text }}>{t(lang, 'features')}</Text>
            <View style={styles.chips}>
              {u.features.map((k) => {
                const f = featureChip(k, lang);
                return <Chip key={f.key} label={f.label} style={styles.chip} />;
              })}
            </View>
          </View>
        ) : null}
        <Button testID="share-link" label={t(lang, 'shareLink')} onPress={openClientLink} />
        {rights.leads && u.status === 'active' ? <Button testID="unit-send-to-lead" variant="secondary" label={lang === 'ar' ? 'ابعت الوحدة لعميل' : 'Send unit to a lead'} onPress={() => { setRecipient(null); setPickLead(true); }} /> : null}
        {flyer ? (
          <Modal visible transparent animationType="fade" onRequestClose={() => setFlyer(null)}>
            <View style={styles.flyerBack}>
              <Image testID="flyer-image" source={{ uri: flyer }} style={styles.flyerImg} resizeMode="contain" />
              {/* The buttons sit on a solid card so they read on any theme and clear the system navigation bar. */}
              <View style={[styles.flyerButtons, { backgroundColor: colors.bg }]}>
                <Button testID="flyer-share" label={t(lang, 'shareFlyer')} loading={sharingFlyer} disabled={sharingFlyer} onPress={shareFlyer} />
                <Button label={t(lang, 'closePanel')} variant="secondary" onPress={() => setFlyer(null)} />
              </View>
            </View>
          </Modal>
        ) : null}
        {(u.canManagePrivate ?? u.canEdit) ? <UnitPrivateForms code={u.code} prefill={routeParams?.lease} /> : null}
        <Modal visible={pickLead} onRequestClose={() => { if (!leadSharing) setPickLead(false); }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.leadModal, { backgroundColor: colors.bg }]}>
            {recipient ? <>
              <Text style={{ color: colors.text }}>{[unitCode, recipient.name, recipient.ref, recipient.phones[0] ? '•••' + recipient.phones[0].slice(-4) : null].filter(Boolean).join(' · ')}</Text>
              <Button testID="unit-confirm-lead-send" label={lang === 'ar' ? 'افتح واتساب للعميل ده' : 'Open WhatsApp for this lead'} loading={leadSharing} onPress={sendToLead} />
              <Button variant="secondary" label={lang === 'ar' ? 'اختار عميل تاني' : 'Choose another lead'} disabled={leadSharing} onPress={() => setRecipient(null)} />
            </> : <LeadPicker onPick={setRecipient} />}
            <Button variant="secondary" label={t(lang, 'cancel')} disabled={leadSharing} onPress={() => setPickLead(false)} />
          </ScrollView>
        </Modal>
        <ClientLinkModal visible={pickClient} busy={sharing} error={clientErr} onSubmit={shareLink} onCancel={() => setPickClient(false)} />
        <ShareMessageModal visible={msgOpen} code={u.code} startLang={clientLang()} lang={lang} onSend={sendMessage} onCancel={() => setMsgOpen(false)} />
        <Section testID="unit-flyers" title={t(lang, 'unitFlyersTitle')}>
          <Button testID="flyer" label={t(lang, 'unitFlyerBranded')} loading={flyerBusy === 'dark'} disabled={flyerBusy !== null} onPress={() => makeFlyer('dark')} />
          <View style={styles.flyerVariants}>
            <View style={styles.flex}><Button testID="flyer-light" size="sm" variant="secondary" label={t(lang, 'unitFlyerLight')} loading={flyerBusy === 'light'} disabled={flyerBusy !== null} onPress={() => makeFlyer('light')} /></View>
            <View style={styles.flex}><Button testID="flyer-nobrand" size="sm" variant="secondary" label={t(lang, 'flyerNoBrand')} loading={flyerBusy === 'nobrand'} disabled={flyerBusy !== null} onPress={() => makeFlyer('nobrand')} /></View>
          </View>
        </Section>
        {u.canEdit || u.canDelete || (u.canEditColleague && u.colleagueEdit) ? (
          <UnitLifecycle code={u.code} status={u.status} canChangeStatus={Boolean(u.canEdit)} canDelete={Boolean(u.canDelete ?? u.canEdit)}>
            {u.canEdit ? <Button testID="edit-unit" variant="secondary" label={`${t(lang, 'editUnit')}`} onPress={() => nav.navigate('AddUnit', { edit: u.code })} /> : null}
            {u.canEditColleague && u.colleagueEdit ? <ColleagueUnitEdit unit={u} edit={u.colleagueEdit} /> : null}
          </UnitLifecycle>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2 },
  // paddingBottom clears the system navigation bar.
  flyerBack: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: spacing.lg, paddingTop: spacing.xl, paddingBottom: 64, gap: spacing.sm },
  leadModal: { padding: spacing.xl, gap: spacing.md, flexGrow: 1 },
  centered: { textAlign: 'center' },
  flyerImg: { flex: 1, width: '100%', maxWidth: 420, alignSelf: 'center' },
  flyerButtons: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg },
  flyerVariants: { flexDirection: 'row', gap: spacing.sm },
  body: { flexGrow: 1, alignItems: 'center' },
  hero: { width: '100%', maxWidth: MAX_WIDTH },
  heroActions: { position: 'absolute', top: spacing.md, start: spacing.md, end: spacing.md, flexDirection: 'row', justifyContent: 'space-between' },
  heroButton: { backgroundColor: 'rgba(15,29,40,0.78)' },
  circle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  loadingBack: { padding: spacing.md, alignItems: 'flex-start' },
  noPhotos: { height: 132, alignItems: 'center', justifyContent: 'center' },
  info: { flexGrow: 1, width: '100%', maxWidth: MAX_WIDTH, marginTop: -20, borderTopStartRadius: 24, borderTopEndRadius: 24, padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.lg },
  owner: { direction: 'ltr', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderWidth: 1, borderRadius: radius.lg },
  ownerTextAr: { textAlign: 'right', writingDirection: 'rtl' },
  ownerTextEn: { textAlign: 'left', writingDirection: 'ltr' },
  place: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  caption: { fontSize: typeScale.caption.fontSize },
  facts: { flexDirection: 'row', borderWidth: 1, borderRadius: radius.lg, paddingVertical: spacing.md },
  fact: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xs, gap: 3 },
});
