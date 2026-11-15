import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Keeps the content of a pushed screen above the phone's own bottom bar (gesture bar or three buttons). */
export function BottomSafe({ children }: { children: React.ReactNode }) {
  const { bottom } = useSafeAreaInsets();
  return <View testID="bottom-safe" style={{ flex: 1, paddingBottom: bottom }}>{children}</View>;
}
