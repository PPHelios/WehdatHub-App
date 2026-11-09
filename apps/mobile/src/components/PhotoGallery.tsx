import React, { useState } from 'react';
import { FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { MAX_WIDTH } from '../layout';
import { spacing } from '../theme';

interface Photo { id: string; url: string }

/** One photo you can swipe; the count shows below, and a tap opens it full screen. */
export function PhotoGallery({ photos, closeLabel }: { photos: Photo[]; closeLabel: string }) {
  const width = Math.min(useWindowDimensions().width, MAX_WIDTH);
  const h = Math.round(width * 0.72);
  const [index, setIndex] = useState(0);
  const [full, setFull] = useState<number | null>(null);
  if (!photos.length) return null;
  return (
    <View>
      <FlatList
        testID="gallery"
        horizontal
        pagingEnabled
        data={photos}
        keyExtractor={(p) => p.id}
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item, index: i }) => (
          <Pressable accessibilityRole="imagebutton" testID={`photo-${i}`} onPress={() => setFull(i)}>
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
  return (
    <View style={styles.full}>
      <FlatList
        horizontal
        pagingEnabled
        data={photos}
        initialScrollIndex={start}
        keyExtractor={(p) => p.id}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={(e) => setAt(Math.round(e.nativeEvent.contentOffset.x / width))}
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
