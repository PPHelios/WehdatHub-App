module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // zod's ESM uses `export * as x from`, which the preset leaves alone.
  // The worklets plugin (Reanimated 4) must stay last.
  plugins: ['@babel/plugin-transform-export-namespace-from', 'react-native-worklets/plugin'],
};
