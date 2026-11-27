import React, { useState } from 'react';
import { AppText as Text } from './AppText';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { currentLang } from '../auth';
import { errorText } from '../errors';
import { t } from '../i18n';
import { useTheme } from '../theme';
import { Button } from './Button';
import { Chips } from './Chips';
import { Sheet } from './Sheet';
import { toastError } from './Toast';
import { sx } from '../sharedStyles';

type Status = 'active' | 'sold' | 'archived';

/** Mark a unit available, sold or archived, or delete it (kept 10 days). The server decides who may. */
export function UnitLifecycle({ code, status, canDelete = true, canChangeStatus = true, children }: { code: string; status: Status; canDelete?: boolean; canChangeStatus?: boolean; children?: React.ReactNode }) {
  const lang = currentLang();
  const { colors } = useTheme();
  const nav = useNavigation();
  const qc = useQueryClient();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const after = async () => { await Promise.all([qc.invalidateQueries({ queryKey: ['unit', code] }), qc.invalidateQueries({ queryKey: ['units'] }), qc.invalidateQueries({ queryKey: ['today'] })]); };
  const change = async (s: Status) => {
    if (s === status) return;
    setBusy(true);
    setMsg(null);
    try {
      await api.unitStatus(code, s);
      await after();
    } catch (e) {
      setMsg(toastError(errorText(e, lang) || t(lang, 'unitStatusFail')));
    } finally {
      setBusy(false);
    }
  };
  const [asking, setAsking] = useState(false);
  const remove = () => setAsking(true);
  const doRemove = async () => {
    setAsking(false);
    try { await api.unitDelete(code); await after(); nav.goBack(); } catch (e) { setMsg(toastError(errorText(e, lang))); }
  };
  return (
    <>
      {canChangeStatus ? <>
        <Text style={[{ color: colors.text }, sx.fontWeight700]}>{t(lang, 'unitStatusTitle')}</Text>
        <Chips<Status> options={[{ value: 'active', label: t(lang, 'stActive') }, { value: 'sold', label: t(lang, 'stSold') }, { value: 'archived', label: t(lang, 'stArchived') }]} value={status} onChange={change} />
      </> : null}
      {msg ? <Text testID="unit-lifecycle-message" style={{ color: colors.danger }}>{msg}</Text> : null}
      {children}
      {canDelete ? <Button testID="unit-delete" variant="danger" label={`🗑 ${t(lang, 'unitDelete')}`} loading={busy} onPress={remove} /> : null}
      <Sheet visible={asking} onClose={() => setAsking(false)} title={t(lang, 'unitDelete')} testID="unit-delete-sheet">
        <Text style={{ color: colors.muted }}>{t(lang, 'unitDeleteAsk')}</Text>
        <Button testID="unit-delete-confirm" variant="danger" label={t(lang, 'unitDelete')} onPress={() => { doRemove(); }} />
        <Button testID="unit-delete-cancel" variant="secondary" label={t(lang, 'cancel')} onPress={() => setAsking(false)} />
      </Sheet>
    </>
  );
}
