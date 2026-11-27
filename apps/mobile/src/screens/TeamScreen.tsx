import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text } from '../components/AppText';
import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ApiClientError } from '@wehdathub/shared';
import type { ApiLead, Lang } from '@wehdathub/shared';
import { api } from '../api';
import { meOptions, teamOptions } from '../queries';
import { currentLang } from '../auth';
import { Button } from '../components/Button';
import { Chips } from '../components/Chips';
import { Chevron } from '../components/Icon';
import { Avatar } from '../components/Avatar';
import { InitialAvatar } from '../components/InitialAvatar';
import { LeadCard } from '../components/LeadCard';
import { Pill } from '../components/Pill';
import { rowDate } from '../dates';
import { ot } from '../ownerText';
import { useRights, useRightsState } from '../rights';
import { EmptyView, ErrorView, Loading } from '../components/StateViews';
import { errorText } from '../errors';
import { t } from '../i18n';
import { openAssistant } from '../searchLink';
import { planT } from '../planText';
import type { RootStackParams } from '../navigation';
import { ChoiceSheet, type ChoiceAsk } from '../components/Sheet';
import { radius, spacing, useTheme } from '../theme';
import { toast } from '../components/Toast';
import { sx } from '../sharedStyles';

function memberRoleLabel(lang: Lang, role: string) {
  switch (role) {
    case 'owner': return lang === 'ar' ? 'مالك الشركة' : 'Agency owner';
    case 'manager':
    case 'admin': return ot(lang, 'manager');
    case 'broker':
    case 'agent': return ot(lang, 'broker');
    case 'team_lead': return ot(lang, 'teamLead');
    case 'data_entry': return ot(lang, 'dataEntry');
    default: return role;
  }
}

/** The team: each broker with open, overdue and due-today leads. A manager sees everyone, a team lead their own team. */
export function TeamScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const qc = useQueryClient();
  const rights = useRights();
  const me = useQuery(meOptions());
  const order = useRoute<RouteProp<RootStackParams, 'Team'>>().params?.order;
  const workspace = me.data?.workspace;
  const [savingStyle, setSavingStyle] = React.useState(false);
  const [view, setView] = React.useState<'active' | 'former'>('active');
  const q = useQuery(teamOptions());
  const canManage = rights.manager || rights.agencyOwner;
  const setStyle = async (style: 'shared' | 'structured') => {
    if (savingStyle) return;
    setSavingStyle(true);
    try {
      await api.setTeamStyle(style);
      await Promise.all(['me', 'app-settings', 'team', 'today', 'dashboard', 'lead', 'leads'].map((key) => qc.invalidateQueries({ queryKey: [key] })));
    } catch (e) {
      toast(errorText(e, lang), true);
    } finally {
      setSavingStyle(false);
    }
  };
  const styleSelector = rights.agencyOwner && workspace?.tier === 'team' ? (
    <View style={styles.controls}>
      <Button testID="team-style-shared" size="sm" variant={workspace.teamStyle === 'shared' ? 'primary' : 'secondary'} disabled={savingStyle} label={lang === 'ar' ? 'فريق مشترك' : 'Shared team'} onPress={() => setStyle('shared')} />
      <Button testID="team-style-owner" size="sm" variant={workspace.teamStyle === 'structured' ? 'primary' : 'secondary'} disabled={savingStyle} label={lang === 'ar' ? 'المالك بيوزّع العملاء' : 'Owner-controlled'} onPress={() => setStyle('structured')} />
    </View>
  ) : null;
  const switcher = canManage ? (
    <View style={styles.toolbar}>
      <Chips<'active' | 'former'> animateFilter testID="team-view" value={view} onChange={setView}
        options={[{ value: 'active', label: t(lang, 'team') }, { value: 'former', label: lang === 'ar' ? 'الموقوفين' : 'Deactivated' }]} />
    </View>
  ) : null;
  if (view === 'former' && canManage) return <FormerList header={switcher} />;
  if (q.isPending) return <Loading label={t(lang, 'loading')} />;
  if (q.isError) return <ErrorView message={errorText(q.error, lang)} retryLabel={t(lang, 'retry')} onRetry={async () => { await q.refetch(); }} />;
  const items = order === 'overdue' ? [...q.data.items].sort((a, b) => b.overdue - a.overdue)
    : order === 'available' ? q.data.items.filter((item) => !item.away).sort((a, b) => a.open - b.open)
    : q.data.items;
  return (
    <FlashList
      data={items}
      keyExtractor={(m) => m.id}
      refreshing={q.isRefetching}
      onRefresh={() => { q.refetch(); }}
      ListHeaderComponent={<View>
        {order ? <Text style={{ color: colors.muted, padding: spacing.lg }}>{order === 'overdue'
          ? (lang === 'ar' ? 'الأكتر في المتابعات المتأخرة الأول' : 'Most overdue follow-ups first')
          : (lang === 'ar' ? 'الوسطاء اللي مش في إجازة، الأقل في العملاء المفتوحين الأول' : 'Brokers who are not away, fewest open leads first')}</Text> : null}
        {canManage ? <View>{switcher}<View style={styles.toolbar}>{styleSelector}<Button testID="team-add" size="sm" label={t(lang, 'invite')} onPress={() => nav.navigate('Invite')} /></View></View> : null}</View>}
      ListEmptyComponent={<EmptyView title={t(lang, 'teamEmpty')} icon="team" actionLabel={t(lang, canManage ? 'invite' : 'askAssistant')} onAction={() => (canManage ? nav.navigate('Invite') : openAssistant(nav))} />}
      renderItem={({ item }) => (
        <Pressable testID={`member-${item.id}`} accessibilityRole="button" onPress={() => nav.navigate('TeamMember', { id: item.id, name: item.name, role: item.role, me: item.me, teamLeadId: item.teamLeadId ?? null })}
          style={({ pressed }) => [styles.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.84 : 1 }]}>
          <View style={styles.identity}>
            <Avatar name={item.name} uri={item.avatarUrl} />
            <View style={styles.person}>
              <Text variant="body" weight="bold" style={{ color: colors.text }} numberOfLines={2}>{item.name}</Text>
              <View style={styles.chips}>
                {item.role ? <Pill tone="primary" label={memberRoleLabel(lang, item.role)} /> : null}
                {item.away ? <Pill tone="accent" label={t(lang, 'away')} /> : null}
              </View>
            </View>
            <Chevron rtl={lang === 'ar'} color={colors.muted} />
          </View>
          <View style={[styles.metrics, { backgroundColor: colors.cardSubtle, borderColor: colors.border }]}>
            <Text variant="caption" weight="bold" style={[styles.metric, { color: colors.primaryInk }]}>{item.open} ${t(lang, 'openLeads')}</Text>
            <Text variant="caption" weight="bold" style={[styles.metric, { color: item.overdue ? colors.danger : colors.muted }]}>{item.overdue} ${t(lang, 'overdue')}</Text>
            <Text variant="caption" weight="bold" style={[styles.metric, { color: colors.muted }]}>{item.soon} ${t(lang, 'dueSoon')}</Text>
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
  if (code === 'seats') return planT(lang, 'teamSeats');
  return errorText(e, lang);
}

/** The deactivated members: bring one back, or delete them for good. */
function FormerList({ header }: { header: React.ReactNode }) {
  const { colors } = useTheme();
  const lang = currentLang();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const qc = useQueryClient();
  const [ask, setAsk] = React.useState<ChoiceAsk | null>(null);
  const q = useQuery({ queryKey: ['teamFormer'], queryFn: () => api.formerTeam() });
  const done = () => Promise.all([qc.invalidateQueries({ queryKey: ['teamFormer'] }), qc.invalidateQueries({ queryKey: ['team'] })]).catch(() => {});
  const act = async (fn: () => Promise<unknown>) => {
    try { await fn(); } catch (e) { toast(memberError(e, lang), true); return; }
    done();
  };
  if (q.isPending || q.isError) return (
    <>
      {header}
      {q.isPending ? <Loading label={t(lang, 'loading')} /> : <ErrorView message={memberError(q.error, lang)} retryLabel={t(lang, 'retry')} onRetry={async () => { await q.refetch(); }} />}
    </>
  );
  return (
    <>
    <FlashList
      data={q.data.items}
      keyExtractor={(m) => m.id}
      refreshing={q.isRefetching}
      onRefresh={() => { q.refetch(); }}
      ListHeaderComponent={<View>{header}</View>}
      ListEmptyComponent={<EmptyView title={lang === 'ar' ? 'مفيش حد موقوف.' : 'Nobody is deactivated.'} icon="team" actionLabel={t(lang, 'invite')} onAction={() => nav.navigate('Invite')} />}
      renderItem={({ item }) => (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.identity}>
            <InitialAvatar name={item.name} />
            <View style={styles.person}>
              <Text variant="body" weight="bold" style={{ color: colors.text }}>{item.name}</Text>
              {item.role ? <Pill tone="primary" label={memberRoleLabel(lang, item.role)} /> : null}
              {item.deactivatedAt ? <Text style={{ color: colors.muted }}>{rowDate(lang, item.deactivatedAt)}</Text> : null}
            </View>
          </View>
          <View style={styles.controls}>
            <Button size="sm" testID={`reactivate-${item.id}`} variant="secondary" label={lang === 'ar' ? 'رجّعه' : 'Reactivate'} onPress={() => { act(() => api.reactivate(item.id)); }} />
            <Button testID={`delete-${item.id}`} size="sm" variant="danger" label={t(lang, 'tm_delGood')} onPress={() => setAsk({ title: t(lang, 'tm_delAsk'), body: item.name, actions: [{ label: t(lang, 'tm_delGood'), variant: 'danger', onPress: () => { act(() => api.deleteMember(item.id)); } }] })} />
          </View>
        </View>
      )}
    />
    <ChoiceSheet ask={ask} onClose={() => setAsk(null)} cancelLabel={t(lang, 'cancel')} testID="member-delete-sheet" />
    </>
  );
}

type MemberRoleName = 'broker' | 'team_lead' | 'manager' | 'data_entry';

/**
 * The role and team of one member, the same choices as the website's Team page: the agency owner moves people between
 * broker, manager and data entry; a manager (or the owner) makes a broker a team lead and puts brokers in a team.
 * The server decides (services/team.js); the choices only hide what it would refuse.
 */
export function MemberRole({ id, role, teamLeadId, run }: { id: string; role: string; teamLeadId: string | null; run: (fn: () => Promise<unknown>) => Promise<void> }) {
  const lang = currentLang();
  const { colors } = useTheme();
  const [ask, setAsk] = React.useState<ChoiceAsk | null>(null);
  const { rights, workspace, inviteRoles } = useRightsState();
  const team = useQuery(teamOptions());
  const owner = rights.agencyOwner;
  const manager = rights.manager || owner;
  const cur = role as MemberRoleName;
  if (!['broker', 'team_lead', 'manager', 'data_entry'].includes(cur)) return null;
  const teamTierOnly = workspace?.tier === 'team';
  const allowTeamLead = Array.isArray(inviteRoles) ? inviteRoles.includes('team_lead') : !teamTierOnly;
  const allowDataEntry = Array.isArray(inviteRoles) ? inviteRoles.includes('data_entry') : !teamTierOnly;
  const choices: { value: MemberRoleName; label: string }[] = [
    { value: 'broker', label: ot(lang, 'broker') },
    ...(allowTeamLead ? [{ value: 'team_lead' as MemberRoleName, label: ot(lang, 'teamLead') }] : []),
    ...(owner ? [{ value: 'manager' as MemberRoleName, label: ot(lang, 'manager') }, ...(allowDataEntry ? [{ value: 'data_entry' as MemberRoleName, label: ot(lang, 'dataEntry') }] : [])] : []),
  ];
  // A manager who is not the owner may only move between broker and team lead.
  if (!owner && !['broker', 'team_lead'].includes(cur)) return null;
  const change = (to: MemberRoleName) => {
    if (to === cur) return;
    run(async () => {
      if (cur === 'team_lead') await api.teamRole(id, false);
      if (to === 'team_lead') {
        if (cur !== 'broker' && cur !== 'team_lead') await api.changeRole(id, 'broker');
        await api.teamRole(id, true);
      } else if (to !== 'broker' || (cur !== 'team_lead' && cur !== 'broker')) {
        await api.changeRole(id, to);
      }
    }).catch(() => {});
  };
  const leads = (team.data?.items ?? []).filter((m) => m.role === 'team_lead' && m.id !== id);
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={[{ color: colors.text }, sx.fontWeight700]}>{ot(lang, 'role')}</Text>
      <Chips<MemberRoleName> testID="member-role" options={choices} value={cur} onChange={(v) => setAsk({ title: ot(lang, 'roleAsk'), actions: [{ label: ot(lang, 'save'), variant: 'primary', onPress: () => change(v) }] })} />
      <ChoiceSheet ask={ask} onClose={() => setAsk(null)} cancelLabel={t(lang, 'cancel')} testID="member-role-sheet" />
      {manager && cur === 'broker' && leads.length ? (
        <>
          <Text style={[{ color: colors.text }, sx.fontWeight700]}>{ot(lang, 'team')}</Text>
          <Chips<string> testID="member-team" options={[{ value: '', label: ot(lang, 'noTeam') }, ...leads.map((m) => ({ value: m.id, label: m.name }))]} value={teamLeadId ?? ''} onChange={(v) => { run(() => api.setTeam(id, v || null)).catch(() => {}); }} />
        </>
      ) : null}
    </View>
  );
}

/** One broker's leads, newest activity first. */
export function TeamMemberScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const { id, name, role = '', me = false, teamLeadId = null } = useRoute<RouteProp<RootStackParams, 'TeamMember'>>().params;
  const rights = useRights();
  const qc = useQueryClient();
  const [ask, setAsk] = React.useState<ChoiceAsk | null>(null);
  const admin = async (fn: () => Promise<unknown>) => {
    try { await fn(); } catch (e) { toast(memberError(e, lang), true); return; }
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
    <>
    <FlashList
      data={items}
      keyExtractor={(l) => l.ref}
      onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
      onEndReachedThreshold={0.6}
      refreshing={list.isRefetching && !list.isFetchingNextPage}
      onRefresh={() => { list.refetch(); }}
      ListHeaderComponent={
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.identity}>
            <InitialAvatar name={name ?? null} />
            <View style={styles.person}>
              <Text accessibilityRole="header" variant="body" weight="bold" style={{ color: colors.text }}>{name}</Text>
              {role ? <Pill tone="primary" label={memberRoleLabel(lang, role)} /> : null}
            </View>
          </View>
          {(rights.manager || rights.agencyOwner) && !me ? (
            <>
              <MemberRole id={id} role={role} teamLeadId={teamLeadId} run={admin} />
              <Button testID="member-deactivate" size="sm" variant="danger" label={ot(lang, 'deactivate')} onPress={() => setAsk({ title: ot(lang, 'deactivateAsk'), actions: [{ label: ot(lang, 'deactivate'), variant: 'danger', onPress: () => { admin(() => api.deactivate(id)).catch(() => {}); } }] })} />
            </>
          ) : null}
        </View>
      }
      ListEmptyComponent={<EmptyView title={t(lang, 'noLeadsHere')} icon="leads" actionLabel={t(lang, 'leadsTab')} onAction={() => nav.navigate('LeadsList')} />}
      renderItem={({ item }) => (
        <View style={styles.listSlot}><LeadCard lead={item} lang={lang} phoneVisibility="hidden" onPress={() => nav.navigate('Lead', { ref: item.ref })} /></View>
      )}
    />
    <ChoiceSheet ask={ask} onClose={() => setAsk(null)} cancelLabel={t(lang, 'cancel')} testID="member-deactivate-sheet" />
    </>
  );
}

const styles = StyleSheet.create({
  toolbar: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm },
  card: { marginHorizontal: spacing.lg, marginTop: spacing.sm, borderWidth: 1, borderRadius: radius.card, padding: spacing.md, gap: spacing.sm },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  person: { flex: 1, minWidth: 0, gap: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.md, padding: spacing.sm },
  metric: { flexGrow: 1 },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  listSlot: { marginHorizontal: spacing.lg, marginTop: spacing.sm },
});
