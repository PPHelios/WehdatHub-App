import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, LayoutChangeEvent, Platform, StyleProp, View, ViewStyle } from 'react-native';

/**
 * Android (edge-to-edge) does not always shrink the window when the keyboard opens, so fields near the bottom end up
 * hidden on a small phone. This returns how far to lift the content: the keyboard's height minus whatever the system
 * already shrank the view by, so a phone that does resize is not lifted twice. iOS is left to its own handling.
 */
export function useKeyboardLift() {
  const [kb, setKb] = useState(0);
  const [shrunk, setShrunk] = useState(0);
  const full = useRef(0);
  const open = useRef(false);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => { open.current = true; setKb(e.endCoordinates?.height ?? 0); });
    const hide = Keyboard.addListener('keyboardDidHide', () => { open.current = false; setKb(0); setShrunk(0); });
    return () => { show.remove(); hide.remove(); };
  }, []);
  const onLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (!open.current || h > full.current) full.current = h;
    setShrunk(open.current ? full.current - h : 0);
  };
  return { lift: Math.max(0, kb - shrunk), onLayout };
}

/** Wraps a screen (or a modal's backdrop) so the keyboard never covers its fields. */
export function KeyboardLift({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { lift, onLayout } = useKeyboardLift();
  return <View onLayout={onLayout} style={[{ flex: 1 }, style, { paddingBottom: lift }]}>{children}</View>;
}


/** Tracks whether an app keyboard occupies the space below a screen. */
export function useKeyboardVisible() {
  const [visible, setVisible] = useState(() => Keyboard.isVisible());
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return visible;
}
