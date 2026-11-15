/**
 * @format
 */

import { AppRegistry, Text, TextInput } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// Phone text-size settings are followed, but capped so screens do not break.
Text.defaultProps = { ...Text.defaultProps, maxFontSizeMultiplier: 1.5 };
TextInput.defaultProps = { ...TextInput.defaultProps, maxFontSizeMultiplier: 1.5 };
AppRegistry.registerComponent(appName, () => App);
