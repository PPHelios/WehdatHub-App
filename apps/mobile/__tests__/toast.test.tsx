import React from 'react';
import { act, render, screen, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastHost, toast, toastError, useToastStore } from '../src/components/Toast';

declare const require: (id: string) => any;
declare const __dirname: string;
const fs = require('fs');
const path = require('path');

test('a toast shows near the bottom and closes on a tap', async () => {
  await render(<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}><ToastHost /></SafeAreaProvider>);
  expect(screen.queryByTestId('toast')).toBeNull();
  await act(async () => toast('Could not save.', true));
  expect(screen.getByText('Could not save.')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('toast'));
  expect(screen.queryByTestId('toast')).toBeNull();
});

// One message style: a pop-up alert is only for "are you sure?" (it has buttons). Results and errors are toasts.
test('every Alert.alert in the app is a question with buttons', () => {
  const root = path.join(__dirname, '../src');
  const files: string[] = [];
  const walk = (d: string) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.tsx?$/.test(f)) files.push(p); } };
  walk(root);
  const bad: string[] = [];
  for (const p of files) {
    const s = fs.readFileSync(p, 'utf8');
    for (const m of s.matchAll(/Alert\.alert\(/g)) {
      // The call's text up to its closing parenthesis at the same depth.
      let depth = 0; let i = m.index! + 'Alert.alert'.length; let end = i;
      for (; i < s.length; i++) { if (s[i] === '(') depth++; else if (s[i] === ')') { depth--; if (depth === 0) { end = i; break; } } }
      const call = s.slice(m.index!, end);
      if (!/\[\s*\{|buttons/.test(call)) bad.push(`${path.relative(root, p)}: ${call.slice(0, 80)}`);
    }
  }
  expect(bad).toEqual([]);
});

test('toastError shows the error in the toast and hands it back for the form', () => {
  expect(toastError('Phone is not valid.')).toBe('Phone is not valid.');
  expect(useToastStore.getState()).toMatchObject({ text: 'Phone is not valid.', bad: true });
  expect(toastError(null)).toBeNull();
});
