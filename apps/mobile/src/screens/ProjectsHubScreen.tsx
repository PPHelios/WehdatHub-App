import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { currentLang } from '../auth';
import { HubTabs, type HubTabItem } from '../components/HubTabs';
import { ProjectsScreen } from './CatalogueScreens';
import { LibraryScreen } from './MoreScreens';
import { PricesScreen } from './InsightsScreens';
import { openPrimarySearch } from '../searchLink';
import type { RootStackParams } from '../navigation';
import { useTheme } from '../theme';

export type ProjectsHubTab = 'projects' | 'library' | 'prices' | 'ask';

export function ProjectsHubScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const ar = lang === 'ar';
  const nav = useNavigation();
  const route = useRoute<RouteProp<RootStackParams, 'ProjectsHub'>>();
  const [tab, setTab] = useState<ProjectsHubTab>(route.params?.initialTab ?? 'projects');

  const tabs: readonly HubTabItem<ProjectsHubTab>[] = [
    { id: 'projects', label: ar ? 'مشاريع الشركة' : 'Agency Projects', testID: 'hub-tab-projects' },
    { id: 'library', label: ar ? 'مكتبة المطورين' : 'Developer Library', testID: 'hub-tab-library' },
    { id: 'prices', label: ar ? 'سعر المتر' : 'Price per m²', testID: 'hub-tab-prices' },
    { id: 'ask', label: ar ? 'اسأل المساعد' : 'Ask Assistant', testID: 'hub-tab-ask' },
  ];

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <HubTabs tabs={tabs} active={tab} onSelect={(id) => (id === 'ask' ? openPrimarySearch(nav) : setTab(id))} testID="projects-hub-tabs" />
      <View style={styles.flex}>
        {tab === 'projects' ? <ProjectsScreen /> : null}
        {tab === 'library' ? <LibraryScreen /> : null}
        {tab === 'prices' ? <PricesScreen /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
