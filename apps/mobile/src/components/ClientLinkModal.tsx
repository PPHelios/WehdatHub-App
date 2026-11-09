import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { currentLang } from '../auth';
import { filterContacts, loadContacts } from '../contacts';
import type { PhoneContact } from '../contacts';
import { t } from '../i18n';
import { radius, spacing, useTheme } from '../theme';
import { Button } from './Button';
import { Field } from './Field';

/** Asks who a client link is for: a lead code, a mobile number, a phone contact, or nobody. */
export function ClientLinkModal({ visible, busy, error, onSubmit, onCancel }: { visible: boolean; busy: boolean; error: string | null; onSubmit: (to: string) => void; onCancel: () => void }) {
  const { colors } = useTheme();
  const lang = currentLang();
  const [text, setText] = useState('');
  const [contacts, setContacts] = useState<PhoneContact[] | null>(null);
  useEffect(() => {
    if (visible && contacts === null) loadContacts().then((c) => setContacts(c ?? [])).catch(() => setContacts([]));
  }, [visible, contacts]);
  // Typing a name (not a code or number) shows matching phone contacts.
  const looksLikeName = /[^\d+\-\s()LlTt]/.test(text) && text.trim().length >= 2;
  const matches = looksLikeName && contacts ? filterContacts(contacts, text).slice(0, 5) : [];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.back}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.h, { color: colors.text }]}>{t(lang, 'linkToClient')}</Text>
          <Field testID="client-to" label={t(lang, 'clientHint')} value={text} onChangeText={setText} autoCapitalize="characters" autoCorrect={false} />
          {matches.map((c) => (
            <Pressable key={c.id} accessibilityRole="button" onPress={() => setText(c.phone)} style={[styles.match, { borderColor: colors.border }]}>
              <Text style={{ color: colors.text }}>{c.name} · {c.phone}</Text>
            </Pressable>
          ))}
          {error ? <Text testID="client-error" style={{ color: colors.danger }}>{error}</Text> : null}
          <Button testID="client-make" label={t(lang, 'sendLinkTo')} loading={busy} disabled={!text.trim()} onPress={() => onSubmit(text.trim())} />
          <Button testID="client-skip" label={t(lang, 'skipClient')} variant="secondary" disabled={busy} onPress={() => onSubmit('')} />
          <Button label={t(lang, 'cancel')} variant="secondary" onPress={onCancel} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  back: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing.lg },
  card: { borderRadius: radius.md, padding: spacing.lg, gap: spacing.sm },
  h: { fontSize: 18, fontWeight: '700' },
  match: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
});
