import React from 'react';
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
} satisfies Record<string, Part[]>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, color, size = 24 }: { name: IconName; color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" testID={`icon-${name}`}>
      {(ICONS[name] as Part[]).map((p, i) =>
        'd' in p ? <Path key={i} d={p.d} /> : 'c' in p ? <Circle key={i} cx={p.c[0]} cy={p.c[1]} r={p.c[2]} /> : <Rect key={i} x={p.r[0]} y={p.r[1]} width={p.r[2]} height={p.r[3]} rx={p.r[4]} />,
      )}
    </Svg>
  );
}
