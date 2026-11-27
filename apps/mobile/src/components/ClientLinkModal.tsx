import React, { useEffect, useState } from 'react';
import { ltr } from '@wehdathub/shared';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText as Text } from './AppText';
import { currentLang } from '../auth';
import { filterContacts, loadContacts } from '../contacts';
import type { PhoneContact } from '../contacts';
import { t } from '../i18n';
import { radius, spacing, typeScale, useTheme } from '../theme';
import { Button } from './Button';
import { KeyboardLift } from './KeyboardLift';
import { Field } from './Field';

/** Asks who a client link is for: a lead code, a mobile number, a phone contact, or nobody. */
export function ClientLinkModal({ visible, busy, error, onSubmit, onCancel }: { visible: boolean; busy: boolean; error: string | null; onSubmit: (to: string) => void; onCancel: () => void }) {
  const { colors } = useTheme();
  const lang = currentLang();
  const [text, setText] = useState('');
  const [contacts, setContacts] = useState<PhoneContact[] | null>(null);
  const [denied, setDenied] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [q, setQ] = useState('');
  useEffect(() => {
    if (visible && contacts === null) loadContacts().then((c) => { setDenied(c === null); setContacts(c ?? []); }).catch(() => setContacts([]));
  }, [visible, contacts]);
  // Typing a name (not a code or number) shows matching phone contacts.
  const looksLikeName = /[^\d+\-\s()LlTt]/.test(text) && text.trim().length >= 2;
  const matches = looksLikeName && contacts ? filterContacts(contacts, text).slice(0, 5) : [];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardLift style={styles.back}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.h, { color: colors.text }]}>{t(lang, 'linkToClient')}</Text>
          <Field testID="client-to" label={t(lang, 'clientHint')} value={text} onChangeText={setText} autoCapitalize="characters" autoCorrect={false} />
          <Button testID="client-pick-contact" label={`📇 ${t(lang, 'pickContact')}`} variant="secondary" onPress={() => setListOpen((o) => !o)} />
          {listOpen && denied ? (
            <View style={styles.denied}>
              <Text style={{ color: colors.text }}>{t(lang, 'contactsDenied')}</Text>
              <Button label={t(lang, 'openSettings')} variant="secondary" onPress={() => { Linking.openSettings().catch(() => undefined); }} />
            </View>
          ) : null}
          {listOpen && !denied ? (
            <>
            <Field testID="client-contact-search" label={t(lang, 'searchContacts')} value={q} onChangeText={setQ} autoCorrect={false} />
            <ScrollView testID="client-contact-list" style={styles.list} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
              {(contacts ? filterContacts(contacts, q.trim() || (looksLikeName ? text : '')) : []).slice(0, 60).map((c) => (
                <Pressable key={c.id} accessibilityRole="button" onPress={() => { setText(c.phone); setListOpen(false); setQ(''); }} style={[styles.match, { borderColor: colors.border }]}>
                  <Text style={{ color: colors.text }}>{c.name ? `${c.name} · ` : ''}{ltr(c.phone)}</Text>
                </Pressable>
              ))}
            </ScrollView>
            </>
          ) : null}
          {!listOpen && matches.map((c) => (
            <Pressable key={c.id} accessibilityRole="button" onPress={() => setText(c.phone)} style={[styles.match, { borderColor: colors.border }]}>
              <Text style={{ color: colors.text }}>{c.name} · {ltr(c.phone)}</Text>
            </Pressable>
          ))}
          {error ? <Text testID="client-error" style={{ color: colors.danger }}>{error}</Text> : null}
          <Button testID="client-make" label={t(lang, 'sendLinkTo')} loading={busy} disabled={!text.trim()} onPress={() => onSubmit(text.trim())} />
          <Button testID="client-skip" label={t(lang, 'skipClient')} variant="secondary" disabled={busy} onPress={() => onSubmit('')} />
          <Button label={t(lang, 'cancel')} variant="secondary" onPress={onCancel} />
        </View>
      </KeyboardLift>
    </Modal>
  );
}

const styles = StyleSheet.create({
  back: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing.lg },
  card: { borderRadius: radius.md, padding: spacing.lg, gap: spacing.sm },
  h: { fontSize: typeScale.heading.fontSize, fontWeight: '700' },
  match: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  list: { maxHeight: 220 },
  denied: { gap: spacing.sm },
});
