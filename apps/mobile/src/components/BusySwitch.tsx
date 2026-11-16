import React from 'react';
import { Switch } from 'react-native';
import type { SwitchProps } from 'react-native';
import { useBusyDisabled } from '../busy';

/** The app's switch: like a plain Switch, but it cannot be flipped while a server write runs (busy rule). */
export function BusySwitch({ disabled, ...props }: SwitchProps) {
  const busy = useBusyDisabled();
  return <Switch {...props} disabled={disabled || busy} />;
}
