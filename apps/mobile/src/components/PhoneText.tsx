import React from 'react';
import { AppText as Text } from './AppText';
import type { TextProps } from 'react-native';
import { displayPhone, ltr } from '@wehdathub/shared';

/** A phone number that keeps its digit groups in order inside RTL text. */
export function PhoneText({ value, format, ...props }: { value: string; format?: boolean } & TextProps) {
  return <Text {...props}>{ltr(format ? displayPhone(value) : value)}</Text>;
}
