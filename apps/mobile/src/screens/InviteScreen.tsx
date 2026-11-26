import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { AppText as Text } from '../components/AppText';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { currentLang } from '../auth';
import { Button } from '../components/Button';
import { Chips } from '../components/Chips';
import { Field } from '../components/Field';
import { errorText } from '../errors';
import { ot } from '../ownerText';
import { useRightsState } from '../rights';
import { spacing, useTheme } from '../theme';
import { toastError } from '../components/Toast';

type Role = 'broker' | 'manager' | 'team_lead' | 'data_entry';

/** Add a member: managers add brokers, team leads and data entry; only the agency owner adds managers. */
export function InviteScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const { rights, inviteRoles, workspace } = useRightsState();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<Role>('broker');
  const [msg, setMsg] = useState<string | null>(null);
  const allRoles: { value: Role; label: string }[] = [
    { value: 'broker', label: ot(lang, 'broker') },
    ...(rights.agencyOwner ? [{ value: 'manager' as Role, label: ot(lang, 'manager') }] : []),
    { value: 'team_lead', label: ot(lang, 'teamLead') },
    { value: 'data_entry', label: ot(lang, 'dataEntry') },
  ];
  const isTeamTier = workspace?.tier === 'team';
  const roles = Array.isArray(inviteRoles) && inviteRoles.length
    ? allRoles.filter((r) => inviteRoles.includes(r.value))
    : workspace?.tier === 'solo'
      ? []
      : isTeamTier
        ? allRoles.filter((r) => r.value === 'broker' || r.value === 'manager')
        : allRoles;
  const send = async () => {
    setMsg(null);
    try {
      const r = await api.invite({ name: name.trim(), phone: phone.trim(), role });
      await qc.invalidateQueries({ queryKey: ['team'] });
      setMsg(r.url ? `${ot(lang, 'linkReady')} ${r.url}` : ot(lang, 'done'));
    } catch (e) {
      setMsg(toastError(errorText(e, lang)));
    }
  };
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Field label={ot(lang, 'inviteName')} value={name} onChangeText={setName} testID="invite-name" />
      <Field label={ot(lang, 'invitePhone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" testID="invite-phone" />
      <Chips<Role> testID="invite-role" options={roles} value={role} onChange={setRole} />
      {msg ? <Text testID="invite-msg" selectable style={{ color: colors.text }}>{msg}</Text> : null}
      <Button testID="invite-send" label={ot(lang, 'send')} onPress={send} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: spacing.lg, gap: spacing.md } });
