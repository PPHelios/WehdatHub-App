import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useQuery } from '@tanstack/react-query';
import type { SearchCredits } from '@wehdathub/shared';
import { api } from '../api';
import { useAuth } from '../auth';

const SIZE = 52;
const RADIUS = 23.5;
const CIRCUMFERENCE = Math.PI * 2 * RADIUS;

export function useSearchCredits() {
  const broker = useAuth((state) => state.broker);
  return useQuery({ queryKey: ['search-credits', broker?.id, broker?.role], queryFn: () => api.searchCredits(), enabled: Boolean(broker?.id), staleTime: 60000 });
}

/** Dynamic credit health colors based on quota ratio: Emerald (>40%), Amber (15-40%), Red (<15%). */
export function creditRatioColor(ratio: number): string {
  if (ratio <= 0.15) return '#EF4444'; // Red: under 15% remaining
  if (ratio <= 0.40) return '#F59E0B'; // Amber: 15-40% remaining
  return '#10B981';                   // Emerald green: healthy (>40%)
}

export function SearchCreditRings({ data }: { data?: SearchCredits | null }) {
  const personalMeter = data?.personal ?? { remaining: 10, limit: 10, used: 0 };
  const agencyMeter = data?.agency;
  const hasAgency = Boolean(agencyMeter);
  const meters = hasAgency && agencyMeter ? [personalMeter, agencyMeter] : [personalMeter];
  const arc = hasAgency ? CIRCUMFERENCE / 2 - 7 : CIRCUMFERENCE - 7;

  return (
    <View pointerEvents="none" style={styles.wrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={48} height={48} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {meters.map((meter, index) => {
          const rotation = (hasAgency ? 188 : -82) + index * 180;
          const ratio = meter.limit === null ? 1 : meter.limit && meter.remaining !== null ? Math.max(0, Math.min(1, meter.remaining / meter.limit)) : (data ? 0 : 0.85);
          const color = creditRatioColor(ratio);
          return (
            <React.Fragment key={index}>
              <Circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke={color} strokeOpacity={0.22}
                strokeWidth={2.5} strokeLinecap="round" strokeDasharray={[arc, CIRCUMFERENCE]} rotation={rotation} originX={SIZE / 2} originY={SIZE / 2} />
              {ratio > 0 ? (
                <Circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke={color} strokeOpacity={index ? 0.9 : 1}
                  strokeWidth={2.5} strokeLinecap="round" strokeDasharray={[arc * ratio, CIRCUMFERENCE]} rotation={rotation} originX={SIZE / 2} originY={SIZE / 2} />
              ) : null}
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

