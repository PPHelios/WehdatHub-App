const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const root = path.resolve(__dirname, '../..');

/** @type {import('@react-native/metro-config').MetroConfig} */
const config = {
  watchFolders: [path.join(root, 'packages'), path.join(root, 'node_modules')],
  resolver: { nodeModulesPaths: [path.join(root, 'node_modules')] },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
