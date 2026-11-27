import React from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import type { Lang } from '@wehdathub/shared';
import { t } from '../i18n';
import { greenGradient, radius, spacing, typeScale, useTheme } from '../theme';
import { usage } from '../usage';
import { Icon } from './Icon';
import { PhoneText } from './PhoneText';

/** The local Egyptian form becomes international digits for WhatsApp. */
export function waNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('0')) return `20${digits.slice(1)}`;
  return digits;
}

export function ContactRow({ phone, lang, kind, index = 0 }: { phone: string; lang: Lang; kind: 'owner' | 'lead'; index?: number }) {
  const { colors } = useTheme();
  const display = phone.startsWith('+') || kind === 'lead' ? phone : `+${phone}`;
  const phoneID = kind === 'lead' ? `lead-phone-${phone}` : `owner-phone-${index}`;
  const callID = kind === 'lead' ? `call-${phone}` : `owner-call-${index}`;
  const chatID = kind === 'lead' ? `whatsapp-${phone}` : `owner-whatsapp-${index}`;
  const callLabel = t(lang, kind === 'lead' ? 'call' : 'callOwner');
  const chatLabel = t(lang, kind === 'lead' ? 'whatsappClient' : 'whatsappOwner');
  return (
    <View style={[styles.row, { backgroundColor: colors.cardSubtle, borderColor: colors.border }]}>
      <PhoneText testID={phoneID} value={display} style={[styles.phone, { color: colors.text, textAlign: lang === 'ar' ? 'right' : 'left' }]} />
      <Pressable testID={callID} accessibilityRole="button" accessibilityLabel={`${callLabel} ${display}`}
        style={[styles.action, { backgroundColor: colors.primarySoft }]}
        onPress={() => {
          usage('call_tap', true, undefined, { kind });
          Linking.openURL(`tel:+${waNumber(phone)}`).catch(() => undefined);
        }}>
        <Icon name="phone" color={colors.primaryInk} size={20} />
      </Pressable>
      <Pressable testID={chatID} accessibilityRole="button" accessibilityLabel={`${chatLabel} ${display}`}
        style={[styles.action, greenGradient]}
        onPress={() => {
          usage('whatsapp_tap', true, undefined, { kind });
          Linking.openURL(`https://wa.me/${waNumber(phone)}`).catch(() => undefined);
        }}>
        <Icon name="chat" color={colors.onPrimary} size={20} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { direction: 'ltr', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.xs, paddingStart: spacing.md, borderWidth: 1, borderRadius: radius.md },
  phone: { flex: 1, minWidth: 0, fontSize: typeScale.bodySm.fontSize, fontVariant: ['tabular-nums'], writingDirection: 'ltr' },
  action: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
