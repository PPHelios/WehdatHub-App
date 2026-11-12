import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BottomSafe } from '../src/components/BottomSafe';

test('content is padded above the bottom bar', async () => {
  await render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 360, height: 700 }, insets: { top: 0, left: 0, right: 0, bottom: 34 } }}>
      <BottomSafe><Text>body</Text></BottomSafe>
    </SafeAreaProvider>,
  );
  expect(screen.getByTestId('bottom-safe').props.style).toMatchObject({ paddingBottom: 34 });
});
