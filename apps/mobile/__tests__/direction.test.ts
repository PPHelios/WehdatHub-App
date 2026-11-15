import { I18nManager } from 'react-native';
import { syncDirection, wantsRtl } from '../src/direction';

test('Arabic is right to left and English left to right', () => {
  expect(wantsRtl('ar')).toBe(true);
  expect(wantsRtl('en')).toBe(false);
});

test('a change of direction is saved and asks for a reopen; no change asks for nothing', () => {
  const force = jest.spyOn(I18nManager, 'forceRTL').mockImplementation(() => undefined);
  const rtl = I18nManager.isRTL;
  expect(syncDirection(rtl ? 'ar' : 'en')).toBe(false);
  expect(syncDirection(rtl ? 'en' : 'ar')).toBe(true);
  expect(force).toHaveBeenCalledWith(!rtl);
  force.mockRestore();
});
