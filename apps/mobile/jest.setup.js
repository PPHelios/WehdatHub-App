/* eslint-env jest */
jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY', WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: 'WHEN_PASSCODE_SET_THIS_DEVICE_ONLY' },
  ACCESS_CONTROL: { BIOMETRY_ANY_OR_DEVICE_PASSCODE: 'BIOMETRY_ANY_OR_DEVICE_PASSCODE' },
  getGenericPassword: jest.fn().mockResolvedValue(false),
  setGenericPassword: jest.fn().mockResolvedValue({}),
  resetGenericPassword: jest.fn().mockResolvedValue(true),
}));

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k) => (store.has(k) ? store.get(k) : null)),
      setItem: jest.fn(async (k, v) => void store.set(k, v)),
      removeItem: jest.fn(async (k) => void store.delete(k)),
    },
  };
});
jest.mock('react-native-image-picker', () => ({ launchImageLibrary: jest.fn().mockResolvedValue({ assets: [] }), launchCamera: jest.fn().mockResolvedValue({ assets: [] }) }));
jest.mock('react-native-audio-recorder-player', () => ({ __esModule: true, default: { startRecorder: jest.fn(), stopRecorder: jest.fn() } }));
jest.mock('react-native-webview', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { WebView: React.forwardRef((props, ref) => { React.useImperativeHandle(ref, () => ({ injectJavaScript: jest.fn() })); return React.createElement(View, { testID: props.testID, onMessage: props.onMessage }); }) };
});
