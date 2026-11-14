import React, { useState } from 'react';
import { FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { MAX_WIDTH } from '../layout';
import { spacing } from '../theme';

interface Photo { id: string; url: string }

/** Loops: [last, ...photos, first]; landing on a copy jumps (no animation) to the real photo, so swiping never dead-ends. */
function useLoop(photos: Photo[], width: number, start: number, onIndex: (i: number) => void) {
  const ref = React.useRef<FlatList<Photo>>(null);
  const n = photos.length;
  const loop = n > 1;
  const data = loop ? [photos[n - 1], ...photos, photos[0]] : photos;
  const onEnd = (e: { nativeEvent: { contentOffset: { x: number } } }) => {
    const raw = Math.round(e.nativeEvent.contentOffset.x / width);
    if (!loop) return onIndex(raw);
    if (raw === 0) ref.current?.scrollToIndex({ index: n, animated: false });
    else if (raw === n + 1) ref.current?.scrollToIndex({ index: 1, animated: false });
    onIndex(((raw - 1 + n) % n));
  };
  return { ref, data, onEnd, first: loop ? start + 1 : start, off: loop ? 1 : 0 };
}

/** One photo you can swipe; the count shows below, and a tap opens it full screen. */
export function PhotoGallery({ photos, closeLabel }: { photos: Photo[]; closeLabel: string }) {
  const width = Math.min(useWindowDimensions().width, MAX_WIDTH);
  const h = Math.round(width * 0.72);
  const [index, setIndex] = useState(0);
  const [full, setFull] = useState<number | null>(null);
  const lp = useLoop(photos, width, 0, setIndex);
  if (!photos.length) return null;
  return (
    <View>
      <FlatList
        ref={lp.ref}
        testID="gallery"
        horizontal
        pagingEnabled
        data={lp.data}
        initialScrollIndex={lp.first}
        keyExtractor={(p, i) => `${p.id}-${i}`}
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={lp.onEnd}
        renderItem={({ item, index: i }) => (
          <Pressable accessibilityRole="imagebutton" testID={`photo-${i - lp.off}`} onPress={() => setFull((i - lp.off + photos.length) % photos.length)}>
            <Image source={{ uri: item.url }} style={{ width, height: h }} resizeMode="cover" />
          </Pressable>
        )}
      />
      <Text style={styles.count}>{index + 1} / {photos.length}</Text>
      {photos.length > 1 ? (
        <View style={styles.dots}>
          {photos.slice(0, 12).map((p, i) => <View key={p.id} style={[styles.dot, i === Math.min(index, 11) && styles.dotOn]} />)}
        </View>
      ) : null}
      <Modal visible={full !== null} animationType="fade" onRequestClose={() => setFull(null)} statusBarTranslucent>
        {full !== null ? <FullScreen photos={photos} start={full} onClose={() => setFull(null)} closeLabel={closeLabel} /> : null}
      </Modal>
    </View>
  );
}

function FullScreen({ photos, start, onClose, closeLabel }: { photos: Photo[]; start: number; onClose: () => void; closeLabel: string }) {
  const { width, height } = useWindowDimensions();
  const [at, setAt] = useState(start);
  const lp = useLoop(photos, width, start, setAt);
  return (
    <View style={styles.full}>
      <FlatList
        ref={lp.ref}
        horizontal
        pagingEnabled
        data={lp.data}
        initialScrollIndex={lp.first}
        keyExtractor={(p, i) => `${p.id}-${i}`}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={lp.onEnd}
        renderItem={({ item }) => <ZoomPhoto url={item.url} width={width} height={height} />}
      />
      <Text style={styles.fullCount}>{at + 1} / {photos.length}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={closeLabel} testID="photo-close" onPress={onClose} style={styles.close}>
        <Text style={styles.closeX}>✕</Text>
      </Pressable>
    </View>
  );
}

/** Pinch to zoom on iPhone/iPad; a double tap zooms in and out on both systems. */
function ZoomPhoto({ url, width, height }: { url: string; width: number; height: number }) {
  const [zoomed, setZoomed] = useState(false);
  const last = React.useRef(0);
  const onTap = () => {
    const now = Date.now();
    if (now - last.current < 300) setZoomed((z) => !z);
    last.current = now;
  };
  const w = zoomed ? width * 2 : width;
  const h = zoomed ? height * 2 : height;
  return (
    <ScrollView style={{ width, height }} maximumZoomScale={4} minimumZoomScale={1} centerContent bouncesZoom showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={false}>
      <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={{ width: w, height: h }}>
        <Pressable onPress={onTap}><Image source={{ uri: url }} style={{ width: w, height: h }} resizeMode="contain" /></Pressable>
      </ScrollView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  count: { position: 'absolute', top: spacing.md, end: spacing.md, color: '#FFFFFF', backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 999, overflow: 'hidden', fontWeight: '700', fontSize: 13 },
  dots: { position: 'absolute', bottom: spacing.sm, start: 0, end: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.55)' },
  dotOn: { backgroundColor: '#FFFFFF', width: 9, height: 9, borderRadius: 5 },
  full: { flex: 1, backgroundColor: '#000000' },
  fullCount: { position: 'absolute', bottom: spacing.xl, alignSelf: 'center', color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  close: { position: 'absolute', top: spacing.xl + 8, end: spacing.lg, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  closeX: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
});
