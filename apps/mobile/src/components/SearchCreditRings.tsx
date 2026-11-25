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

export function SearchCreditRings({ data, loading = false, error = false, ar = false }: { data?: SearchCredits | null; loading?: boolean; error?: boolean; ar?: boolean }) {
  const neutral = loading || error || !data;
  const personalMeter = data?.personal;
  const agencyMeter = data?.agency;
  const hasAgency = Boolean(agencyMeter);
  const meters = neutral ? [{ limit: null, remaining: null, used: 0 }] : (hasAgency && agencyMeter && personalMeter ? [personalMeter, agencyMeter] : personalMeter ? [personalMeter] : []);
  const arc = !neutral && hasAgency ? CIRCUMFERENCE / 2 - 7 : CIRCUMFERENCE - 7;

  let accessibilityLabel: string;
  if (loading) {
    accessibilityLabel = ar ? 'جاري تحميل رصيد البحث' : 'Loading search credits';
  } else if (error || !personalMeter) {
    accessibilityLabel = ar ? 'تعذر تحميل رصيد البحث' : 'Search credits unavailable';
  } else if (personalMeter.limit === null) {
    accessibilityLabel = ar ? 'رصيد البحث غير محدود' : 'Unlimited search credits';
  } else {
    const pText = ar
      ? `رصيد البحث ${personalMeter.remaining ?? 0} من ${personalMeter.limit}`
      : `Personal search credits: ${personalMeter.remaining ?? 0} of ${personalMeter.limit} remaining`;
    const aText = agencyMeter && agencyMeter.limit !== null
      ? (ar ? ` · رصيد الشركة ${agencyMeter.remaining ?? 0} من ${agencyMeter.limit}` : ` · Agency credits: ${agencyMeter.remaining ?? 0} of ${agencyMeter.limit}`)
      : '';
    accessibilityLabel = `${pText}${aText}`;
  }

  return (
    <View testID="search-credit-rings" pointerEvents="none" style={styles.wrap} accessibilityLabel={accessibilityLabel}>
      <Svg width={48} height={48} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {meters.map((meter, index) => {
          const rotation = (!neutral && hasAgency ? 188 : -82) + index * 180;
          if (neutral) {
            return (
              <Circle key={index} cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="#9CA3AF" strokeOpacity={0.35}
                strokeWidth={2.5} strokeLinecap="round" strokeDasharray={[arc, CIRCUMFERENCE]} rotation={rotation} originX={SIZE / 2} originY={SIZE / 2} />
            );
          }
          const ratio = meter.limit === null ? 1 : meter.limit && meter.remaining !== null ? Math.max(0, Math.min(1, meter.remaining / meter.limit)) : 0;
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
