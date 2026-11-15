import React, { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { currentLang } from '../auth';
import { Button } from '../components/Button';
import { EmptyView, Loading } from '../components/StateViews';
import { filterContacts, loadContacts, type PhoneContact } from '../contacts';
import { t } from '../i18n';
import type { RootStackParams } from '../navigation';
import { radius, spacing, useTheme } from '../theme';

/** Pick a person from the phone's contacts to start a new lead. Only the name and number are used. */
export function ContactsScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const [list, setList] = useState<PhoneContact[] | null | undefined>(undefined);
  const [text, setText] = useState('');
  useEffect(() => {
    loadContacts().then(setList).catch(() => setList(null));
  }, []);

  if (list === undefined) return <Loading label={t(lang, 'loading')} />;
  if (list === null) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <Text style={[styles.msg, { color: colors.text }]}>{t(lang, 'contactsDenied')}</Text>
        <Button label={t(lang, 'openSettings')} onPress={() => { Linking.openSettings().catch(() => undefined); }} />
      </View>
    );
  }
  const shown = filterContacts(list, text);
  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <TextInput testID="contacts-search" style={[styles.search, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]} value={text} onChangeText={setText} placeholder={t(lang, 'searchContacts')} placeholderTextColor={colors.muted} autoCorrect={false} />
      <FlashList
        data={shown}
        keyExtractor={(c) => c.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button" testID={`contact-${item.id}`} onPress={() => nav.navigate('NewLead', { name: item.name, phone: item.phone })} style={[styles.row, { borderColor: colors.border }]}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{item.name || item.phone}</Text>
            <Text style={{ color: colors.muted }}>{item.phone}</Text>
          </Pressable>
        )}
        ListEmptyComponent={<EmptyView title={t(lang, 'noContacts')} hint={t(lang, 'noContactsHint')} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.lg },
  msg: { fontSize: 16, textAlign: 'center' },
  search: { margin: spacing.lg, minHeight: 48, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.lg, fontSize: 16 },
  row: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, gap: 2 },
  name: { fontSize: 16, fontWeight: '600' },
});
