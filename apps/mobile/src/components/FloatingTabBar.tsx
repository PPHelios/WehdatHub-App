import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text } from './AppText';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { FONT_BOLD } from '../fonts';
import { tick } from '../haptics';
import { useKeyboardVisible } from './KeyboardLift';
import { useSelectionHighlight } from './SelectionHighlight';
import { greenGradient, useTheme } from '../theme';

/** The tab option that marks the centre shortcut. */
export const FAB_TEST_ID = 'tab-fab';
const BAR = 68;
const INSET = 5;

/**
 * The tab bar: a floating capsule. One highlight sits behind the active tab and slides to the tab you press (it follows the reading
 * direction in Arabic), and the active icon fills with the brand colour. Tabs are the screens of the navigator, in order.
 */
export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors, elev } = useTheme();
  const keyboardVisible = useKeyboardVisible();
  const isFab = (key: string) => descriptors[key]?.options.tabBarButtonTestID === FAB_TEST_ID;

  const { measure, highlight } = useSelectionHighlight(state.routes[state.index]?.key, greenGradient, BAR / 2, 3, 'tab-highlight');

  if (keyboardVisible) return null;

  return (
    <View style={[styles.wrap, { backgroundColor: colors.bg }]}>
      <View testID="tab-bar" style={[styles.bar, { backgroundColor: colors.card, borderColor: colors.border }, elev('lg')]}>
        {highlight}
        {state.routes.map((route, i) => {
          const { options } = descriptors[route.key];
          const focused = state.index === i;
          const featured = isFab(route.key);
          const color = focused ? '#FFFFFF' : colors.muted;
          const label = typeof options.title === 'string' ? options.title : route.name;
          const press = () => {
            const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !e.defaultPrevented) { tick(); navigation.navigate(route.name, route.params); }
            else if (!focused) tick();
          };
          return (
            <Pressable key={route.key} onLayout={measure(route.key)} testID={`tab-${route.name}`} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={label} onPress={press} onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })} style={({ pressed }) => [styles.item, { opacity: pressed ? 0.6 : 1 }]}>
              {focused && !highlight ? (
                <View testID="tab-highlight" pointerEvents="none" style={[styles.activeCapsule, greenGradient]} />
              ) : null}
              <View testID={featured ? (route.name === 'Search' ? 'tab-search-fab' : 'tab-add-fab') : undefined} style={styles.iconWrap}>
                {options.tabBarIcon?.({ focused, color, size: 22 })}
              </View>
              <Text numberOfLines={1} allowFontScaling={false} style={[styles.label, { color, fontFamily: FONT_BOLD, fontWeight: focused ? '800' : '600' }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingBottom: 10 },
  bar: { height: BAR, borderRadius: BAR / 2, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', padding: INSET, shadowColor: '#000000', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  activeCapsule: { position: 'absolute', top: 3, bottom: 3, left: 4, right: 4, borderRadius: (BAR - INSET * 2) / 2 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, position: 'relative' },
  iconWrap: { alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 11 },
});
