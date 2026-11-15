import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, spacing, useTheme } from '../theme';

/** A collapsible part of a long page: the title is always visible, the body opens on tap. */
export function Section({ title, testID, startOpen = false, children }: { title: string; testID?: string; startOpen?: boolean; children: React.ReactNode }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(startOpen);
  return (
    <View style={[styles.box, { borderColor: colors.border }]}>
      <Pressable testID={testID} accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((o) => !o)} style={styles.head}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={{ color: colors.muted }}>{open ? '▲' : '▼'}</Text>
      </Pressable>
      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: radius.md, overflow: 'hidden' },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, minHeight: 48 },
  title: { fontSize: 16, fontWeight: '700' },
  body: { padding: spacing.md, gap: spacing.md },
});
