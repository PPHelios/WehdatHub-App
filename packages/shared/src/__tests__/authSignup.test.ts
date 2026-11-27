import { describe, expect, it, vi } from 'vitest';
import { createApiClient } from '../api';
import { signupSchema } from '../validation';

describe('signupSchema and auth signup API', () => {
  it('validates solo and team signup inputs', () => {
    expect(signupSchema.safeParse({ name: 'Kareem', phone: '01012345678', tier: 'solo', channel: 'telegram' }).success).toBe(true);
    expect(signupSchema.safeParse({ name: '', phone: '01012345678', tier: 'solo', channel: 'telegram' }).success).toBe(false);
    expect(signupSchema.safeParse({ name: 'Kareem', phone: '123', tier: 'solo', channel: 'whatsapp' }).success).toBe(false);
  });

  it('calls GET /auth/trial-options and POST /auth/signup', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        enabled: true,
        waAvailable: true,
        tiers: {
          solo: { enabled: true, days: 14, credits: 80, seats: 1, units: 50 },
          team: { enabled: true, days: 14, credits: 200, seats: 5, units: 50 }
        }
      }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        channel: 'telegram',
        verifyUrl: 'https://t.me/Wehdat_Hub_bot?start=su_abc',
        phone: '+201012345678',
        codeMinutes: 10
      }), { status: 200, headers: { 'content-type': 'application/json' } }));

    const api = createApiClient({ baseUrl: 'https://example.test', fetchImpl: fetchMock as unknown as typeof fetch, getToken: () => null });
    const opts = await api.trialOptions();
    expect(opts.enabled).toBe(true);
    expect(opts.tiers.solo.credits).toBe(80);

    const res = await api.signup({ name: 'Kareem', phone: '01012345678', tier: 'solo', channel: 'telegram', lang: 'ar' });
    expect(res.ok).toBe(true);
    expect(res.verifyUrl).toContain('t.me');
  });
});
