const CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** One random key per form open (24 letters and digits). Sent with every try of that save, so a retry never makes a second unit. */
export function newSaveKey(): string {
  let k = '';
  for (let i = 0; i < 24; i++) k += CHARS[Math.floor(Math.random() * CHARS.length)];
  return k;
}

export class SaveNotConfirmed extends Error {}

/**
 * Waits for the save. With no answer after `ms` (60 s), asks the server whether this key was saved:
 * saved gives its code, not saved throws SaveNotConfirmed (the form and photos stay, Retry reuses the key).
 */
export async function withSaveCheck<T>(run: Promise<T>, check: () => Promise<{ saved: boolean; code?: string }>, ms = 60000): Promise<T | { code: string; checked: true }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<'late'>((resolve) => { timer = setTimeout(() => resolve('late'), ms); });
  try {
    const first = await Promise.race([run, late]);
    if (first !== 'late') return first as T;
  } finally {
    if (timer) clearTimeout(timer);
  }
  run.catch(() => undefined);
  const s = await check().catch(() => ({ saved: false }) as { saved: boolean; code?: string });
  if (s.saved && s.code) return { code: s.code, checked: true };
  throw new SaveNotConfirmed();
}
