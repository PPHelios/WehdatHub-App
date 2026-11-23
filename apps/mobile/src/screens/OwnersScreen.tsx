import React, { useState } from 'react';
import { looksLikePhone, ltr, type Lang } from '@wehdathub/shared';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText as Text } from '../components/AppText';
import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../api';
import { currentLang } from '../auth';
import { Button } from '../components/Button';
import { ContactRow } from '../components/ContactRow';
import { Chevron, Icon } from '../components/Icon';
import { InitialAvatar } from '../components/InitialAvatar';
import { PhoneText } from '../components/PhoneText';
import { Pill } from '../components/Pill';
import { Section } from '../components/Section';
import { TimelineEntry } from '../components/TimelineEntry';
import { Field } from '../components/Field';
import { EmptyView, ErrorView, Loading } from '../components/StateViews';
import { errorText } from '../errors';
import type { RootStackParams } from '../navigation';
import { ot } from '../ownerText';
import { useRights } from '../rights';
import { t } from '../i18n';
import { UNIT_STATUS, labelOf } from '../unitOptions';
import { useDebounced } from '../useDebounced';
import { radius, spacing, useTheme } from '../theme';
import { toast, toastError } from '../components/Toast';

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
      {list.isPending ? <Loading label={t(lang, 'loading')} /> : (
        <FlashList
          data={items}
          keyExtractor={(o) => o.id}
          ListHeaderComponent={renames.data?.items.length ? <RenameRequests items={renames.data.items} /> : null}
          onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
          ListEmptyComponent={<EmptyView title={ot(lang, 'none')} />}
          renderItem={({ item }) => (
            <Pressable testID={`owner-${item.id}`} accessibilityRole="button" onPress={() => nav.navigate('Owner', { id: item.id, name: item.name || ot(lang, 'noName') })}
              style={({ pressed }) => [styles.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.84 : 1 }]}>
              <View style={styles.identity}>
                <InitialAvatar name={item.name} />
                <View style={styles.person}>
                  <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>{item.name || ot(lang, 'noName')}</Text>
                  <View style={styles.chips}>
                    {item.code ? <Pill tone="primary" label={item.code} /> : null}
                    {item.is_private ? <Pill tone="accent" label={ot(lang, 'vip')} /> : null}
                  </View>
                  <Text style={[styles.caption, { color: colors.muted }]}>{item.unit_count} ${ot(lang, 'unit')}</Text>
                  {item.phones?.length ? <Text style={[styles.caption, { color: colors.muted }]}>{item.phones.map((phone) => item.phones_masked ? phone : ltr(phone.startsWith('+') ? phone : `+${phone}`)).join(' · ')}</Text> : null}
                  {item.flag ? <Text style={[styles.caption, { color: colors.danger }]}>{item.flag}</Text> : null}
                </View>
                <Chevron rtl={lang === 'ar'} color={colors.muted} />
              </View>
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
    await api.decideRename(id, ok).catch((e) => toast(errorText(e, lang), true));
    await Promise.all([qc.invalidateQueries({ queryKey: ['ownerRenames'] }), qc.invalidateQueries({ queryKey: ['owners'] })]);
  };
  return (
    <View testID="rename-requests" style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.name, { color: colors.text }]}>📝 {ot(lang, 'renames')} ({items.length})</Text>
      {items.map((r) => (
        <View key={r.id} style={styles.gap}>
          <Text style={{ color: colors.text }}>{r.code} · {r.old_value || '—'} {lang === 'ar' ? '←' : '→'} {r.new_value}</Text>
          <View style={styles.row}>
            <Button testID={`rename-ok-${r.id}`} label={ot(lang, 'approve')} onPress={() => decide(r.id, true)} />
            <Button label={ot(lang, 'decline')} variant="secondary" onPress={() => decide(r.id, false)} />
          </View>
        </View>
      ))}
    </View>
  );
}

const OWNER_EVENT_TITLES: Record<string, [string, string]> = {
  created: ['اتسجل المالك', 'Added the owner'],
  edited: ['اتعدلت بيانات المالك', 'Edited owner details'],
  rename_requested: ['اتطلب تغيير الاسم', 'Requested a name change'],
  rename_rejected: ['اترفض تغيير الاسم', 'Declined a name change'],
  note: ['اتعدلت الملاحظات', 'Updated notes'],
  flag: ['اتعدل التنبيه', 'Updated the alert'],
  unit_linked: ['اتربطت وحدة بالمالك', 'Linked a unit'],
  unit_moved_in: ['اتنقلت وحدة للمالك', 'Moved a unit to this owner'],
  unit_moved_out: ['اتنقلت وحدة من المالك', 'Moved a unit away'],
};

function ownerEventTitle(kind: string, lang: Lang) {
  return OWNER_EVENT_TITLES[kind]?.[lang === 'ar' ? 0 : 1] ?? kind.replace(/_/g, ' ');
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
      await Promise.all([qc.invalidateQueries({ queryKey: ['owner', id] }), qc.invalidateQueries({ queryKey: ['owners'] })]);
      if (ok) setMsg(ok);
    } catch (e) {
      setMsg(toastError(errorText(e, lang)));
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
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
      <View testID="owner-profile" style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.identity}>
          <InitialAvatar name={owner.name} />
          <View style={styles.person}>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{owner.name || ot(lang, 'noName')}</Text>
            <View style={styles.chips}>
              {owner.code ? <Pill tone="primary" label={owner.code} /> : null}
              {owner.is_private ? <Pill tone="accent" label={ot(lang, 'vip')} /> : null}
            </View>
          </View>
        </View>
        {owner.phones.map((phone, index) => !owner.phones_masked && looksLikePhone(phone)
          ? <ContactRow key={phone} phone={phone} kind="owner" index={index} lang={lang} />
          : <PhoneText key={phone} value={phone} style={[styles.caption, { color: colors.muted }]} />)}
        {owner.flag ? <Text style={[styles.caption, { color: colors.danger }]}>{owner.flag}</Text> : null}
        {owner.notes ? <Text style={{ color: colors.text }}>{owner.notes}</Text> : null}
        {lead ? (
          <Pressable accessibilityRole="button" onPress={() => nav.navigate('Lead', { ref: `L-${String(lead.ref).padStart(4, '0')}` })} style={styles.link}>
            <Icon name="link" color={colors.primaryInk} size={16} />
            <Text style={{ color: colors.primaryInk }}>{ot(lang, 'alsoLead')} · L-{String(lead.ref).padStart(4, '0')}</Text>
          </Pressable>
        ) : null}
      </View>
      {msg ? <Text testID="owner-msg" style={{ color: colors.muted }}>{msg}</Text> : null}
      <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text accessibilityRole="header" style={[styles.name, { color: colors.text }]}>{ot(lang, 'units')}</Text>
        {owner.units.map((u) => {
          const status = labelOf(UNIT_STATUS, u.status, lang);
          return (
            <Pressable key={u.code} accessibilityRole="button" onPress={() => nav.navigate('Unit', { code: u.code })}
              style={[styles.unitRow, { backgroundColor: colors.cardSubtle, borderColor: colors.border }]}>
              <View style={styles.person}>
                {u.compound ? <Text style={[styles.name, { color: colors.text }]}>{u.compound}</Text> : null}
                <View style={styles.chips}>
                  <Pill tone="primary" label={u.code} />
                  {status ? <Pill label={status} /> : null}
                  {u.is_private ? <Icon name="lock" color={colors.muted} size={16} /> : null}
                </View>
              </View>
              <Chevron rtl={lang === 'ar'} color={colors.muted} />
            </Pressable>
          );
        })}
      </View>
      <Section testID="owner-history" title={ot(lang, 'history')}>
        {events.length ? events.map((event, index) => (
          <TimelineEntry key={index} at={event.created_at} actor={event.broker_name} title={ownerEventTitle(event.kind, lang)}
            detail={typeof event.data?.code === 'string' ? event.data.code : undefined}
            lang={lang} first={index === 0} last={index === events.length - 1} />
        )) : <Text style={[styles.caption, { color: colors.muted }]}>{lang === 'ar' ? 'مفيش نشاط لسه.' : 'No activity yet.'}</Text>}
      </Section>
      {rights.agencyOwner ? (
        <Button testID="owner-vip" variant="secondary" label={owner.is_private ? ot(lang, 'vipOff') : ot(lang, 'vipOn')} onPress={() => run(() => api.ownerPrivate(id, !owner.is_private, owner.units.map((u) => u.code)))} />
      ) : null}
      {owner.canEdit && !editing ? <Button testID="owner-edit" variant="secondary" label={ot(lang, 'edit')} onPress={startEdit} /> : null}
      {editing ? (
        <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Field label={ot(lang, 'name')} value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} testID="owner-name" />
          <Field label={ot(lang, 'phone')} value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} keyboardType="phone-pad" />
          <Field label={ot(lang, 'flag')} value={form.flag} onChangeText={(v) => setForm({ ...form, flag: v })} />
          <Field label={ot(lang, 'notes')} value={form.notes} onChangeText={(v) => setForm({ ...form, notes: v })} multiline />
          <Button testID="owner-save" label={ot(lang, 'save')} onPress={save} />
        </View>
      ) : null}
      {owner.canEdit && rights.manager ? (
        <Button testID="owner-delete" variant="danger" label={ot(lang, 'del')} onPress={() => Alert.alert(ot(lang, 'delAsk'), undefined, [{ text: ot(lang, 'del'), style: 'destructive', onPress: () => { run(async () => { await api.deleteOwner(id); nav.goBack(); }).catch(() => {}); } }, { text: 'OK', style: 'cancel' }])} />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pad: { padding: spacing.lg, gap: spacing.md },
  gap: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md },
  card: { marginHorizontal: spacing.lg, marginTop: spacing.sm, borderWidth: 1, borderRadius: radius.card, padding: spacing.md, gap: spacing.xs },
  panel: { borderWidth: 1, borderRadius: radius.card, padding: spacing.md, gap: spacing.sm },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  person: { flex: 1, minWidth: 0, gap: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  caption: { fontSize: 12 },
  link: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: spacing.xs },
  unitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.md, padding: spacing.sm },
  name: { fontSize: 16, fontWeight: '800' },
  title: { fontSize: 20, fontWeight: '800' },
});
