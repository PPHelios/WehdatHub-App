module.exports = {
  preset: '@react-native/jest-preset',
  resolver: 'react-native-reanimated/jest/resolver',
  testTimeout: 20000, // the first screen render in a file is slow on a cold CI machine
  setupFiles: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|react-native-keychain|react-native-reanimated|react-native-worklets|react-native-gesture-handler|react-native-screens|react-native-safe-area-context|@shopify/flash-list|@wehdathub)/)',
  ],
};
