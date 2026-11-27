import React, { useCallback, useEffect, useRef, useState } from 'react';
import { I18nManager, StyleSheet, View, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeInDown, ReduceMotion, ZoomIn, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import type { Rights } from '@wehdathub/shared';
import { api } from '../api';
import { track } from '../analytics';
import { currentLang, useAuth } from '../auth';
import { AppText as Text } from '../components/AppText';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Icon } from '../components/Icon';
import type { IconName } from '../components/Icon';
import { Pill } from '../components/Pill';
import { t } from '../i18n';
import type { StringKey } from '../i18n';
import { DURATION, SPRING, enter } from '../motion';
import type { RootStackParams } from '../navigation';
import { meOptions } from '../queries';
import { radius, spacing, useTheme } from '../theme';

export const welcomeKey = (brokerId: string) => `wehdathub.welcomeSeen:${brokerId}`;

/** Whether this broker still has to see the welcome: 'checking' until storage answers. A storage failure counts as seen. */
export function useWelcomeState(brokerId?: string): 'checking' | 'show' | 'done' {
  const [state, setState] = useState<{ id?: string; v: 'show' | 'done' }>({ v: 'done' });
  useEffect(() => {
    if (!brokerId) return undefined;
    let live = true;
    AsyncStorage.getItem(welcomeKey(brokerId)).then((seen) => live && setState({ id: brokerId, v: seen ? 'done' : 'show' })).catch(() => live && setState({ id: brokerId, v: 'done' }));
    return () => { live = false; };
  }, [brokerId]);
  return brokerId && state.id !== brokerId ? 'checking' : state.v;
}

/** Where the broker lands after the welcome. Data entry and a manager, owner or solo broker with no unit yet start by adding a unit; brokers and team leads land on Home, where Search practice is offered. */
export function welcomeTarget(rights: Rights, solo: boolean, unitCount: number): 'AddUnit' | 'Tabs' {
  if (rights.dataEntry) return 'AddUnit';
  if (rights.agencyOwner || rights.manager || solo) return unitCount === 0 ? 'AddUnit' : 'Tabs';
  return 'Tabs';
}

const SLIDES = [
  { title: 'welcomeAsk', body: 'welcomeAskBody' },
  { title: 'welcomeToday', body: 'welcomeTodayBody' },
  { title: 'welcomeSend', body: 'welcomeSendBody' },
] as const satisfies readonly { title: StringKey; body: StringKey }[];

function UnitMini({ lang }: { lang: 'ar' | 'en' }) {
  const { colors } = useTheme();
  return (
    <Card variant="elevated" style={styles.unit} testID="welcome-unit">
      <View style={[styles.photo, { backgroundColor: colors.primarySoft }]}><Icon name="building" color={colors.primaryInk} size={26} /></View>
      <View style={styles.flex}>
        <Text variant="body" weight="bold" style={{ color: colors.text }}>{t(lang, 'welcomeDemoUnit')}</Text>
        <Text variant="bodySm" style={{ color: colors.primaryInk }}>{t(lang, 'welcomeDemoPrice')}</Text>
      </View>
    </Card>
  );
}

function Pulse({ still }: { still: boolean }) {
  const { colors } = useTheme();
  const s = useSharedValue(1);
  useEffect(() => {
    if (still) return undefined;
    s.value = withRepeat(withSequence(withTiming(1.18, { duration: 700 }), withTiming(1, { duration: 700 })), -1);
    return () => cancelAnimation(s);
  }, [still, s]);
  const ring = useAnimatedStyle(() => ({ transform: [{ scale: s.value }], opacity: 2.2 - s.value }));
  return (
    <View style={styles.micBox}>
      <Animated.View style={[styles.micRing, { backgroundColor: colors.primarySoft }, ring]} />
      <View style={[styles.mic, { backgroundColor: colors.primary }]}><Icon name="mic" color={colors.onPrimary} size={30} /></View>
    </View>
  );
}

/** The picture of one slide. `live` plays its entrance (a slide that is not on screen stays still). */
function Art({ i, live, reduced, lang }: { i: number; live: boolean; reduced: boolean; lang: 'ar' | 'en' }) {
  const { colors } = useTheme();
  const play = live && !reduced;
  const rise = (n: number) => (play ? enter(n) : undefined);
  if (i === 0) {
    return (
      <View style={styles.art}>
        <Pulse still={!play} />
        <Animated.View entering={rise(1)} style={[styles.bubble, { backgroundColor: colors.primary }]}>
          <Text variant="body" style={{ color: colors.onPrimary }}>{t(lang, 'welcomeDemoAsk')}</Text>
        </Animated.View>
        <Animated.View entering={rise(3)} style={styles.full}><UnitMini lang={lang} /></Animated.View>
      </View>
    );
  }
  if (i === 1) {
    const rows: [IconName, StringKey][] = [['chat', 'welcomeRow1'], ['calendar', 'welcomeRow2'], ['units', 'welcomeRow3']];
    return (
      <View style={styles.art}>
        {rows.map(([icon, k], n) => (
          <Animated.View key={k} entering={play ? FadeInDown.delay(n * 160).springify().damping(SPRING.damping).stiffness(SPRING.stiffness).reduceMotion(ReduceMotion.System) : undefined} style={styles.full}>
            <Card style={styles.row} testID={`welcome-row-${n}`}>
              <View style={[styles.rowIcon, { backgroundColor: colors.primarySoft }]}><Icon name={icon} color={colors.primaryInk} size={20} /></View>
              <Text variant="body" style={[styles.flex, { color: colors.text }]}>{t(lang, k)}</Text>
            </Card>
          </Animated.View>
        ))}
      </View>
    );
  }
  return (
    <View style={styles.art}>
      <Animated.View entering={rise(0)} style={styles.full}><UnitMini lang={lang} /></Animated.View>
      <Animated.View entering={play ? ZoomIn.delay(500).duration(DURATION.base).reduceMotion(ReduceMotion.System) : undefined}>
        <Pill tone="primary" solid label={t(lang, 'welcomeSent')} testID="welcome-sent" />
      </Animated.View>
    </View>
  );
}

/** Three swipeable slides shown once per broker after the first sign-in, then on to the first useful screen for the role. */
export function WelcomeScreen() {
  const { colors } = useTheme();
  const lang = currentLang();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const qc = useQueryClient();
  const brokerId = useAuth((s) => s.broker?.id);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const last = index === SLIDES.length - 1;
  // Slide 0 sits at the start edge: physically left in English, right in Arabic, so the strip moves the other way there.
  const dir = I18nManager.isRTL ? 1 : -1;
  const x = useSharedValue(0);
  const base = useSharedValue(0);
  useEffect(() => {
    base.value = dir * index * width;
    x.value = withTiming(base.value, { duration: reduced ? 0 : DURATION.slow });
  }, [index, width, dir, reduced, base, x]);
  const go = useCallback((by: number) => setIndex((i) => Math.max(0, Math.min(SLIDES.length - 1, i + by))), []);
  const pan = Gesture.Pan()
    .activeOffsetX([-16, 16])
    .failOffsetY([-16, 16])
    .onUpdate((e) => { x.value = base.value + e.translationX; })
    .onEnd((e) => {
      // A drag toward the start edge goes forward: leftwards in English, rightwards in Arabic.
      const forward = dir * e.translationX > 0 ? -1 : 1;
      if (Math.abs(e.translationX) > width / 4 || Math.abs(e.velocityX) > 600) scheduleOnRN(go, forward);
      else x.value = withTiming(base.value, { duration: DURATION.fast });
    });
  const strip = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const busy = useRef(false);

  const finish = async (skipped: boolean) => {
    if (busy.current) return;
    busy.current = true;
    if (brokerId) await AsyncStorage.setItem(welcomeKey(brokerId), '1').catch(() => undefined);
    track('welcome_completed', { skipped: skipped ? 1 : 0 });
    let target: 'AddUnit' | 'Tabs' = 'Tabs';
    try {
      const me = await qc.fetchQuery(meOptions());
      const solo = Boolean(me.workspace?.solo);
      const counts = !me.rights.dataEntry && (me.rights.agencyOwner || me.rights.manager || solo);
      target = welcomeTarget(me.rights, solo, counts ? (await api.units()).total : 1);
    } catch {
      // Could not tell the role: the tabs are always a safe landing.
    }
    nav.reset({ index: target === 'AddUnit' ? 1 : 0, routes: target === 'AddUnit' ? [{ name: 'Tabs' }, { name: 'AddUnit' }] : [{ name: 'Tabs' }] });
  };

  return (
    <View testID="welcome" style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.lg }]}>
      <View style={styles.top}>
        <Button testID="welcome-skip" variant="quiet" size="sm" label={t(lang, 'welcomeSkip')} onPress={() => finish(true)} />
      </View>
      <GestureDetector gesture={pan}>
        <View style={styles.flex}>
          <Animated.View style={[styles.strip, { width: width * SLIDES.length }, strip]}>
            {SLIDES.map((s, i) => (
              <View key={s.title} testID={`welcome-slide-${i}`} accessible accessibilityLabel={t(lang, 'welcomeSlide').replace('{n}', String(i + 1)).replace('{total}', String(SLIDES.length))} style={[styles.slide, { width }]}>
                <Art i={i} live={i === index} reduced={reduced} lang={lang} />
                <Text variant="title" style={[styles.center, { color: colors.text }]}>{t(lang, s.title)}</Text>
                <Text variant="body" style={[styles.center, { color: colors.muted }]}>{t(lang, s.body)}</Text>
              </View>
            ))}
          </Animated.View>
        </View>
      </GestureDetector>
      <View style={styles.dots}>
        {SLIDES.map((s, i) => <View key={s.title} testID={`welcome-dot-${i}`} style={[styles.dot, i === index && styles.dotOn, { backgroundColor: i === index ? colors.primary : colors.border }]} />)}
      </View>
      <View style={styles.cta}>
        <Button testID="welcome-next" label={t(lang, last ? 'welcomeStart' : 'welcomeNext')} onPress={() => (last ? finish(false) : go(1))} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  full: { alignSelf: 'stretch' },
  screen: { flex: 1 },
  top: { alignSelf: 'flex-end', paddingHorizontal: spacing.lg },
  strip: { flex: 1, flexDirection: 'row' },
  slide: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.md },
  art: { alignSelf: 'stretch', minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: spacing.md, marginBottom: spacing.lg },
  center: { textAlign: 'center' },
  micBox: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  micRing: { position: 'absolute', width: 96, height: 96, borderRadius: 48 },
  mic: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  bubble: { alignSelf: 'flex-end', maxWidth: '85%', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.card },
  unit: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  photo: { width: 52, height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', alignSelf: 'center', gap: spacing.xs, paddingVertical: spacing.lg },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotOn: { width: 22 },
  cta: { paddingHorizontal: spacing.xl },
});
