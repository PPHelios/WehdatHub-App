import React, { useEffect, useState } from 'react';
import { I18nManager, Modal, StyleSheet, View, useWindowDimensions } from 'react-native';
import { currentLang, useAuth } from '../auth';
import { useCoachMarks } from '../coachMarks';
import { t } from '../i18n';
import { radius, spacing, useTheme } from '../theme';
import { AppText as Text } from './AppText';
import { Button } from './Button';

interface Rect { x: number; y: number; w: number; h: number }
const PAD = 6;
const ARROW = 12;

/**
 * A one-time tip: dims the screen, leaves a rounded hole around the target and points at it.
 * It shows at most once per broker and once per app session (see useCoachMarks). Put it next to the target and pass the target's ref.
 */
export function CoachMark({ id, targetRef, text }: { id: string; targetRef: React.RefObject<React.ComponentRef<typeof View> | null>; text: string }) {
  const { colors } = useTheme();
  const brokerId = useAuth((s) => s.broker?.id);
  const active = useCoachMarks((s) => s.active === id);
  const [rect, setRect] = useState<Rect | null>(null);
  const win = useWindowDimensions();
  useEffect(() => { useCoachMarks.getState().request(id, brokerId).catch(() => undefined); }, [id, brokerId]);
  useEffect(() => {
    if (!active) return undefined;
    // Wait for the screen transition to finish, then read where the target really is.
    const timer = setTimeout(() => targetRef.current?.measureInWindow((x, y, w, h) => (w > 0 || h > 0 ? setRect({ x, y, w, h }) : useCoachMarks.getState().dismiss())), 350);
    return () => clearTimeout(timer);
  }, [active, targetRef]);
  if (!active || !rect) return null;
  const lang = currentLang();
  const hole = { left: rect.x - PAD, top: rect.y - PAD, width: rect.w + PAD * 2, height: rect.h + PAD * 2 };
  const below = hole.top + hole.height / 2 < win.height / 2;
  // Left/right swap in right-to-left layouts, but measureInWindow is always physical: convert.
  const phys = (x: number, w: number, total = win.width) => (I18nManager.isRTL ? total - x - w : x);
  const wl = Math.max(0, hole.left);
  const wr = Math.max(0, win.width - hole.left - hole.width);
  const cx = rect.x + rect.w / 2;
  const tipW = Math.min(win.width - spacing.lg * 2, 320);
  const tipX = Math.max(spacing.lg, Math.min(cx - tipW / 2, win.width - spacing.lg - tipW));
  const dim = styles.dim;
  const bottom = hole.top + hole.height;
  return (
    <Modal transparent statusBarTranslucent animationType="fade" visible onRequestClose={() => useCoachMarks.getState().dismiss()}>
      <View style={StyleSheet.absoluteFill} testID={`coach-${id}`}>
        <View style={[dim, styles.bandTop, { height: Math.max(0, hole.top) }]} />
        <View style={[dim, styles.bandBottom, { top: bottom }]} />
        <View style={[dim, { top: hole.top, height: hole.height, left: phys(0, wl), width: wl }]} />
        <View style={[dim, { top: hole.top, height: hole.height, left: phys(hole.left + hole.width, wr), width: wr }]} />
        <View pointerEvents="none" style={[styles.ring, { borderColor: colors.primaryLine, left: phys(hole.left, hole.width), top: hole.top, width: hole.width, height: hole.height }]} />
        <View style={[styles.tip, { backgroundColor: colors.card, borderColor: colors.border, width: tipW, left: phys(tipX, tipW), ...(below ? { top: bottom + ARROW } : { bottom: win.height - hole.top + ARROW }) }]}>
          <View style={[styles.arrow, { backgroundColor: colors.card, borderColor: colors.border, left: phys(cx - ARROW / 2 - tipX, ARROW, tipW), ...(below ? { top: -ARROW / 2 } : { bottom: -ARROW / 2 }) }]} />
          <Text variant="body" style={{ color: colors.text }}>{text}</Text>
          <Button testID="coach-got-it" size="sm" label={t(lang, 'coachGotIt')} onPress={() => useCoachMarks.getState().dismiss()} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.6)' },
  bandTop: { top: 0, left: 0, right: 0 },
  bandBottom: { left: 0, right: 0, bottom: 0 },
  ring: { position: 'absolute', borderWidth: 2, borderRadius: radius.md },
  tip: { position: 'absolute', borderWidth: 1, borderRadius: radius.card, padding: spacing.lg, gap: spacing.md },
  arrow: { position: 'absolute', width: ARROW, height: ARROW, borderWidth: 1, transform: [{ rotate: '45deg' }] },
});
