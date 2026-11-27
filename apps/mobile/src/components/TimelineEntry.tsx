import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { Lang } from '@wehdathub/shared';
import { radius, spacing, typeScale, useTheme } from '../theme';
import { AppText as Text } from './AppText';

const dateOptions = { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Cairo' } as const;
const timestamps = {
  ar: new Intl.DateTimeFormat('ar-EG', dateOptions),
  en: new Intl.DateTimeFormat('en-GB', dateOptions),
};

/** A chronological log row. Each row forms its own part of the line, including in virtualized lists. */
export function TimelineEntry({ at, title, detail, actor, lang, first, last }: {
  at: string;
  title: string;
  detail?: string | null;
  actor?: string | null;
  lang: Lang;
  first: boolean;
  last: boolean;
}) {
  const { colors } = useTheme();
  const date = new Date(at);
  const stamp = Number.isFinite(date.getTime()) ? timestamps[lang].format(date) : null;
  return (
    <View style={[styles.row, last && styles.last]}>
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={styles.track}>
        {!first ? <View style={[styles.line, styles.before, { backgroundColor: colors.primaryLine }]} /> : null}
        {!last ? <View style={[styles.line, styles.after, { backgroundColor: colors.primaryLine }]} /> : null}
        <View style={[styles.dot, { backgroundColor: colors.primarySoft, borderColor: colors.primaryInk }]} />
      </View>
      <View style={[styles.event, { backgroundColor: colors.cardSubtle, borderColor: colors.border }]}>
        {stamp || actor ? <Text style={[styles.meta, { color: colors.muted }]}>{[stamp, actor].filter(Boolean).join(' · ')}</Text> : null}
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {detail ? <Text style={[styles.detail, { color: colors.muted }]}>{detail}</Text> : null}
      </View>
    </View>
  );
}

const MARK = 18;
const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs, paddingBottom: spacing.sm },
  last: { paddingBottom: 0 },
  track: { width: 20, alignItems: 'center', marginBottom: -spacing.sm },
  line: { position: 'absolute', width: 1, start: 9.5 },
  before: { top: 0, height: MARK },
  after: { top: MARK, bottom: 0 },
  dot: { marginTop: MARK - 5, width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  event: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: radius.md, padding: spacing.sm, gap: spacing.xs },
  meta: { fontSize: typeScale.micro.fontSize },
  title: { fontSize: typeScale.bodySm.fontSize, fontWeight: '700' },
  detail: { fontSize: typeScale.bodySm.fontSize },
});
