import React from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import { isLiquidGlassSupported, LiquidGlassView } from '@callstack/liquid-glass';
import { useTheme, type ElevationLevel } from '../theme';

interface Props {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  /** Glass reacts to touch. Leave off for containers whose children are the touch targets. */
  interactive?: boolean;
  /** Fallback shadow level; `false` for a surface that never had one. */
  elevation?: ElevationLevel | false;
  testID?: string;
}

/** True on iOS 26+ when the native module reports UIGlassEffect. */
export const glassAvailable = () => Platform.OS === 'ios' && parseInt(String(Platform.Version), 10) >= 26 && isLiquidGlassSupported;

/** iOS 26 Liquid Glass, or today's solid card + border + shadow everywhere else. */
export function GlassSurface({ style, children, interactive, elevation = 'md', testID }: Props) {
  const { colors, elev, scheme } = useTheme();
  if (glassAvailable()) {
    return (
      <LiquidGlassView testID={testID} style={style} interactive={interactive} effect="regular" colorScheme={scheme}>
        {children}
      </LiquidGlassView>
    );
  }
  return (
    <View testID={testID} style={[{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }, style, elevation ? elev(elevation) : null]}>
      {children}
    </View>
  );
}
