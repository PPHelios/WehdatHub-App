import React from 'react';
import { StyleSheet } from 'react-native';
import { COLORS } from '@wehdathub/shared';
import { render, screen } from '@testing-library/react-native';
import { Chips } from '../src/components/Chips';
import { Field } from '../src/components/Field';
import { usePrefs } from '../src/prefs';
import { GREEN_PALETTE } from '../src/theme';

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

test('phone-pad fields always force left-to-right direction even when empty', async () => {
  await render(<Field label="Owner" value="" keyboardType="phone-pad" />);
  expect(styleOf()).toMatchObject({ direction: 'ltr', writingDirection: 'ltr', textAlign: 'left' });
});

test.each(['light', 'dark'] as const)('required fields and chip groups use green in %s mode and red for errors', async (appearance) => {
  const previous = usePrefs.getState().appearance;
  usePrefs.setState({ appearance });
  const opts = [{ value: 'sale', label: 'Sale' }, { value: 'rent', label: 'Rent' }];
  const form = (value: string, invalid = false) => (
    <>
      <Field label="Owner" value={value} required invalid={invalid} />
      <Chips testID="c" required invalid={invalid} options={opts} value={value} onChange={() => undefined} />
    </>
  );
  try {
    const r = await render(form(''));
    const chipStyle = () => StyleSheet.flatten(screen.getByTestId('c').props.style);
    const ink = appearance === 'dark' ? GREEN_PALETTE.primaryInkDark : GREEN_PALETTE.primaryInk;
    expect(styleOf().borderColor).toBe(ink);
    expect(chipStyle().borderColor).toBe(ink);

    await r.rerender(form('sale'));
    const line = appearance === 'dark' ? GREEN_PALETTE.primaryLineDark : GREEN_PALETTE.primaryLine;
    expect(styleOf().borderColor).toBe(line);
    expect(chipStyle().borderColor).toBe(line);

    await r.rerender(form('', true));
    expect(styleOf().borderColor).toBe(COLORS[appearance].bad);
    expect(chipStyle().borderColor).toBe(COLORS[appearance].bad);
    await r.unmount();
  } finally {
    usePrefs.setState({ appearance: previous });
  }
});
