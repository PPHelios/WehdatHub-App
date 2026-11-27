import React, { useRef, useState } from 'react';
import { FlatList, I18nManager, Image, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { NativeScrollEvent } from 'react-native';
import { AppText as Text } from './AppText';
import { MAX_WIDTH } from '../layout';
import { spacing, useTheme } from '../theme';

interface Photo { id: string; url: string }

function PhotoPager({ photos, index, onChange, renderPhoto, testID, maxWidth }: {
  photos: Photo[];
  index: number;
  onChange: (index: number) => void;
  renderPhoto: (photo: Photo, width: number, index: number, duplicate: boolean) => React.ReactElement;
  testID: string;
  maxWidth?: number;
}) {
  const dims = useWindowDimensions();
  const initialWidth = maxWidth ? Math.min(dims.width || 390, maxWidth) : (dims.width || 390);
  const [width, setWidth] = useState(initialWidth);
  const listRef = useRef<FlatList<Photo>>(null);
  const count = photos.length;
  const loop = count > 1;
  const data = loop ? [photos[count - 1], ...photos, photos[0]] : photos;

  function onEnd({ contentOffset, contentSize, layoutMeasurement }: NativeScrollEvent) {
    if (!loop) return;
    const offset = I18nManager.isRTL
      ? contentSize.width - layoutMeasurement.width - contentOffset.x
      : contentOffset.x;
    const page = Math.max(0, Math.min(count + 1, Math.round(offset / width)));
    const next = page === 0 ? count - 1 : page === count + 1 ? 0 : page - 1;
    // Both pages show the same photo, so the repositioning needs no animation.
    if (page === 0 || page === count + 1) {
      listRef.current?.scrollToIndex({ index: next + 1, animated: false });
    }
    onChange(next);
  }

  return (
    <View testID={`${testID}-layout`} style={[styles.pager, { maxWidth }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && count > 0 ? (
        <FlatList
          key={`${width}-${count}`}
          ref={listRef}
          testID={testID}
          horizontal
          pagingEnabled
          snapToInterval={width}
          disableIntervalMomentum
          scrollEnabled={loop}
          data={data}
          initialScrollIndex={loop ? Math.min(index, count - 1) + 1 : 0}
          keyExtractor={(photo, page) => `${photo.id}-${page}`}
          removeClippedSubviews={false}
          showsHorizontalScrollIndicator={false}
          getItemLayout={(_, page) => ({ length: width, offset: width * page, index: page })}
          onMomentumScrollEnd={(e) => onEnd(e.nativeEvent)}
          renderItem={({ item, index: page }) => {
            const duplicate = loop && (page === 0 || page === count + 1);
            const photoIndex = loop ? (page + count - 1) % count : page;
            return renderPhoto(item, width, photoIndex, duplicate);
          }}
        />
      ) : null}
    </View>
  );
}

export function PhotoGallery({ photos, closeLabel, hero = false }: { photos: Photo[]; closeLabel: string; hero?: boolean }) {
  const [index, setIndex] = useState(0);
  const [full, setFull] = useState<number | null>(null);
  const { colors } = useTheme();
  if (!photos.length) return null;
  return (
    <View>
      <PhotoPager
        photos={photos}
        index={index}
        onChange={setIndex}
        maxWidth={MAX_WIDTH}
        testID="gallery"
        renderPhoto={(photo, width, photoIndex, duplicate) => (
          <Pressable accessibilityRole="imagebutton" testID={duplicate ? undefined : `photo-${photoIndex}`} onPress={() => setFull(photoIndex)}>
            <Image source={{ uri: photo.url }} style={{ width, height: Math.round(width * (hero ? 0.76 : 0.72)) }} resizeMode="cover" resizeMethod="resize" fadeDuration={0} />
          </Pressable>
        )}
      />
      <Text variant="bodySm" weight="bold" style={[styles.count, { color: colors.onMedia }, hero && styles.heroCount]}>{index + 1} / {photos.length}</Text>
      {photos.length > 1 ? (
        <View style={[styles.dots, hero && styles.heroDots]}>
          {photos.slice(0, 12).map((p, i) => <View key={p.id} style={[styles.dot, i === Math.min(index, 11) && [styles.dotOn, { backgroundColor: colors.onMedia }]]} />)}
        </View>
      ) : null}
      <Modal visible={full !== null} animationType="fade" onRequestClose={() => setFull(null)} statusBarTranslucent>
        {full !== null ? <FullScreen photos={photos} start={full} onClose={() => setFull(null)} closeLabel={closeLabel} /> : null}
      </Modal>
    </View>
  );
}

function FullScreen({ photos, start, onClose, closeLabel }: { photos: Photo[]; start: number; onClose: () => void; closeLabel: string }) {
  const { height } = useWindowDimensions();
  const [at, setAt] = useState(start);
  const { colors } = useTheme();
  return (
    <View style={[styles.full, { backgroundColor: colors.mediaBlack }]}>
      <PhotoPager
        photos={photos}
        index={at}
        onChange={setAt}
        testID="gallery-full"
        renderPhoto={(photo, width) => <ZoomPhoto url={photo.url} width={width} height={height} />}
      />
      <Text variant="body" weight="bold" style={[styles.fullCount, { color: colors.onMedia }]}>{at + 1} / {photos.length}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={closeLabel} testID="photo-close" onPress={onClose} style={styles.close}>
        <Text variant="heading" style={{ color: colors.onMedia }}>✕</Text>
      </Pressable>
    </View>
  );
}

/** Pinch to zoom on iPhone/iPad; a double tap zooms in and out on both systems. */
function ZoomPhoto({ url, width, height }: { url: string; width: number; height: number }) {
  const [zoomed, setZoomed] = useState(false);
  const [pinched, setPinched] = useState(false);
  const last = useRef(0);
  const onTap = () => {
    const now = Date.now();
    if (now - last.current < 300) setZoomed((z) => !z);
    last.current = now;
  };
  const w = zoomed ? width * 2 : width;
  const h = zoomed ? height * 2 : height;
  return (
    <ScrollView
      style={{ width, height }}
      scrollEnabled={zoomed || pinched}
      maximumZoomScale={4}
      minimumZoomScale={1}
      onScroll={(e) => setPinched((e.nativeEvent.zoomScale ?? 1) > 1)}
      scrollEventThrottle={16}
      centerContent
      bouncesZoom
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
    >
      <ScrollView horizontal scrollEnabled={zoomed} nestedScrollEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={{ width: w, height: h }}>
        <Pressable onPress={onTap}><Image source={{ uri: url }} style={{ width: w, height: h }} resizeMode="contain" fadeDuration={0} /></Pressable>
      </ScrollView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pager: { width: '100%' },
  count: { position: 'absolute', top: spacing.md, end: spacing.md, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  heroCount: { top: undefined, bottom: 34 },
  heroDots: { bottom: 34 },
  dots: { position: 'absolute', bottom: spacing.sm, start: 0, end: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.55)' },
  dotOn: { width: 9, height: 9, borderRadius: 5 },
  full: { flex: 1 },
  fullCount: { position: 'absolute', bottom: spacing.xl, alignSelf: 'center' },
  close: { position: 'absolute', top: spacing.xl + 8, end: spacing.lg, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },});
