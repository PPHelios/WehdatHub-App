import React, { useEffect, useRef, useState } from 'react';
import { Animated, I18nManager, Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FONT_BOLD } from '../fonts';
import { tick } from '../haptics';
import { useTheme } from '../theme';

const BAR = 68;
const INSET = 5;

/**
 * The tab bar: a floating capsule. One highlight sits behind the active tab and slides to the tab you press (it follows the reading
 * direction in Arabic), and the active icon fills with the brand colour. Tabs are the screens of the navigator, in order.
 */
export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors, scheme } = useTheme();
  const { bottom } = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const n = state.routes.length;
  const slot = width / Math.max(1, n);
  const index = I18nManager.isRTL ? n - 1 - state.index : state.index;
  const x = useRef(new Animated.Value(index * slot)).current;
  useEffect(() => {
    Animated.spring(x, { toValue: index * slot, speed: 18, bounciness: 7, useNativeDriver: true }).start();
  }, [index, slot, x]);

  return (
    <View style={[styles.wrap, { backgroundColor: colors.bg, paddingBottom: Math.max(bottom, 10) }]}>
      <View testID="tab-bar" onLayout={(e) => setWidth(e.nativeEvent.layout.width - INSET * 2)} style={[styles.bar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {width > 0 ? (
          <Animated.View testID="tab-highlight" pointerEvents="none" style={[styles.pill, { width: slot, backgroundColor: scheme === 'dark' ? 'rgba(0,0,0,0.38)' : `${colors.primary}1F`, transform: [{ translateX: x }] }]} />
        ) : null}
        {state.routes.map((route, i) => {
          const { options } = descriptors[route.key];
          const focused = state.index === i;
          const color = focused ? colors.primary : colors.muted;
          const label = typeof options.title === 'string' ? options.title : route.name;
          const press = () => {
            const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !e.defaultPrevented) { tick(); navigation.navigate(route.name, route.params); }
            else if (!focused) tick();
          };
          return (
            <Pressable key={route.key} testID={`tab-${route.name}`} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={label} onPress={press} onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })} style={({ pressed }) => [styles.item, { opacity: pressed ? 0.6 : 1 }]}>
              {options.tabBarIcon?.({ focused, color, size: 22 })}
              <Text numberOfLines={1} allowFontScaling={false} style={[styles.label, { color, fontFamily: FONT_BOLD, fontWeight: focused ? '800' : '600' }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 8 },
  bar: { height: BAR, borderRadius: BAR / 2, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', padding: INSET, elevation: 10, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 4 } },
  pill: { position: 'absolute', top: INSET, bottom: INSET, left: INSET, borderRadius: (BAR - INSET * 2) / 2 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  label: { fontSize: 11 },
});
