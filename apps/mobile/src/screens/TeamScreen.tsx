import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ApiClientError } from '@wehdathub/shared';
import type { ApiLead } from '@wehdathub/shared';
import { api } from '../api';
import { currentLang } from '../auth';
import { Button } from '../components/Button';
import { ot } from '../ownerText';
import { useRights } from '../rights';
import { EmptyView, ErrorView, Loading } from '../components/StateViews';
import { errorText } from '../errors';
import { stageLabel, t } from '../i18n';
import type { RootStackParams } from '../navigation';
import { lift, radius, spacing, useTheme } from '../theme';

/** The team: each broker with open, overdue and due-today leads. A manager sees everyone, a team lead their own team. */
export function TeamScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const rights = useRights();
  const [view, setView] = React.useState<'active' | 'former'>('active');
  const q = useQuery({ queryKey: ['team'], queryFn: () => api.team() });
  const canManage = rights.manager || rights.agencyOwner;
  const switcher = canManage ? (
    <View style={{ flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
      <Button testID="team-view-active" variant={view === 'active' ? 'primary' : 'secondary'} label={lang === 'ar' ? 'الفريق' : 'Team'} onPress={() => setView('active')} />
      <Button testID="team-view-former" variant={view === 'former' ? 'primary' : 'secondary'} label={lang === 'ar' ? 'الموقوفين' : 'Deactivated'} onPress={() => setView('former')} />
    </View>
  ) : null;
  if (view === 'former' && canManage) return <FormerList header={switcher} />;
  if (q.isPending) return <Loading label={t(lang, 'loading')} />;
  if (q.isError) return <ErrorView message={errorText(q.error, lang)} retryLabel={t(lang, 'retry')} onRetry={async () => { await q.refetch(); }} />;
  return (
    <FlashList
      data={q.data.items}
      keyExtractor={(m) => m.id}
      refreshing={q.isRefetching}
      onRefresh={() => { q.refetch(); }}
      ListHeaderComponent={canManage ? <View>{switcher}<View style={{ padding: spacing.lg }}><Button testID="team-add" label={`➕ ${t(lang, 'invite')}`} onPress={() => nav.navigate('Invite')} /></View></View> : null}
      ListEmptyComponent={<EmptyView title={t(lang, 'teamEmpty')} />}
      renderItem={({ item }) => (
        <Pressable testID={`member-${item.id}`} accessibilityRole="button" onPress={() => nav.navigate('TeamMember', { id: item.id, name: item.name, role: item.role, me: item.me })} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.name, { color: colors.text }]}>{item.name}{item.away ? ` · ${t(lang, 'away')}` : ''}</Text>
          <View style={styles.row}>
            <Text style={{ color: colors.text }}>{item.open} {t(lang, 'openLeads')}</Text>
            <Text style={{ color: item.overdue ? colors.danger : colors.muted, fontWeight: item.overdue ? '700' : '400' }}>{item.overdue} {t(lang, 'overdue')}</Text>
            <Text style={{ color: colors.muted }}>{item.soon} {t(lang, 'dueSoon')}</Text>
          </View>
        </Pressable>
      )}
    />
  );
}

/** What went wrong with reactivating or deleting a member, in words (the shared error text only knows general cases). */
function memberError(e: unknown, lang: 'ar' | 'en'): string {
  const code = e instanceof ApiClientError ? e.code : '';
  if (code === 'has_records') return lang === 'ar' ? 'عنده صفقات أو وحدات؛ مينفعش يتمسح، سيبه موقوف.' : "They have deals or listings, so they can't be deleted; leave them deactivated.";
  if (code === 'self') return lang === 'ar' ? 'مينفعش توقف نفسك.' : "You can't deactivate yourself.";
  if (code === 'rank') return lang === 'ar' ? 'الأدمن والمالك يتداروا من الأدمن أو المالك بس.' : 'Only an admin or owner can manage an admin or owner.';
  if (e instanceof ApiClientError && e.status === 404) return lang === 'ar' ? 'الخدمة دي مش موجودة على السيرفر؛ حدّث السيرفر.' : 'The server does not have this yet; update the server.';
  if (code === 'seats') return lang === 'ar' ? 'مقاعد الباقة كلها مستخدمة؛ رقّي الباقة.' : 'Every seat on your plan is taken; upgrade the plan.';
  return errorText(e, lang);
}

/** The deactivated members: bring one back, or delete them for good. */
function FormerList({ header }: { header: React.ReactNode }) {
  const { colors } = useTheme();
  const lang = currentLang();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['teamFormer'], queryFn: () => api.formerTeam() });
  const done = () => Promise.all([qc.invalidateQueries({ queryKey: ['teamFormer'] }), qc.invalidateQueries({ queryKey: ['team'] })]).catch(() => {});
  const act = async (fn: () => Promise<unknown>) => {
    try { await fn(); } catch (e) { Alert.alert(memberError(e, lang)); return; }
    done();
  };
  if (q.isPending) return <Loading label={t(lang, 'loading')} />;
  if (q.isError) return <ErrorView message={memberError(q.error, lang)} retryLabel={t(lang, 'retry')} onRetry={async () => { await q.refetch(); }} />;
  return (
    <FlashList
      data={q.data.items}
      keyExtractor={(m) => m.id}
      refreshing={q.isRefetching}
      onRefresh={() => { q.refetch(); }}
      ListHeaderComponent={<View>{header}</View>}
      ListEmptyComponent={<EmptyView title={lang === 'ar' ? 'مفيش حد موقوف.' : 'Nobody is deactivated.'} />}
      renderItem={({ item }) => (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
          <Text style={{ color: colors.muted }}>{item.role}{item.deactivatedAt ? ` · ${item.deactivatedAt.slice(0, 10)}` : ''}</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button testID={`reactivate-${item.id}`} variant="secondary" label={`↩️ ${lang === 'ar' ? 'رجّعه' : 'Reactivate'}`} onPress={() => { act(() => api.reactivate(item.id)); }} />
            <Button testID={`delete-${item.id}`} variant="secondary" label={`🗑️ ${lang === 'ar' ? 'مسح نهائي' : 'Delete for good'}`} onPress={() => Alert.alert(lang === 'ar' ? 'مسح نهائي ومينفعش يتراجع. متأكد؟' : 'Delete for good? This cannot be undone.', item.name, [{ text: lang === 'ar' ? 'مسح نهائي' : 'Delete', style: 'destructive', onPress: () => { act(() => api.deleteMember(item.id)); } }, { text: lang === 'ar' ? 'إلغاء' : 'Cancel', style: 'cancel' }])} />
          </View>
        </View>
      )}
    />
  );
}

/** One broker's leads, newest activity first. */
export function TeamMemberScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const { id, role = '', me = false } = useRoute<RouteProp<RootStackParams, 'TeamMember'>>().params;
  const rights = useRights();
  const qc = useQueryClient();
  const admin = async (fn: () => Promise<unknown>) => {
    try { await fn(); } catch (e) { Alert.alert(memberError(e, lang)); return; }
    // The change is saved; a failed refresh of the list must not read as a failed change.
    qc.invalidateQueries({ queryKey: ['team'] }).catch(() => {});
    qc.invalidateQueries({ queryKey: ['teamFormer'] }).catch(() => {});
    nav.goBack();
  };
  const list = useInfiniteQuery({
    queryKey: ['teamLeads', id],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api.leads({ broker: id, offset: pageParam }),
    getNextPageParam: (last) => (last.more ? last.offset + last.items.length : undefined),
  });
  if (list.isPending) return <Loading label={t(lang, 'loading')} />;
  if (list.isError) return <ErrorView message={errorText(list.error, lang)} retryLabel={t(lang, 'retry')} onRetry={async () => { await list.refetch(); }} />;
  const items: ApiLead[] = list.data.pages.flatMap((p) => p.items);
  return (
    <FlashList
      data={items}
      keyExtractor={(l) => l.ref}
      onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
      onEndReachedThreshold={0.6}
      refreshing={list.isRefetching && !list.isFetchingNextPage}
      onRefresh={() => { list.refetch(); }}
      ListHeaderComponent={(rights.manager || rights.agencyOwner) && !me ? (
        <View style={{ padding: spacing.lg, gap: spacing.sm }}>
          {rights.agencyOwner && (role === 'broker' || role === 'manager') ? <Button testID="member-role" variant="secondary" label={role === 'manager' ? ot(lang, 'makeBroker') : ot(lang, 'makeManager')} onPress={() => admin(() => api.changeRole(id, role === 'manager' ? 'broker' : 'manager'))} /> : null}
          <Button testID="member-deactivate" variant="secondary" label={`⛔ ${ot(lang, 'deactivate')}`} onPress={() => Alert.alert(ot(lang, 'deactivateAsk'), undefined, [{ text: ot(lang, 'deactivate'), style: 'destructive', onPress: () => { admin(() => api.deactivate(id)).catch(() => {}); } }, { text: lang === 'ar' ? 'إلغاء' : 'Cancel', style: 'cancel' }])} />
        </View>
      ) : null}
      ListEmptyComponent={<EmptyView title={t(lang, 'noLeadsHere')} />}
      renderItem={({ item }) => (
        <Pressable accessibilityRole="button" onPress={() => nav.navigate('Lead', { ref: item.ref })} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.name, { color: colors.text }]}>{item.name || item.ref}</Text>
          <Text style={{ color: colors.muted }}>{item.ref} · {stageLabel(lang, item.stage)}</Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  card: { ...lift, marginHorizontal: spacing.lg, marginTop: spacing.sm, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
  name: { fontSize: 16, fontWeight: '700' },
  row: { flexDirection: 'row', gap: spacing.lg },
});
