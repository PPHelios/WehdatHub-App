import React, { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText as Text } from './AppText';
import { useSelectionHighlight } from './SelectionHighlight';
import { greenGradient, spacing, typeScale, useTheme } from '../theme';
import { currentLang } from '../auth';
import { t } from '../i18n';
import { CoachMark } from './CoachMark';

export interface HubTabItem<T extends string> {
  id: T;
  label: string;
  count?: number | string;
  testID?: string;
}

interface HubTabsProps<T extends string> {
  tabs: readonly HubTabItem<T>[];
  active: T;
  onSelect: (tab: T) => void;
  testID?: string;
}

export function HubTabs<T extends string>({ tabs, active, onSelect, testID }: HubTabsProps<T>) {
  const { colors } = useTheme();
  const selection = useSelectionHighlight(active, greenGradient, 999, 0, 'hub-tab-highlight');
  const box = useRef<React.ComponentRef<typeof View>>(null);

  return (
    <View ref={box} collapsable={false} style={[styles.box, { backgroundColor: colors.bg, borderBottomColor: colors.border }]} testID={testID}>
      <CoachMark id="hubTabs" targetRef={box} text={t(currentLang(), 'coachTabs')} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {selection.highlight}
        {tabs.map((tab) => {
          const selected = tab.id === active;
          return (
            <Pressable
              key={tab.id}
              testID={tab.testID ?? `hub-tab-${tab.id}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onLayout={selection.measure(tab.id)}
              onPress={() => onSelect(tab.id)}
              style={[
                styles.tab,
                { borderColor: selected ? colors.primary : colors.border },
                selected && !selection.highlight && greenGradient,
              ]}
            >
              <Text style={[styles.label, { color: selected ? colors.onPrimary : colors.muted }]}>
                {tab.label}
              </Text>
              {tab.count !== undefined ? (
                <Text
                  testID={`hub-tab-count-${tab.id}`}
                  style={[styles.count, { color: selected ? colors.onPrimary : colors.muted }]}
                >
                  ({tab.count})
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    height: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  row: {
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  tab: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  label: {
    fontSize: typeScale.bodySm.fontSize,
    fontWeight: '700',
  },
  count: {
    fontSize: typeScale.caption.fontSize,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
