/* eslint-env jest */
jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY', WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: 'WHEN_PASSCODE_SET_THIS_DEVICE_ONLY' },
  ACCESS_CONTROL: { BIOMETRY_ANY_OR_DEVICE_PASSCODE: 'BIOMETRY_ANY_OR_DEVICE_PASSCODE' },
  getGenericPassword: jest.fn().mockResolvedValue(false),
  setGenericPassword: jest.fn().mockResolvedValue({}),
  resetGenericPassword: jest.fn().mockResolvedValue(true),
  isPasscodeAuthAvailable: jest.fn().mockResolvedValue(true),
  getSupportedBiometryType: jest.fn().mockResolvedValue(null),
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
jest.mock('@react-native-firebase/app', () => ({ getApps: jest.fn(() => []), initializeApp: jest.fn().mockResolvedValue({}) }));
jest.mock('@react-native-firebase/analytics', () => ({ getAnalytics: jest.fn(() => ({})), logEvent: jest.fn(), logScreenView: jest.fn(), setAnalyticsCollectionEnabled: jest.fn().mockResolvedValue(null) }));
jest.mock('@react-native-firebase/crashlytics', () => ({ getCrashlytics: jest.fn(() => ({})), recordError: jest.fn(), setUserId: jest.fn().mockResolvedValue(null), setCrashlyticsCollectionEnabled: jest.fn().mockResolvedValue(null) }));
jest.mock('@react-native-community/netinfo', () => ({ __esModule: true, default: { addEventListener: jest.fn(() => () => undefined) } }));
jest.mock('@react-native-firebase/messaging', () => ({ getMessaging: jest.fn(() => ({})), getToken: jest.fn().mockResolvedValue('t'.repeat(30)), requestPermission: jest.fn().mockResolvedValue(1), onMessage: jest.fn(() => () => undefined), onNotificationOpenedApp: jest.fn(() => () => undefined), onTokenRefresh: jest.fn(() => () => undefined), getInitialNotification: jest.fn().mockResolvedValue(null) }));

jest.mock('react-native-contacts', () => ({ __esModule: true, default: { requestPermission: jest.fn().mockResolvedValue('authorized'), getAllWithoutPhotos: jest.fn().mockResolvedValue([]) } }));
jest.mock('@bam.tech/react-native-image-resizer', () => ({ __esModule: true, default: { createResizedImage: jest.fn(async (uri) => ({ uri: `${uri}.min.jpg`, name: 'x.jpg', size: 1000 })) } }));
jest.mock('@react-native-camera-roll/camera-roll', () => ({ CameraRoll: { saveAsset: jest.fn().mockResolvedValue({}) } }));
