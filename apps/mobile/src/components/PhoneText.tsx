import React from 'react';
import { AppText as Text } from './AppText';
import type { TextProps } from 'react-native';
import type { TypeVariant } from '../theme';
import { displayPhone, ltr } from '@wehdathub/shared';

/** True when a display string (such as a lead name fallback) is a phone number rather than a person's name. */
export function looksLikePhone(value: string | null | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  return /\d{5,}/.test(trimmed) && /^[\d\s+\-().\u202A\u202C\u2066\u2069]+$/.test(trimmed);
}

/** A phone number that keeps its digit groups in order inside RTL text. */
export function PhoneText({ value, format, style, ...props }: { value: string; format?: boolean; variant?: TypeVariant; weight?: 'regular' | 'bold' } & TextProps) {
  return <Text {...props} style={[{ writingDirection: 'ltr' }, style]}>{ltr(format ? displayPhone(value) : value)}</Text>;
}
