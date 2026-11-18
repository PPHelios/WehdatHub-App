/**
 * Runs an async step up to `tries` times, waiting `delayMs` (doubling) between tries; the last error is thrown. Used for the photo
 * uploads of an import, where one dropped connection must not fail a whole post (QA 2026-11-17: a single failed photo out of 15
 * left the post "photos failed, try again").
 */
export async function withRetries<T>(step: () => Promise<T>, { tries = 3, delayMs = 1500, wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)) } = {}): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i += 1) {
    try {
      return await step();
    } catch (e) {
      last = e;
      if (i < tries - 1) await wait(delayMs * 2 ** i);
    }
  }
  throw last;
}
