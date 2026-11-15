/** A copy of `items` with the element at `from` moved to position `to` (used by drag-and-drop photo ordering). */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const out = items.slice();
  if (from < 0 || from >= out.length) return out;
  const target = Math.max(0, Math.min(out.length - 1, to));
  const [item] = out.splice(from, 1);
  out.splice(target, 0, item);
  return out;
}

/** The row a dragged item lands on, from how far it moved (dy) and each row's height. */
export function dropIndex(from: number, dy: number, rowHeight: number, count: number): number {
  return Math.max(0, Math.min(count - 1, from + Math.round(dy / rowHeight)));
}
