import React, { useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { dropIndex, moveItem } from '@wehdathub/shared';
import type { UploadFile } from '@wehdathub/shared';
import { radius, spacing, useTheme } from '../theme';
import { SmartImage } from './SmartImage';

const ROW = 76;

interface Props {
  photos: UploadFile[];
  onChange: (next: UploadFile[]) => void;
  /** Lets the page stop scrolling while a photo is held, so the drag never fights the scroll. */
  onDragging?: (dragging: boolean) => void;
  removeLabel: string;
  /** A failed upload can be tried again. */
  onRetry?: (uri: string) => void;
  /** Picked photos are kept or dropped here (only 15 are kept); the label shows the state. */
  onToggle?: (uri: string) => void;
  keepLabel?: string;
  skipLabel?: string;
}

/** Drag-and-drop photo order: hold the ⋮⋮ handle, move the photo up or down, let go. The first photo is the cover. */
export function SortablePhotos({ photos, onChange, onDragging, removeLabel, onRetry, onToggle, keepLabel, skipLabel }: Props) {
  const { colors } = useTheme();
  const [active, setActive] = useState<{ from: number; to: number } | null>(null);
  const dy = useRef(new Animated.Value(0)).current;
  const live = useRef({ photos, onChange, onDragging });
  live.current = { photos, onChange, onDragging };

  const responder = (index: number) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      // Claim the drag before the page's scroll view does, so a small finger move never turns into a scroll.
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        dy.setValue(0);
        setActive({ from: index, to: index });
        live.current.onDragging?.(true);
      },
      onPanResponderMove: (_e, g) => {
        dy.setValue(g.dy);
        const to = dropIndex(index, g.dy, ROW, live.current.photos.length);
        setActive((a) => (a && a.to !== to ? { from: index, to } : a));
      },
      onPanResponderRelease: (_e, g) => finish(index, g.dy),
      onPanResponderTerminate: (_e, g) => finish(index, g.dy),
    });

  const finish = (index: number, moved: number) => {
    const to = dropIndex(index, moved, ROW, live.current.photos.length);
    dy.setValue(0);
    setActive(null);
    live.current.onDragging?.(false);
    if (to !== index) live.current.onChange(moveItem(live.current.photos, index, to));
  };

  // A row between the old and the new place of the dragged photo slides one step to make room.
  const shift = (i: number): number => {
    if (!active || i === active.from) return 0;
    if (active.from < active.to && i > active.from && i <= active.to) return -ROW;
    if (active.from > active.to && i < active.from && i >= active.to) return ROW;
    return 0;
  };

  return (
    <View>
      {photos.map((p, i) => {
        const dragged = active?.from === i;
        return (
          <Animated.View
            key={p.uri}
            testID={`photo-row-${i}`}
            style={[
              styles.row,
              { backgroundColor: colors.card, borderColor: dragged ? colors.primary : colors.border, zIndex: dragged ? 10 : 0, elevation: dragged ? 6 : 0 },
              dragged ? { transform: [{ translateY: dy }] } : { transform: [{ translateY: shift(i) }] },
              p.notKept ? { opacity: 0.55 } : null,
            ]}
          >
            <View {...responder(i).panHandlers} testID={`photo-handle-${i}`} style={styles.handle} accessibilityRole="adjustable" accessibilityLabel={`${i + 1}`}>
              <Text style={[styles.grip, { color: colors.muted }]}>⋮⋮</Text>
            </View>
            <SmartImage uri={p.uri} style={styles.thumb} />
            <Text style={[styles.pos, { color: colors.text }]}>{i === 0 ? '★ 1' : String(i + 1)}</Text>
            {p.failed ? (
              <Pressable testID={`photo-retry-${i}`} accessibilityRole="button" onPress={() => onRetry?.(p.uri)} style={styles.remove}><Text style={{ color: colors.danger, fontWeight: '700' }}>↻</Text></Pressable>
            ) : p.key ? (
              <Text testID={`photo-done-${i}`} style={{ color: colors.accent, fontWeight: '700' }}>✓</Text>
            ) : p.pct !== undefined ? (
              <Text testID={`photo-pct-${i}`} style={{ color: colors.muted, fontWeight: '700' }}>{p.pct}%</Text>
            ) : null}
            {onToggle && p.type !== 'existing' ? (
              <Pressable testID={`photo-keep-${i}`} accessibilityRole="button" onPress={() => onToggle(p.uri)} style={styles.remove}>
                <Text style={{ color: p.notKept ? colors.muted : colors.accent, fontWeight: '700' }}>{p.notKept ? skipLabel : keepLabel}</Text>
              </Pressable>
            ) : null}
            <Pressable testID={`photo-remove-${i}`} accessibilityRole="button" onPress={() => onChange(photos.filter((_x, j) => j !== i))} style={styles.remove}>
              <Text style={{ color: colors.danger, fontWeight: '700' }}>{removeLabel}</Text>
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: ROW - 8, marginVertical: 4, borderWidth: 1, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', paddingEnd: spacing.md, gap: spacing.md },
  handle: { width: 52, height: '100%', alignItems: 'center', justifyContent: 'center' },
  grip: { fontSize: 24, fontWeight: '800' },
  thumb: { width: 56, height: 56, borderRadius: radius.sm },
  pos: { flex: 1, fontSize: 16, fontWeight: '700' },
  remove: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
});
