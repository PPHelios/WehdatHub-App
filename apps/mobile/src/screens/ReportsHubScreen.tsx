import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { currentLang } from '../auth';
import { HubTabs, type HubTabItem } from '../components/HubTabs';
import { ChoiceSheet, type ChoiceAsk } from '../components/Sheet';
import { t } from '../i18n';
import { hasNavApp, useRightsState } from '../rights';
import { DashboardScreen, WinLossScreen } from './InsightsScreens';
import { SourcesScreen } from './DealsScreens';
import { ActivityLogScreen } from './RequestsScreen';
import type { RootStackParams } from '../navigation';
import { useTheme } from '../theme';

export type ReportsHubTab = 'dashboard' | 'winloss' | 'sources' | 'activity';

export function ReportsHubScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const [ask, setAsk] = useState<ChoiceAsk | null>(null);
  const { nav, workspace } = useRightsState();
  const isSolo = Boolean(workspace?.solo || workspace?.mode === 'solo');
  const route = useRoute<RouteProp<RootStackParams, 'ReportsHub'>>();
  const [tab, setTab] = useState<ReportsHubTab>(route.params?.initialTab ?? 'dashboard');

  const tabs: readonly HubTabItem<ReportsHubTab>[] = [
    { id: 'dashboard', label: t(lang, isSolo ? 'hb_myStats' : 'hb_agencyDash'), testID: 'hub-tab-dashboard' },
    ...((nav ? hasNavApp(nav, 'WinLoss') : !isSolo) ? [{ id: 'winloss' as const, label: t(lang, 'hb_winLoss'), testID: 'hub-tab-winloss' }] : []),
    ...((nav ? hasNavApp(nav, 'Sources') : !isSolo) ? [{ id: 'sources' as const, label: t(lang, 'hb_sources'), testID: 'hub-tab-sources' }] : []),
    ...((nav ? hasNavApp(nav, 'ActivityLog') : !isSolo) ? [{ id: 'activity' as const, label: t(lang, 'hb_activity'), testID: 'hub-tab-activity' }] : []),
  ];
  const activeTab: ReportsHubTab = tabs.some((x) => x.id === tab) ? tab : (tabs[0]?.id ?? 'dashboard');
  const sourcesDirtyRef = useRef(false);
  const handleDirtyChange = useCallback((dirty: boolean) => {
    sourcesDirtyRef.current = dirty;
  }, []);

  const selectTab = (next: ReportsHubTab) => {
    if (next === activeTab) return;
    if (activeTab === 'sources' && sourcesDirtyRef.current) {
      setAsk({
        title: t(lang, 'dlUnsavedTitle'),
        body: t(lang, 'dlUnsavedExit'),
        actions: [{ label: t(lang, 'dlDiscard'), variant: 'danger', onPress: () => { sourcesDirtyRef.current = false; setTab(next); } }],
      });
      return;
    }
    setTab(next);
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <HubTabs tabs={tabs} active={activeTab} onSelect={selectTab} testID="reports-hub-tabs" />
      <View style={styles.flex}>
        {activeTab === 'dashboard' ? <DashboardScreen /> : null}
        {activeTab === 'winloss' ? <WinLossScreen /> : null}
        {activeTab === 'sources' ? <SourcesScreen onDirtyChange={handleDirtyChange} /> : null}
        {activeTab === 'activity' ? <ActivityLogScreen /> : null}
      </View>
      <ChoiceSheet ask={ask} onClose={() => setAsk(null)} cancelLabel={t(lang, 'dlKeepEditing')} testID="reports-discard-sheet" />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
