import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../api';
import { currentLang } from '../auth';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { EmptyView, ErrorView, Loading } from '../components/StateViews';
import { errorText } from '../errors';
import type { RootStackParams } from '../navigation';
import { ot } from '../ownerText';
import { useRights } from '../rights';
import { t } from '../i18n';
import { useDebounced } from '../useDebounced';
import { radius, spacing, useTheme } from '../theme';

/** Unit owners: the same list and rules as the website (the server decides who sees which owner and phone). */
export function OwnersScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const rights = useRights();
  const [q, setQ] = useState('');
  const term = useDebounced(q, 300);
  const list = useInfiniteQuery({
    queryKey: ['owners', term],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api.owners({ q: term, page: pageParam }),
    getNextPageParam: (last, all) => (last.more ? all.length : undefined),
  });
  const renames = useQuery({ queryKey: ['ownerRenames'], queryFn: () => api.ownerRenames(), enabled: rights.manager || rights.agencyOwner });
  if (list.isError) return <ErrorView message={errorText(list.error, lang)} retryLabel={t(lang, 'retry')} onRetry={async () => { await list.refetch(); }} />;
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <View style={styles.pad}><Field label={ot(lang, 'search')} value={q} onChangeText={setQ} testID="owner-search" /></View>
      {renames.data?.items.length ? <RenameRequests items={renames.data.items} /> : null}
      {list.isPending ? <Loading label={t(lang, 'loading')} /> : (
        <FlashList
          data={items}
          keyExtractor={(o) => o.id}
          onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
          ListEmptyComponent={<EmptyView title={ot(lang, 'none')} />}
          renderItem={({ item }) => (
            <Pressable testID={`owner-${item.id}`} accessibilityRole="button" onPress={() => nav.navigate('Owner', { id: item.id, name: item.name || ot(lang, 'noName') })} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.name, { color: colors.text }]}>{item.name || ot(lang, 'noName')}{item.is_private ? ' ⭐' : ''}</Text>
              <Text style={{ color: colors.muted }}>{item.code} · {item.unit_count} {ot(lang, 'unit')}</Text>
              {item.phones?.length ? <Text style={{ color: colors.muted }}>{item.phones.map((p) => `+${p}`).join(' · ')}</Text> : null}
              {item.flag ? <Text style={{ color: colors.danger }}>⚠️ {item.flag}</Text> : null}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

function RenameRequests({ items }: { items: { id: number; code: string; old_value: string | null; new_value: string }[] }) {
  const { colors } = useTheme();
  const lang = currentLang();
  const qc = useQueryClient();
  const decide = async (id: number, ok: boolean) => {
    await api.decideRename(id, ok).catch((e) => Alert.alert(errorText(e, lang)));
    await qc.invalidateQueries({ queryKey: ['ownerRenames'] });
    await qc.invalidateQueries({ queryKey: ['owners'] });
  };
  return (
    <View testID="rename-requests" style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.name, { color: colors.text }]}>📝 {ot(lang, 'renames')} ({items.length})</Text>
      {items.map((r) => (
        <View key={r.id} style={styles.gap}>
          <Text style={{ color: colors.text }}>{r.code} · {r.old_value || '—'} → {r.new_value}</Text>
          <View style={styles.row}>
            <Button testID={`rename-ok-${r.id}`} label={ot(lang, 'approve')} onPress={() => decide(r.id, true)} />
            <Button label={ot(lang, 'decline')} variant="secondary" onPress={() => decide(r.id, false)} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** One owner: details, units, history; edit (when allowed), VIP (agency owner), delete (manager). */
export function OwnerScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const rights = useRights();
  const qc = useQueryClient();
  const id = useRoute<RouteProp<RootStackParams, 'Owner'>>().params.id;
  const q = useQuery({ queryKey: ['owner', id], queryFn: () => api.owner(id) });
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', flag: '', notes: '' });
  const [msg, setMsg] = useState<string | null>(null);
  if (q.isPending) return <Loading label={t(lang, 'loading')} />;
  if (q.isError) return <ErrorView message={errorText(q.error, lang)} retryLabel={t(lang, 'retry')} onRetry={async () => { await q.refetch(); }} />;
  const { owner, events, lead } = q.data;
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setMsg(null);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ['owner', id] });
      await qc.invalidateQueries({ queryKey: ['owners'] });
      if (ok) setMsg(ok);
    } catch (e) {
      setMsg(errorText(e, lang));
    }
  };
  const startEdit = () => {
    setForm({ name: owner.name ?? '', phone: owner.phones[0] ?? '', flag: owner.flag ?? '', notes: owner.notes ?? '' });
    setEditing(true);
  };
  const save = () => run(async () => {
    const r = await api.editOwner(id, form);
    setEditing(false);
    setMsg(r.nameRequested ? ot(lang, 'renameSent') : ot(lang, 'saved'));
  });
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.pad}>
      <Text style={[styles.title, { color: colors.text }]}>{owner.name || ot(lang, 'noName')} {owner.is_private ? '⭐' : ''}</Text>
      <Text style={{ color: colors.muted }}>{owner.code} · {owner.phones.map((p) => `+${p}`).join(' · ')}</Text>
      {owner.flag ? <Text style={{ color: colors.danger }}>⚠️ {owner.flag}</Text> : null}
      {owner.notes ? <Text style={{ color: colors.text }}>{owner.notes}</Text> : null}
      {lead ? <Pressable onPress={() => nav.navigate('Lead', { ref: `L-${String(lead.ref).padStart(4, '0')}` })}><Text style={{ color: colors.primary }}>🔗 {ot(lang, 'alsoLead')}: L-{String(lead.ref).padStart(4, '0')}</Text></Pressable> : null}
      {msg ? <Text testID="owner-msg" style={{ color: colors.muted }}>{msg}</Text> : null}
      <Text style={[styles.name, { color: colors.text }]}>{ot(lang, 'units')}</Text>
      {owner.units.map((u) => (
        <Pressable key={u.code} accessibilityRole="button" onPress={() => nav.navigate('Unit', { code: u.code })}><Text style={{ color: colors.primary }}>{u.code} · {u.compound ?? ''} · {u.status}{u.is_private ? ' 🔒' : ''}</Text></Pressable>
      ))}
      {rights.agencyOwner ? (
        <Button testID="owner-vip" variant="secondary" label={`⭐ ${owner.is_private ? ot(lang, 'vipOff') : ot(lang, 'vipOn')}`} onPress={() => run(() => api.ownerPrivate(id, !owner.is_private, owner.units.map((u) => u.code)))} />
      ) : null}
      {owner.canEdit && !editing ? <Button testID="owner-edit" variant="secondary" label={ot(lang, 'edit')} onPress={startEdit} /> : null}
      {editing ? (
        <View style={styles.gap}>
          <Field label={ot(lang, 'name')} value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} testID="owner-name" />
          <Field label={ot(lang, 'phone')} value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} keyboardType="phone-pad" />
          <Field label={ot(lang, 'flag')} value={form.flag} onChangeText={(v) => setForm({ ...form, flag: v })} />
          <Field label={ot(lang, 'notes')} value={form.notes} onChangeText={(v) => setForm({ ...form, notes: v })} multiline />
          <Button testID="owner-save" label={ot(lang, 'save')} onPress={save} />
        </View>
      ) : null}
      {owner.canEdit && rights.manager ? (
        <Button testID="owner-delete" variant="secondary" label={`🗑 ${ot(lang, 'del')}`} onPress={() => Alert.alert(ot(lang, 'delAsk'), undefined, [{ text: ot(lang, 'del'), style: 'destructive', onPress: () => { run(async () => { await api.deleteOwner(id); nav.goBack(); }).catch(() => {}); } }, { text: 'OK', style: 'cancel' }])} />
      ) : null}
      <Text style={[styles.name, { color: colors.text }]}>{ot(lang, 'history')}</Text>
      {events.map((e, i) => (
        <Text key={i} style={{ color: colors.muted }}>{new Date(e.created_at).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB')} · {e.kind}{e.data && (e.data as { code?: string }).code ? ` ${(e.data as { code?: string }).code}` : ''}{e.broker_name ? ` · ${e.broker_name}` : ''}</Text>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pad: { padding: spacing.lg, gap: spacing.md },
  gap: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md },
  card: { marginHorizontal: spacing.lg, marginTop: spacing.sm, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
  name: { fontSize: 16, fontWeight: '700' },
  title: { fontSize: 20, fontWeight: '800' },
});
