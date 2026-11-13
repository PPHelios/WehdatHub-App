import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { api } from '../api';
import { currentLang } from '../auth';
import { errorText } from '../errors';
import { t } from '../i18n';
import { useTheme } from '../theme';
import { Button } from './Button';
import { Field } from './Field';

/** Saves the search just made (the server gave its filters token) under a name. */
export function SaveSearchButton({ f }: { f: string }) {
  const { colors } = useTheme();
  const lang = currentLang();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const save = async () => {
    try {
      await api.saveSearch(f, name);
      setMsg(t(lang, 'savedOk'));
      setOpen(false);
    } catch (e) {
      setMsg(errorText(e, lang));
    }
  };
  return (
    <View>
      {open ? (
        <>
          <Field testID="save-search-name" label={t(lang, 'savedSearchName')} value={name} onChangeText={setName} />
          <Button testID="save-search-go" label={t(lang, 'save')} onPress={save} disabled={!name.trim()} />
        </>
      ) : (
        <Button testID="save-search" variant="secondary" label={`⭐ ${t(lang, 'saveSearch')}`} onPress={() => { setMsg(null); setOpen(true); }} />
      )}
      {msg ? <Text style={{ color: colors.accent }}>{msg}</Text> : null}
    </View>
  );
}
