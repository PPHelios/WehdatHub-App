import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { AppText as Text } from './AppText';
import { Avatar } from './Avatar';
import { Logo } from './Logo';
import { currentLang, useAuth } from '../auth';
import { FONT_BOLD } from '../fonts';
import { t, type StringKey } from '../i18n';
import { radius, spacing, useTheme } from '../theme';

export const SIDE_NAV_WIDTH = 232;

const ROLE_KEY: Record<string, StringKey> = { owner: 'sideRole_owner', manager: 'sideRole_manager', admin: 'sideRole_manager', broker: 'sideRole_broker', agent: 'sideRole_broker', team_lead: 'sideRole_team_lead', data_entry: 'sideRole_data_entry' };

/** The tab bar on tablets and landscape iPads: the same tabs as the bottom bar, in a column on the start side. */
export function SideNav({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const broker = useAuth((s) => s.broker);
  const lang = currentLang();
  const role = broker?.role ? (ROLE_KEY[broker.role] ? t(lang, ROLE_KEY[broker.role]) : broker.role) : '';
  return (
    <SafeAreaView edges={['top', 'bottom']} testID="side-nav" style={[styles.nav, { backgroundColor: colors.card, borderEndColor: colors.border }]}>
      <View style={styles.logo}><Logo compact size={0.6} /></View>
      <ScrollView style={styles.flex} contentContainerStyle={styles.items}>
        {state.routes.map((route, i) => {
          const { options } = descriptors[route.key];
          const focused = state.index === i;
          const color = focused ? colors.primaryInk : colors.muted;
          const label = typeof options.title === 'string' ? options.title : route.name;
          const press = () => {
            const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!e.defaultPrevented && !focused) navigation.navigate(route.name, route.params);
          };
          return (
            <Pressable key={route.key} testID={`side-${route.name}`} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={label} onPress={press}
              style={({ pressed }) => [styles.item, focused && { backgroundColor: colors.primarySoft }, { opacity: pressed ? 0.6 : 1 }]}>
              {options.tabBarIcon?.({ focused, color, size: 22 })}
              <Text numberOfLines={1} style={[focused ? styles.labelOn : styles.labelOff, { color }]}>{label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <Pressable testID="side-profile" accessibilityRole="button" accessibilityLabel={broker?.name ?? t(lang, 'sideSettings')} onPress={() => navigation.navigate('Settings' as never)}
        style={({ pressed }) => [styles.profile, { borderTopColor: colors.border, opacity: pressed ? 0.6 : 1 }]}>
        <Avatar name={broker?.name ?? null} uri={broker?.avatarUrl} size={40} />
        <View style={styles.flex}>
          <Text numberOfLines={1} weight="bold" style={{ color: colors.text }}>{broker?.name ?? ''}</Text>
          <Text numberOfLines={1} variant="caption" style={{ color: colors.muted }}>{role}</Text>
        </View>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  nav: { width: SIDE_NAV_WIDTH, borderEndWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing.md },
  logo: { paddingVertical: spacing.lg, alignItems: 'flex-start' },
  labelOn: { fontFamily: FONT_BOLD, fontWeight: '800', flex: 1 },
  labelOff: { fontFamily: FONT_BOLD, fontWeight: '600', flex: 1 },
  items: { gap: spacing.xs },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44, paddingHorizontal: spacing.md, borderRadius: radius.md },
  profile: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
});
