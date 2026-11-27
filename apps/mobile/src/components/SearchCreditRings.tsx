import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useQuery } from '@tanstack/react-query';
import type { Lang, SearchCredits } from '@wehdathub/shared';
import { t } from '../i18n';
import { api } from '../api';
import { useAuth } from '../auth';
import { SPRING } from '../motion';
import { useTheme } from '../theme';

const LANG_AR: Lang = 'ar';
const LANG_EN: Lang = 'en';
const STROKE = 7;
const GAP = 4;
/** The ring sits outside the button: this far past each edge. */
const OUTSET = GAP + STROKE;
const DEFAULT_SIZE = 48 + 2 * OUTSET;
const FILL_MS = 900;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function useSearchCredits() {
  const broker = useAuth((state) => state.broker);
  return useQuery({ queryKey: ['search-credits', broker?.id, broker?.role], queryFn: () => api.searchCredits(), enabled: Boolean(broker?.id), staleTime: 60000 });
}

type CreditColors = { creditOk: string; warn: string; danger: string };

/** Credit health colour from the quota ratio: healthy (>40%), warning (15-40%), low (<15%). Pass the theme's colors. */
export function creditRatioColor(ratio: number, c: CreditColors): string {
  if (ratio <= 0.15) return c.danger;
  if (ratio <= 0.4) return c.warn;
  return c.creditOk;
}

/** One arc of the ring. Fills from 0 to `ratio` once the ring has landed. */
function Arc({ size, arc, rotation, ratio, color, track, reduced }: { size: number; arc: number; rotation: number; ratio: number; color: string; track: string; reduced: boolean }) {
  const r = (size - STROKE) / 2;
  const c = size / 2;
  const circ = Math.PI * 2 * r;
  const p = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) p.value = withDelay(250, withTiming(1, { duration: FILL_MS, easing: Easing.out(Easing.cubic) }));
  }, [reduced, p]);
  const props = useAnimatedProps(() => ({ strokeDasharray: `${arc * ratio * p.value} ${circ}` }));
  const common = { cx: c, cy: c, r, fill: 'none', strokeWidth: STROKE, strokeLinecap: 'round', rotation, originX: c, originY: c } as const;
  return (
    <>
      <Circle {...common} stroke={track} strokeDasharray={[arc, circ]} />
      {ratio > 0 ? <AnimatedCircle {...common} stroke={color} animatedProps={props} /> : null}
    </>
  );
}

export function SearchCreditRings({ data, loading = false, error = false, ar = false }: { data?: SearchCredits | null; loading?: boolean; error?: boolean; ar?: boolean }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const [size, setSize] = useState(DEFAULT_SIZE);
  const neutral = loading || error || !data;
  const personalMeter = data?.personal;
  const agencyMeter = data?.agency;
  const hasAgency = Boolean(agencyMeter);
  const meters = neutral ? [{ limit: null, remaining: null, used: 0 }] : (hasAgency && agencyMeter && personalMeter ? [personalMeter, agencyMeter] : personalMeter ? [personalMeter] : []);
  const circ = Math.PI * (size - STROKE);
  const arc = !neutral && hasAgency ? circ / 2 - 7 : circ - 7;

  // On mount the ring starts 10px out toward the top-end corner, larger and invisible, then springs in.
  const land = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) land.value = withSpring(1, SPRING);
  }, [reduced, land]);
  const landStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, land.value * 2),
    transform: [{ translateX: 10 * (1 - land.value) }, { translateY: -10 * (1 - land.value) }, { scale: 1 + 0.25 * (1 - land.value) }],
  }));

  const lang: Lang = ar ? LANG_AR : LANG_EN;
  let accessibilityLabel: string;
  if (loading) {
    accessibilityLabel = t(lang, 'scLoading');
  } else if (error || !personalMeter) {
    accessibilityLabel = t(lang, 'scUnavailable');
  } else if (personalMeter.limit === null) {
    accessibilityLabel = t(lang, 'scUnlimited');
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
    <Animated.View
      testID="search-credit-rings"
      pointerEvents="none"
      style={[styles.wrap, landStyle]}
      accessibilityLabel={accessibilityLabel}
      onLayout={(e) => setSize(e.nativeEvent.layout.width || DEFAULT_SIZE)}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {meters.map((meter, index) => {
          const rotation = (!neutral && hasAgency ? 188 : -82) + index * 180;
          const ratio = neutral ? 0 : meter.limit === null ? 1 : meter.limit && meter.remaining !== null ? Math.max(0, Math.min(1, meter.remaining / meter.limit)) : 0;
          return <Arc key={index} size={size} arc={arc} rotation={rotation} ratio={ratio} color={creditRatioColor(ratio, colors)} track={colors.border} reduced={reduced} />;
        })}
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: -OUTSET,
    left: -OUTSET,
    right: -OUTSET,
    bottom: -OUTSET,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
