import React from 'react';
import { render, screen } from '@testing-library/react-native';
import type { ApiLead } from '@wehdathub/shared';
import { LeadCard } from '../src/components/LeadCard';

const lead = { ref: 'L-0001', name: 'Client', phones: [], kind: 'buyer', stage: 'new', assignee: 'Mona', assigneeId: 'b1', version: 1 } as unknown as ApiLead;

test('assignee photo shows beside the name only when the lead carries one', async () => {
  const { rerender } = await render(<LeadCard lead={{ ...lead, assigneeAvatarUrl: 'https://x/a.jpg' }} lang="en" onPress={() => undefined} />);
  expect(screen.getByTestId('avatar-photo')).toBeTruthy();
  expect(screen.getByText('Mona')).toBeTruthy();
  await rerender(<LeadCard lead={lead} lang="en" onPress={() => undefined} />);
  expect(screen.queryByTestId('avatar-photo')).toBeNull();
});
