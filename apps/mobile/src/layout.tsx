import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

export const MAX_WIDTH = 640;

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

const styles = StyleSheet.create({
  outer: { flex: 1, alignItems: 'center' },
  inner: { flex: 1, width: '100%', maxWidth: MAX_WIDTH },
});
