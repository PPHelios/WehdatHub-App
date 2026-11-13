import React, { useState } from 'react';
import { Alert, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { currentLang } from '../auth';
import { errorText } from '../errors';
import { t } from '../i18n';
import { useTheme } from '../theme';
import { Button } from './Button';
import { Chips } from './Chips';

type Status = 'active' | 'sold' | 'archived';

/** Mark a unit available, sold or archived, or delete it (kept 10 days). The server decides who may. */
export function UnitLifecycle({ code, status }: { code: string; status: Status }) {
  const lang = currentLang();
  const { colors } = useTheme();
  const nav = useNavigation();
  const qc = useQueryClient();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const after = async () => { await qc.invalidateQueries({ queryKey: ['unit', code] }); await qc.invalidateQueries({ queryKey: ['units'] }); };
  const change = async (s: Status) => {
    if (s === status) return;
    setBusy(true);
    setMsg(null);
    try {
      await api.unitStatus(code, s);
      await after();
    } catch (e) {
      setMsg(errorText(e, lang) || t(lang, 'unitStatusFail'));
    } finally {
      setBusy(false);
    }
  };
  const remove = () =>
    Alert.alert(t(lang, 'unitDelete'), t(lang, 'unitDeleteAsk'), [
      { text: t(lang, 'cancel'), style: 'cancel' },
      { text: t(lang, 'unitDelete'), style: 'destructive', onPress: async () => { try { await api.unitDelete(code); await after(); nav.goBack(); } catch (e) { setMsg(errorText(e, lang)); } } },
    ]);
  return (
    <>
      <Text style={{ color: colors.text, fontWeight: '700' }}>{t(lang, 'unitStatusTitle')}</Text>
      <Chips<Status> options={[{ value: 'active', label: t(lang, 'stActive') }, { value: 'sold', label: t(lang, 'stSold') }, { value: 'archived', label: t(lang, 'stArchived') }]} value={status} onChange={change} />
      <Button testID="unit-delete" variant="secondary" label={`🗑 ${t(lang, 'unitDelete')}`} loading={busy} onPress={remove} />
      {msg ? <Text testID="unit-lifecycle-message" style={{ color: colors.danger }}>{msg}</Text> : null}
    </>
  );
}
