import React from 'react';
import { StyleSheet, View } from 'react-native';
import { InitialAvatar } from './InitialAvatar';
import { SmartImage } from './SmartImage';

export type AvatarSize = 28 | 40 | 96;

/** A person's photo in a circle, or their initials when they have none. */
export function Avatar({ name, uri, size = 40 }: { name: string | null; uri?: string | null; size?: AvatarSize }) {
  const box = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View testID="avatar" style={[box, styles.clip]}>
      {uri ? <SmartImage testID="avatar-photo" uri={uri} style={box} /> : <InitialAvatar name={name} size={size} />}
    </View>
  );
}

const styles = StyleSheet.create({ clip: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' } });
