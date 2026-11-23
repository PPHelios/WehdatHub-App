import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

type Part = { d: string } | { c: [number, number, number] } | { r: [number, number, number, number, number] };

/** The app's line icons: 24 by 24, drawn with a 2px round stroke so they take any colour. */
const ICONS = {
  today: [{ r: [3, 4, 18, 18, 2] }, { d: 'M16 2v4M8 2v4M3 10h18' }, { d: 'M9 16l2 2 4-4' }],
  search: [{ c: [11, 11, 7] }, { d: 'M21 21l-4.3-4.3' }],
  leads: [{ c: [12, 8, 4] }, { d: 'M4 21a8 8 0 0 1 16 0' }],
  team: [{ d: 'M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2' }, { c: [10, 7, 4] }, { d: 'M21 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' }],
  map: [{ d: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z' }, { c: [12, 10, 3] }],
  units: [{ d: 'M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18z' }, { d: 'M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2M10 6h4M10 10h4M10 14h4M10 18h4' }],
  more: [{ d: 'M4 6h16M4 12h16M4 18h16' }],
  add: [{ d: 'M12 5v14M5 12h14' }],
  owners: [{ c: [12, 8, 4] }, { d: 'M4 21a8 8 0 0 1 16 0' }, { d: 'M18 3l2 2-2 2' }],
  dashboard: [{ d: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z' }],
  plan: [{ r: [2, 5, 20, 14, 2] }, { d: 'M2 10h20' }],
  mic: [{ r: [9, 2, 6, 11, 3] }, { d: 'M19 10v2a7 7 0 0 1-14 0v-2M12 19v3' }],
  trash: [{ d: 'M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6' }],
  bell: [{ d: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9' }, { d: 'M13.7 21a2 2 0 0 1-3.4 0' }],
  edit: [{ d: 'M12 20h9' }, { d: 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z' }],
  download: [{ d: 'M12 3v12M7 10l5 5 5-5M5 21h14' }],
  // The same drawings as the website (web/icons.js), so a menu item looks the same on both.
  home: [{ d: 'M3 11 12 4l9 7v9H3z' }],
  plus: [{ d: 'M12 5v14M5 12h14' }],
  back: [{ d: 'm9 18 6-6-6-6' }],
  help: [{ c: [12, 12, 9] }, { d: 'M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17h.01' }],
  stop: [{ r: [6, 6, 12, 12, 2] }],
  deal: [{ d: 'm11 17 2 2a1 1 0 0 0 3-3' }, { d: 'm14 14 2.5 2.5a1 1 0 0 0 3-3l-3.9-3.9a2 2 0 0 0-2.8 0L12 10.4a1 1 0 0 1-3-3L11.8 4.6a2 2 0 0 1 2.8 0L21 11' }, { d: 'M3 11 7 7l4 4M3 16l3 3' }],
  money: [{ r: [2, 6, 20, 12, 2] }, { c: [12, 12, 2.5] }, { d: 'M6 12h.01M18 12h.01' }],
  catalogue: [{ d: 'M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4M9 10h1M14 10h1M9 14h1M14 14h1' }],
  chat: [{ d: 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z' }],
  star: [{ d: 'm12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z' }],
  import: [{ d: 'M12 3v12M7 10l5 5 5-5M4 21h16' }],
  chart: [{ d: 'M4 20V10M10 20V4M16 20v-7M22 20H2' }],
  gauge: [{ d: 'M12 14l4-4' }, { d: 'M3.5 18a9 9 0 1 1 17 0z' }],
  card: [{ r: [2, 5, 20, 14, 2] }, { d: 'M2 10h20' }],
  settings: [{ c: [12, 12, 3] }, { d: 'M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z' }],
  book: [{ d: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z' }, { d: 'M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5' }],
  sun: [{ c: [12, 12, 4] }, { d: 'M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4' }],
  globe: [{ c: [12, 12, 9] }, { d: 'M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18' }],
  bug: [{ r: [8, 6, 8, 14, 4] }, { d: 'M12 6V3M4 13h4M16 13h4M5 7l3 2M19 7l-3 2M5 19l3-2M19 19l-3-2' }],
  support: [{ d: 'M3 13v-1a9 9 0 0 1 18 0v1' }, { r: [2, 13, 5, 7, 2] }, { r: [17, 13, 5, 7, 2] }],
  logout: [{ d: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9' }],
  tools: [{ d: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z' }],
  gift: [{ r: [3, 8, 18, 4, 1] }, { d: 'M12 8v13M5 12v9h14v-9M12 8S10.5 3 8 3a2.5 2.5 0 0 0 0 5M12 8s1.5-5 4-5a2.5 2.5 0 0 1 0 5' }],
  pin: [{ d: 'M12 21s-7-6.1-7-11a7 7 0 1 1 14 0c0 4.9-7 11-7 11z' }, { c: [12, 10, 2.5] }],
  lock: [{ r: [5, 11, 14, 10, 2] }, { d: 'M8 11V7a4 4 0 0 1 8 0v4' }],
  board: [{ r: [3, 4, 5, 16, 1] }, { r: [10, 4, 5, 10, 1] }, { r: [17, 4, 4, 13, 1] }],
  link: [{ d: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1' }, { d: 'M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1' }],
  funnel: [{ d: 'M3 4h18l-7 8v6l-4 2v-8z' }],
  trend: [{ d: 'm3 17 6-6 4 4 8-8' }, { d: 'M15 7h6v6' }],
  tag: [{ d: 'M3 12V4h8l10 10-8 8z' }, { c: [7.5, 8.5, 1] }],
  folder: [{ d: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' }],
  pulse: [{ d: 'M3 12h4l3-8 4 16 3-8h4' }],
  'search-check': [{ c: [11, 11, 7] }, { d: 'm20 20-4-4M8 11l2 2 4-4' }],
  clipboard: [{ r: [5, 4, 14, 17, 2] }, { d: 'M9 4h6v3H9zM9 12h6M9 16h4' }],
  'user-plus': [{ c: [9, 8, 4] }, { d: 'M2 21c0-4 3-6 7-6s7 2 7 6M19 8v6M16 11h6' }],
  'key-people': [{ c: [8, 8, 3.5] }, { d: 'M2 20c0-3.5 2.7-5.5 6-5.5 1.6 0 3 .4 4 1.2' }, { c: [17, 14, 2.5] }, { d: 'm19 16 3 4M21 18.5l1.5-1.5' }],
  calendar: [{ r: [3, 5, 18, 16, 2] }, { d: 'M3 10h18M8 3v4M16 3v4' }],
  key: [{ c: [8, 15, 4] }, { d: 'm11 12 9-9M16 7l3 3' }],
  inbox: [{ d: 'M3 13l3-8h12l3 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z' }, { d: 'M3 13h5l1 3h6l1-3h5' }],
  building: [{ r: [5, 3, 14, 18, 1] }, { d: 'M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M3 21h18' }],
  compare: [{ d: 'M7 4v16M17 4v16M3 8l4-4 4 4M13 16l4 4 4-4' }],
  check: [{ d: 'm5 12 5 5 9-10' }],
  send: [{ d: 'M22 2 11 13M22 2l-7 20-4-9-9-4z' }],
} satisfies Record<string, Part[]>;

export type IconName = keyof typeof ICONS;
/** Every icon the app can draw (the menu checks the server's names against this). */
export const ICON_NAMES = Object.keys(ICONS) as IconName[];

/** `fill` shades the inside of the shapes (the active tab); without it the icon is a plain line drawing. */
export function Icon({ name, color, size = 24, fill }: { name: IconName; color: string; size?: number; fill?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill ?? 'none'} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" testID={`icon-${name}`}>
      {(ICONS[name] as Part[]).map((p, i) =>
        'd' in p ? <Path key={i} d={p.d} /> : 'c' in p ? <Circle key={i} cx={p.c[0]} cy={p.c[1]} r={p.c[2]} /> : <Rect key={i} x={p.r[0]} y={p.r[1]} width={p.r[2]} height={p.r[3]} rx={p.r[4]} />,
      )}
    </Svg>
  );
}

/** Disclosure arrows use vertical motion; navigation arrows follow the current app language. */
export function Chevron({ color, rtl, expanded }: { color: string; rtl: boolean; expanded?: boolean }) {
  const rotation = expanded === undefined ? (rtl ? '180deg' : '0deg') : expanded ? '-90deg' : '90deg';
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ transform: [{ rotate: rotation }] }}>
      <Icon name="back" size={18} color={color} />
    </View>
  );
}
