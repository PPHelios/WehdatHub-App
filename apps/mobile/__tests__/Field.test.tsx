import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { Field } from '../src/components/Field';

const styleOf = () => StyleSheet.flatten(screen.getByLabelText('Owner').props.style);

test('a bare phone number is left-to-right so its digit groups keep their order', async () => {
  await render(<Field label="Owner" value="0101 234 5622" />);
  expect(styleOf()).toMatchObject({ writingDirection: 'ltr', textAlign: 'left' });
});

test('Arabic text stays right-to-left and empty text has no forced direction', async () => {
  const r = await render(<Field label="Owner" value="أحمد 0101" />);
  expect(styleOf()).toMatchObject({ writingDirection: 'rtl', textAlign: 'right' });
  await r.rerender(<Field label="Owner" value="" />);
  expect(styleOf().writingDirection).toBeUndefined();
});
