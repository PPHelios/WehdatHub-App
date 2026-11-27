import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { AppText as Text } from './AppText';
import { dropIndex } from '@wehdathub/shared';
import type { UploadFile } from '@wehdathub/shared';
import { currentLang } from '../auth';
import { t } from '../i18n';
import { moveKept } from '../photos';
import { radius, spacing, typeScale, useTheme } from '../theme';
import { SmartImage } from './SmartImage';
import { sx } from '../sharedStyles';

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
  const lang = currentLang();
  const [active, setActive] = useState<{ from: number; to: number } | null>(null);
  // The dragged row follows the finger on the UI thread; the JS side only learns where it would land.
  const dy = useSharedValue(0);
  const from = useSharedValue(-1);
  const live = useRef({ photos, onChange, onDragging });
  live.current = { photos, onChange, onDragging };

  const begin = (index: number) => {
    setActive({ from: index, to: index });
    live.current.onDragging?.(true);
  };
  const move = (index: number, moved: number) => {
    const to = dropIndex(index, moved, ROW, live.current.photos.length);
    setActive((a) => (a && a.to !== to ? { from: index, to } : a));
  };
  const finish = (index: number, moved: number) => {
    const to = dropIndex(index, moved, ROW, live.current.photos.length);
    setActive(null);
    live.current.onDragging?.(false);
    if (to !== index) live.current.onChange(moveKept(live.current.photos, index, to));
  };

  // Screen readers move a photo one place at a time (the same move as a drag).
  const stepBy = (index: number, step: number) => {
    const to = index + step;
    if (!step || to < 0 || to >= live.current.photos.length) return;
    live.current.onChange(moveKept(live.current.photos, index, to));
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
          <DragRow
            key={p.uri}
            index={i}
            dy={dy}
            from={from}
            shift={shift(i)}
            testID={`photo-row-${i}`}
            style={[
              styles.row,
              { backgroundColor: colors.card, borderColor: dragged ? colors.primary : colors.border, zIndex: dragged ? 10 : 0, elevation: dragged ? 6 : 0 },
              p.notKept ? sx.opacity0_55 : null,
            ]}
            onBegin={() => begin(i)}
            onMove={(moved) => move(i, moved)}
            onEnd={(moved) => finish(i, moved)}
            handle={(g) => (
            <GestureDetector gesture={g}>
            <View testID={`photo-handle-${i}`} style={styles.handle} accessibilityRole="adjustable" accessibilityLabel={`${t(lang, 'movePhoto')} ${i + 1}`} accessibilityValue={{ text: `${i + 1} / ${photos.length}` }}
              accessibilityActions={[{ name: 'increment', label: t(lang, 'moveLater') }, { name: 'decrement', label: t(lang, 'moveEarlier') }]} onAccessibilityAction={(e) => stepBy(i, e.nativeEvent.actionName === 'increment' ? 1 : e.nativeEvent.actionName === 'decrement' ? -1 : 0)}>
              <Text style={[styles.grip, { color: colors.muted }]}>⋮⋮</Text>
            </View>
            </GestureDetector>
            )}
          >
            <SmartImage uri={p.uri} style={styles.thumb} />
            <Text style={[styles.pos, { color: colors.text }]}>{i === 0 ? '★ 1' : String(i + 1)}</Text>
            {p.failed ? (
              <Pressable testID={`photo-retry-${i}`} accessibilityRole="button" accessibilityLabel={t(lang, 'retryPhoto')} onPress={() => onRetry?.(p.uri)} style={styles.remove}><Text style={[{ color: colors.danger }, sx.fontWeight700]}>↻</Text></Pressable>
            ) : p.key ? (
              <Text testID={`photo-done-${i}`} accessibilityLabel={t(lang, 'photoUploaded')} style={[{ color: colors.accent }, sx.fontWeight700]}>✓</Text>
            ) : p.pct !== undefined ? (
              <Text testID={`photo-pct-${i}`} style={[{ color: colors.muted }, sx.fontWeight700]}>{p.pct}%</Text>
            ) : null}
            {onToggle && p.type !== 'existing' ? (
              <Pressable testID={`photo-keep-${i}`} accessibilityRole="button" onPress={() => onToggle(p.uri)} style={styles.remove}>
                <Text style={{ color: p.notKept ? colors.muted : colors.accent, fontWeight: '700' }}>{p.notKept ? skipLabel : keepLabel}</Text>
              </Pressable>
            ) : null}
            <Pressable testID={`photo-remove-${i}`} accessibilityRole="button" onPress={() => onChange(photos.filter((_x, j) => j !== i))} style={styles.remove}>
              <Text style={[{ color: colors.danger }, sx.fontWeight700]}>{removeLabel}</Text>
            </Pressable>
          </DragRow>
        );
      })}
    </View>
  );
}

interface DragRowProps {
  index: number;
  dy: SharedValue<number>;
  from: SharedValue<number>;
  shift: number;
  testID: string;
  style: React.ComponentProps<typeof Animated.View>['style'];
  onBegin: () => void;
  onMove: (dy: number) => void;
  onEnd: (dy: number) => void;
  handle: (g: ReturnType<typeof Gesture.Pan>) => React.ReactNode;
  children: React.ReactNode;
}

/** One row. Its drag gesture is built once per render but keyed to the row, so the grab survives the other rows sliding. */
function DragRow({ index, dy, from, shift, testID, style, onBegin, onMove, onEnd, handle, children }: DragRowProps) {
  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin(() => {
      dy.value = 0;
      from.value = index;
      scheduleOnRN(onBegin);
    })
    .onUpdate((e) => {
      dy.value = e.translationY;
      scheduleOnRN(onMove, e.translationY);
    })
    .onFinalize((e) => {
      dy.value = 0;
      from.value = -1;
      scheduleOnRN(onEnd, e.translationY);
    });
  const moveStyle = useAnimatedStyle(() => ({ transform: [{ translateY: from.value === index ? dy.value : shift }] }));
  return (
    <Animated.View testID={testID} style={[style, moveStyle]}>
      {handle(pan)}
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { height: ROW - 8, marginVertical: 4, borderWidth: 1, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', paddingEnd: spacing.md, gap: spacing.md },
  handle: { width: 52, height: '100%', alignItems: 'center', justifyContent: 'center' },
  grip: { fontSize: typeScale.title.fontSize, fontWeight: '800' },
  thumb: { width: 56, height: 56, borderRadius: radius.sm },
  pos: { flex: 1, fontSize: typeScale.body.fontSize, fontWeight: '700' },
  remove: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
});
