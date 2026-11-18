import { describe, expect, it, vi } from 'vitest';
import { ApiClientError, PlanLockedError, TRIAL_PLAN, UNIT_WARN_PCT, createApiClient, isPlanLapsed, isPlanLocked, isPlanPayError, perMonthPrice, planPeriods } from './api';
import { codeSchema, phoneSchema } from './validation';

const reply = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

describe('api client', () => {
  it('sends the bearer token and builds the query', async () => {
    const f = vi.fn().mockResolvedValue(reply(200, { total: 0, limit: 20, offset: 0, items: [] }));
    const api = createApiClient({ baseUrl: 'https://x.test', getToken: () => 'tok', fetchImpl: f as unknown as typeof fetch });
    await api.units({ q: 'MV', mine: true, offset: 20, compound: undefined });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://x.test/api/v1/units?q=MV&mine=1&offset=20');
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer tok' });
  });

  it('turns an error reply into ApiClientError and signals a lost session', async () => {
    const onUnauthorized = vi.fn();
    const f = vi.fn().mockResolvedValue(reply(401, { error: 'unauthorized' }));
    const api = createApiClient({ baseUrl: 'https://x.test', getToken: () => 'tok', onUnauthorized, fetchImpl: f as unknown as typeof fetch });
    await expect(api.me()).rejects.toMatchObject({ status: 401, code: 'unauthorized' });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('does not signal a lost session for a wrong code (no token sent)', async () => {
    const onUnauthorized = vi.fn();
    const f = vi.fn().mockResolvedValue(reply(401, { error: 'invalid_code' }));
    const api = createApiClient({ baseUrl: 'https://x.test', getToken: () => null, onUnauthorized, fetchImpl: f as unknown as typeof fetch });
    await expect(api.verifyCode('01012345678', '123456')).rejects.toMatchObject({ code: 'invalid_code' });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('reads Retry-After and reports an unreachable server as status 0', async () => {
    const f = vi.fn().mockResolvedValueOnce(reply(429, { error: 'too_many' }, { 'retry-after': '30' })).mockRejectedValueOnce(new Error('offline'));
    const api = createApiClient({ baseUrl: 'https://x.test', getToken: () => null, fetchImpl: f as unknown as typeof fetch });
    await expect(api.requestCode('01012345678')).rejects.toMatchObject({ status: 429, retryAfterSec: 30 });
    const err = await api.requestCode('01012345678').catch((e) => e);
    expect(err).toBeInstanceOf(ApiClientError);
    expect(err.status).toBe(0);
  });
});

describe('input rules', () => {
  it('accepts typed phones and six-digit codes only', () => {
    expect(phoneSchema.safeParse('+20 101 234 5678').data).toBe('201012345678');
    expect(phoneSchema.safeParse('12').success).toBe(false);
    expect(phoneSchema.safeParse('0101234567').success).toBe(false);
    expect(phoneSchema.safeParse('01312345678').success).toBe(false);
    expect(phoneSchema.safeParse('01012345678').data).toBe('01012345678');
    expect(codeSchema.safeParse('123 456').data).toBe('123456');
    expect(codeSchema.safeParse('12345').success).toBe(false);
  });
});

describe('place suggestions', () => {
  it('asks for one list of compounds, areas and sub-zones', async () => {
    const f = vi.fn().mockResolvedValue(reply(200, { items: [{ kind: 'subzone', id: 's1', name_en: 'Golden Square', name_ar: null, path: 'New Cairo', via: 'name', area_id: 'a1', subzone_id: 's1' }] }));
    const api = createApiClient({ baseUrl: 'https://x.test', getToken: () => 'tok', fetchImpl: f as unknown as typeof fetch });
    const r = await api.placeSuggest('golden');
    expect(f.mock.calls[0][0]).toBe('https://x.test/api/v1/places/suggest?q=golden');
    expect(r.items[0]).toMatchObject({ kind: 'subzone', area_id: 'a1' });
  });
});

describe('plan guard errors', () => {
  const mk = (status: number, body: unknown, onPlanLocked?: (e: PlanLockedError) => void) =>
    createApiClient({ baseUrl: 'https://x.test', getToken: () => 'tok', onPlanLocked, fetchImpl: vi.fn().mockResolvedValue(reply(status, body)) as unknown as typeof fetch });

  it('turns 402 plan_readonly and plan_blocked into a typed PlanLockedError and tells the app', async () => {
    const seen = vi.fn();
    const err = await mk(402, { error: 'plan_readonly', message: 'read only' }, seen).saveNotificationSettings({} as never).catch((e) => e);
    expect(err).toBeInstanceOf(PlanLockedError);
    expect(err).toBeInstanceOf(ApiClientError);
    expect(err).toMatchObject({ status: 402, code: 'plan_readonly', phase: 'readonly', serverMessage: 'read only' });
    expect(seen).toHaveBeenCalledWith(err);
    const blocked = await mk(402, { error: 'plan_blocked' }).me().catch((e) => e);
    expect(isPlanLocked(blocked)).toBe(true);
    expect(blocked.phase).toBe('blocked');
  });

  it('leaves any other 402 as a plain ApiClientError and does not call the plan handler', async () => {
    const seen = vi.fn();
    const err = await mk(402, { error: 'credits' }, seen).me().catch((e) => e);
    expect(err).toBeInstanceOf(ApiClientError);
    expect(isPlanLocked(err)).toBe(false);
    expect(seen).not.toHaveBeenCalled();
  });

  it('keeps the 422 plan error codes on the error and knows them', async () => {
    const err = await mk(422, { error: 'downgrade' }).planPay({ kind: 'plan', plan: 'solo', months: 1 }).catch((e) => e);
    expect(err).toMatchObject({ status: 422, code: 'downgrade' });
    expect(isPlanPayError(err.code)).toBe(true);
    for (const c of ['same_plan', 'period_switch', 'upgrade_required', 'upgrade_pending', 'lapsed', 'not_paid']) expect(isPlanPayError(c)).toBe(true);
    expect(isPlanPayError('invalid_code')).toBe(false);
  });

  it('prices per period and the per-month equivalent', () => {
    const solo = { prices: { 1: 199, 6: 1075, 12: 1990 } };
    expect(planPeriods(solo)).toEqual([1, 6, 12]);
    expect(planPeriods({ prices: { 12: 29900, 6: 16146 } })).toEqual([6, 12]); // Agency: no monthly
    expect(planPeriods({ prices: {} })).toEqual([]);
    expect(perMonthPrice(1075, 6)).toBe(179);
    expect(perMonthPrice(1990, 12)).toBe(166);
  });

  it('knows the lapsed steps and the trial terms', () => {
    expect(['grace', 'readonly', 'blocked'].every(isPlanLapsed)).toBe(true);
    expect(['paid', 'trial', 'free', 'pilot', undefined].some(isPlanLapsed)).toBe(false);
    expect(TRIAL_PLAN).toEqual({ days: 14, seats: 1, units: 50, credits: 80 });
    expect(UNIT_WARN_PCT).toBe(85);
  });
});
