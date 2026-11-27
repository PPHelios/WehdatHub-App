import React from 'react';
import { Pressable, View } from 'react-native';
import type { AssistantCardLink } from '@wehdathub/shared';
import { SectionCard } from '../SectionCard';

/** Shared shell of a chart card: the summary is its accessibility label; a card with a link opens that screen on tap. */
export function ChartFrame({ testID, title, summary, link, onNavigate, children }: {
  testID: string;
  title?: string;
  summary?: string;
  link?: AssistantCardLink;
  onNavigate?: (screen: string, params?: Record<string, unknown>) => void;
  children: React.ReactNode;
}) {
  const linked = Boolean(link && onNavigate);
  const body = <View accessible={Boolean(summary) && !linked} accessibilityLabel={linked ? undefined : summary}>{children}</View>;
  return (
    <SectionCard testID={testID} title={title}>
      {link && onNavigate ? <Pressable accessibilityRole="button" accessibilityLabel={summary} onPress={() => onNavigate(link.screen, link.params)}>{body}</Pressable> : body}
    </SectionCard>
  );
}
