import type { AssistantMode } from '@wehdathub/shared';

type Navigate = { navigate: (...args: never[]) => void };

/** The old Ask screen is gone: a link to it opens the Search tab in Primary mode (`at` makes a repeat link count as new). */
export const openPrimarySearch = (nav: Navigate) =>
  (nav.navigate as (...a: unknown[]) => void)('Tabs', { screen: 'Search', params: { mode: 'primary' satisfies AssistantMode, at: Date.now() } });

/** Opens the assistant (the Search tab) as it is. */
export const openAssistant = (nav: Navigate) => (nav.navigate as (...a: unknown[]) => void)('Tabs', { screen: 'Search' });
