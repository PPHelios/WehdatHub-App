import { flushUsage, timed, usage } from '../src/usage';
import { useAuth } from '../src/auth';

describe('usage events', () => {
  const fetchMock = jest.fn(async () => ({ ok: true }));
  beforeEach(() => {
    fetchMock.mockClear();
    (globalThis as unknown as { fetch: unknown }).fetch = fetchMock;
    useAuth.setState({ token: 't' } as never);
  });

  test('timed records ok and failed runs and rethrows', async () => {
    await timed('ask', async () => 1);
    await expect(timed('search', async () => { throw new Error('x'); })).rejects.toThrow('x');
    await flushUsage();
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(body.events.map((e: { event: string; ok: boolean }) => [e.event, e.ok])).toEqual([['ask', true], ['search', false]]);
  });

  test('nothing is sent when signed out', async () => {
    useAuth.setState({ token: null } as never);
    usage('call_tap');
    await flushUsage();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('records search_corrected, route_override, and voice_edited events without raw query text', async () => {
    usage('search_corrected', true, undefined, { action: 'change_search', mode: 'resale' });
    usage('route_override', true, undefined, { action: 'view_all_markets', mode: 'resale', to_mode: 'auto' });
    usage('voice_edited', true, undefined, { edited: true, mode: 'auto' });
    await flushUsage();
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(body.events.map((e: { event: string; meta: Record<string, unknown> }) => [e.event, e.meta.action ?? e.meta.edited])).toEqual([
      ['search_corrected', 'change_search'],
      ['route_override', 'view_all_markets'],
      ['voice_edited', true],
    ]);
  });
});
