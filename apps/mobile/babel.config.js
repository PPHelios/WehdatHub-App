module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // zod's ESM uses `export * as x from`, which the preset leaves alone.
  plugins: ['@babel/plugin-transform-export-namespace-from'],
};
