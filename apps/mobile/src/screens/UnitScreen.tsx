import React, { useState } from 'react';
import { Alert, Linking, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { formatEgp } from '@wehdathub/shared';
import { api } from '../api';
import { currentLang } from '../auth';
import { Button } from '../components/Button';
import { PhotoGallery } from '../components/PhotoGallery';
import { ErrorView, Loading } from '../components/StateViews';
import { errorText } from '../errors';
import { t } from '../i18n';
import type { RootStackParams } from '../navigation';
import { spacing, useTheme } from '../theme';

export function UnitScreen({ code }: { code?: string } = {}) {
  const { colors } = useTheme();
  const lang = currentLang();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const routeCode = useRoute<NativeStackScreenProps<RootStackParams, 'Unit'>['route']>().params?.code;
  const unitCode = code ?? routeCode ?? '';
  const unit = useQuery({ queryKey: ['unit', unitCode], queryFn: () => api.unit(unitCode) });
  // The owner's number comes only when the agency's privacy rules let this broker see it; otherwise the buttons stay hidden.
  const contact = useQuery({ queryKey: ['unit', unitCode, 'contact'], queryFn: () => api.unitContact(unitCode), retry: false, enabled: unit.isSuccess });
  const [sharing, setSharing] = useState(false);
  const shareLink = async () => {
    setSharing(true);
    try {
      const { url } = await api.unitShareLink(unitCode, lang);
      await Share.share({ message: url });
    } catch {
      Alert.alert(t(lang, 'linkFailed'));
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
    ['', [u.finishing, u.furnishing].filter(Boolean).join(' · ') || null],
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
            <View style={styles.flex}><Button testID="whatsapp-owner" variant="secondary" label={`💬 ${t(lang, 'whatsappOwner')}`} onPress={() => { Linking.openURL(`https://wa.me/${waNumber(contact.data?.phone ?? '')}`).catch(() => undefined); }} /></View>
          </View>
        ) : null}
        {u.status === 'active' ? <Button testID="share-link" label={t(lang, 'shareLink')} loading={sharing} onPress={shareLink} /> : null}
        <Button testID="share-unit" variant="secondary" label={t(lang, 'shareUnit')} onPress={() => { Share.share({ message: [u.code, u.compound, u.price !== null ? `${formatEgp(u.price)} ${t(lang, 'egp')}` : null, [u.bedrooms !== null ? `${u.bedrooms} ${t(lang, 'beds')}` : null, u.area !== null ? `${Math.round(u.area)} ${t(lang, 'sqm')}` : null].filter(Boolean).join(' · ')].filter(Boolean).join('\n') }).catch(() => undefined); }} />
        {u.features.length ? <Text style={[styles.row, { color: colors.text }]}>{t(lang, 'features')}: {u.features.join(' · ')}</Text> : null}
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
  actions: { flexDirection: 'row', gap: spacing.sm },
  body: { paddingBottom: spacing.xl },
  info: { padding: spacing.lg, gap: spacing.sm },
  code: { fontSize: 16, fontWeight: '800' },
  title: { fontSize: 22, fontWeight: '700' },
  price: { fontSize: 24, fontWeight: '800' },
  row: { fontSize: 16 },
});
