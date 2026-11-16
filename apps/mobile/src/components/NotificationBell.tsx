import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { currentLang } from '../auth';
import { t } from '../i18n';
import { useTheme } from '../theme';
import { Icon } from './Icon';

/** The bell in the top bar: opens the inbox, with the number of unread notifications on it. */
export function NotificationBell({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  const q = useQuery({ queryKey: ['inbox-unread'], queryFn: () => api.notificationsInbox(1), refetchInterval: 60_000, staleTime: 30_000 });
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
  count: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
});
