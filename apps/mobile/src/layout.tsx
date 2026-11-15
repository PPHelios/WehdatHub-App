import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

export const MAX_WIDTH = 640;
export const SPLIT_WIDTH = 900;

/** Big tablets and landscape iPads show the list and the opened item side by side. */
export const useWide = () => useWindowDimensions().width >= SPLIT_WIDTH;

/** How many cards fit side by side: 1 on phones, 2 on small tablets, 3 on big ones. */
export const columnsFor = (width: number) => (width >= 1000 ? 3 : width >= 700 ? 2 : 1);
export function useColumns(): number {
  return columnsFor(useWindowDimensions().width);
}

/** Keeps a form or detail screen a readable width, centred, on tablets and iPads. Phones are unchanged. */
export function narrow<P extends object>(Screen: React.ComponentType<P>): React.ComponentType<P> {
  function Narrow(props: P) {
    return (
      <View style={styles.outer}>
        <View style={styles.inner}><Screen {...props} /></View>
      </View>
    );
  }
  Narrow.displayName = `Narrow(${Screen.displayName || Screen.name || 'Screen'})`;
  return Narrow;
}

/** List on the start side, detail beside it. */
export function Split({ list, detail }: { list: React.ReactNode; detail: React.ReactNode }) {
  return (
    <View style={styles.split}>
      <View style={styles.listPane}>{list}</View>
      <View style={styles.detailPane}>{detail}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  split: { flex: 1, flexDirection: 'row' },
  listPane: { flex: 2, maxWidth: 440 },
  detailPane: { flex: 3 },
  outer: { flex: 1, alignItems: 'center' },
  inner: { flex: 1, width: '100%', maxWidth: MAX_WIDTH },
});
