import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text } from './AppText';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { currentLang } from '../auth';
import { t } from '../i18n';
import { typeScale, useTheme } from '../theme';
import { Icon } from './Icon';

/** The unread count. The tabs screen adds the one-minute refetch; the bell only reads it. The key sits under ['inbox'], so refreshing the inbox refreshes the badge. */
export const inboxUnreadOptions = { queryKey: ['inbox', 'unread'], queryFn: () => api.notificationsInbox(1), staleTime: 30_000 } as const;

/** The bell in the top bar: opens the inbox, with the number of unread notifications on it. */
export function NotificationBell({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  const q = useQuery(inboxUnreadOptions);
  const unread = q.data?.unread ?? 0;
  return (
    <Pressable testID="bell" accessibilityRole="button" accessibilityLabel={t(currentLang(), 'inbox')} hitSlop={8} onPress={onPress} style={styles.btn}>
      <Icon name="bell" color={colors.text} size={24} />
      {unread > 0 ? (
        <View testID="bell-badge" style={[styles.badge, { backgroundColor: colors.danger }]}>
          <Text style={[styles.count, { color: colors.onDanger }]}>{unread > 99 ? '99+' : unread}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginHorizontal: 4 },
  badge: { position: 'absolute', top: 3, end: 2, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  count: { fontSize: typeScale.micro.fontSize, fontWeight: '800' },
});
