import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text } from './AppText';
import { Chevron } from './Icon';
import { currentLang } from '../auth';
import { radius, spacing, useTheme } from '../theme';

/** A collapsible part of a long page: the title is always visible, the body opens on tap. */
export function Section({ title, testID, startOpen = false, children }: { title: string; testID?: string; startOpen?: boolean; children: React.ReactNode }) {
  const { colors, elev } = useTheme();
  const [open, setOpen] = useState(startOpen);
  return (
    <View style={[styles.box, elev('md'), { borderColor: colors.border, backgroundColor: colors.card }]}>
      <Pressable testID={testID} accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((o) => !o)} style={styles.head}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Chevron rtl={currentLang() === 'ar'} color={colors.muted} expanded={open} />
      </Pressable>
      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: radius.card, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, minHeight: 48 },
  title: { flexShrink: 1, fontSize: 16, fontWeight: '700' },
  body: { padding: spacing.md, gap: spacing.md },
});
