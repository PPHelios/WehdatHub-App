import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useQuery } from '@tanstack/react-query';
import type { SearchCredits } from '@wehdathub/shared';
import { api } from '../api';
import { useAuth } from '../auth';
import { useTheme } from '../theme';

const SIZE = 48;
const RADIUS = 21;
const CIRCUMFERENCE = Math.PI * 2 * RADIUS;

export function useSearchCredits() {
  const broker = useAuth((state) => state.broker);
  return useQuery({ queryKey: ['search-credits', broker?.id, broker?.role], queryFn: () => api.searchCredits(), enabled: Boolean(broker?.id), staleTime: 60000 });
}

export function SearchCreditRings({ data }: { data: SearchCredits }) {
  const { colors } = useTheme();
  const meters = data.agency ? [data.personal, data.agency] : [data.personal];
  const arc = data.agency ? CIRCUMFERENCE / 2 - 7 : CIRCUMFERENCE - 7;
  return <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Svg width={SIZE} height={SIZE} viewBox="0 0 48 48">
      {meters.map((meter, index) => {
        const rotation = (data.agency ? 188 : -82) + index * 180;
        const ratio = meter.limit === null ? 1 : meter.limit && meter.remaining !== null ? Math.max(0, Math.min(1, meter.remaining / meter.limit)) : 0;
        const color = colors.onPrimary;
        return <React.Fragment key={index}>
          <Circle cx={24} cy={24} r={RADIUS} fill="none" stroke={color} strokeOpacity={0.25}
            strokeWidth={2} strokeLinecap="round" strokeDasharray={[arc, CIRCUMFERENCE]} rotation={rotation} originX={24} originY={24} />
          {ratio > 0 ? <Circle cx={24} cy={24} r={RADIUS} fill="none" stroke={color} strokeOpacity={index ? 0.7 : 1}
            strokeWidth={2} strokeLinecap="round" strokeDasharray={[arc * ratio, CIRCUMFERENCE]} rotation={rotation} originX={24} originY={24} /> : null}
        </React.Fragment>;
      })}
    </Svg>
  </View>;
}

