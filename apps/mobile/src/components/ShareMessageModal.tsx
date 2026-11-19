import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from './AppText';
import type { Lang } from '@wehdathub/shared';
import { api } from '../api';
import { radius, spacing, useTheme } from '../theme';
import { Button } from './Button';
import { Chips } from './Chips';

/** The client message for a unit, shown before it is sent: the broker edits it or switches its language (the server writes both). */
export function ShareMessageModal({ visible, code, startLang, lang, onSend, onCancel }: { visible: boolean; code: string; startLang: Lang; lang: Lang; onSend: (text: string) => void | Promise<void>; onCancel: () => void }) {
  const { colors } = useTheme();
  const [msgLang, setMsgLang] = useState<Lang>(startLang);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const align = /[؀-ۿ]/.test(text.trim()[0] ?? '') ? ({ textAlign: 'right', writingDirection: 'rtl' } as const) : ({ textAlign: 'left', writingDirection: 'ltr' } as const);
  useEffect(() => {
    if (!visible) return;
    let live = true;
    setFailed(false);
    api.unitMessage(code, msgLang).then((r) => { if (live) setText(r.message); }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [visible, code, msgLang]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.back}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.h, { color: colors.text }]}>{lang === 'en' ? 'Message to the client' : 'الرسالة للعميل'}</Text>
          <Text style={{ color: colors.muted }}>{lang === 'en' ? 'Edit it before you send, or change its language.' : 'عدّلها قبل ما تبعت، أو غيّر لغتها.'}</Text>
          <Chips testID="msg-lang" options={[{ value: 'ar', label: 'العربية' }, { value: 'en', label: 'English' }]} value={msgLang} onChange={(v) => setMsgLang(v === 'en' ? 'en' : 'ar')} />
          <TextInput testID="msg-text" multiline value={text} onChangeText={setText} editable={!failed} style={[styles.box, align, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bg }]} />
          {failed ? <Text style={{ color: colors.danger }}>{lang === 'en' ? 'Could not load the message.' : 'مقدرتش أحمّل الرسالة.'}</Text> : null}
          <Button testID="msg-send" label={lang === 'en' ? 'Send' : 'ابعت'} loading={busy} disabled={busy || failed || !text.trim()} onPress={async () => { setBusy(true); try { await onSend(text.trim()); } finally { setBusy(false); } }} />
          <Button label={lang === 'en' ? 'Cancel' : 'إلغاء'} variant="secondary" onPress={onCancel} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  back: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing.lg },
  card: { borderRadius: radius.md, padding: spacing.lg, gap: spacing.sm },
  h: { fontSize: 18, fontWeight: '700' },
  box: { minHeight: 160, maxHeight: 320, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, fontSize: 15, textAlignVertical: 'top' },
});
