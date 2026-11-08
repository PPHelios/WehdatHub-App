// The app's JSON API (backend /api/v1): types and a small typed client, shared by the mobile app and the future website.

export type Lang = 'ar' | 'en';
export interface ApiBroker { id: string; name: string; role: string; lang: Lang }
export interface ApiAgency { id: string; name: string; slug: string; logoUrl: string | null }
export interface LoginResult { token: string; expiresAt: string; broker: ApiBroker; agency: ApiAgency }

export interface ApiUnit {
  id: string;
  code: string;
  status: 'active' | 'sold' | 'archived';
  title: string | null;
  propertyType: string | null;
  dealType: string | null;
  price: number | null;
  priceText: string | null;
  area: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  compound: string | null;
  district: string | null;
  city: string | null;
  finishing: string | null;
  furnishing: string | null;
  floor: string | null;
  isReady: boolean | null;
  delivery: { year: number; quarter: number | null } | null;
  downPayment: number | null;
  installmentYears: number | null;
  installmentValue: number | null;
  confirmedAt: string | null;
  updatedAt: string | null;
  mine: boolean;
}
export interface ApiUnitListItem extends ApiUnit { photo: string | null }
export interface ApiUnitDetail extends ApiUnit {
  features: string[];
  images: { id: string; url: string; position: number }[];
}
export type TodayTaskKind = 'late' | 'viewing' | 'hot' | 'call' | 'matches';
export interface TodayTask { ref: string; name: string | null; kind: TodayTaskKind; at: string | null; unitCode: string | null; phone: string | null; matches: number | null }
export interface TodayData { counts: { followUpsToday: number; viewings: number; newLeads: number }; tasks: TodayTask[]; moreTasks: number }
export interface SearchAsk { terms: string[]; numbers?: unknown[]; aiDown?: boolean; withoutTotal: number }
export interface SearchResult {
  status: 'results' | 'none' | 'ask' | 'small_talk' | 'listing' | 'other';
  source: string;
  total: number;
  items: ApiUnitListItem[];
  relaxed?: boolean;
  ignoredTerms?: string[];
  ask?: SearchAsk;
}
export interface VoiceFile { uri: string; name: string; type: string }
export interface UnitsPage { total: number; limit: number; offset: number; items: ApiUnitListItem[] }
export interface UnitsQuery {
  status?: 'active' | 'sold' | 'archived';
  q?: string;
  compound?: string;
  type?: string;
  deal?: string;
  mine?: boolean;
  limit?: number;
  offset?: number;
}

/** A failed call: `status` is the HTTP status (0 when the phone could not reach the server), `code` the API's error code. */
export class ApiClientError extends Error {
  status: number;
  code: string;
  retryAfterSec: number | null;
  constructor(status: number, code: string, retryAfterSec: number | null = null) {
    super(`${status} ${code}`);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.retryAfterSec = retryAfterSec;
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  getToken: () => string | null;
  /** Called when the server says the session is over (HTTP 401 on a call that sent a token). */
  onUnauthorized?: () => void;
  fetchImpl?: typeof fetch;
}

export function createApiClient(opts: ApiClientOptions) {
  const doFetch = opts.fetchImpl ?? fetch;

  async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown, query?: Record<string, string | number | boolean | undefined>): Promise<T> {
    const qs = query
      ? Object.entries(query)
          .filter(([, v]) => v !== undefined && v !== '' && v !== false)
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v === true ? '1' : String(v))}`)
          .join('&')
      : '';
    const token = opts.getToken();
    const headers: Record<string, string> = { Accept: 'application/json' };
    const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
    if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    let res: Response;
    try {
      res = await doFetch(`${opts.baseUrl}/api/v1${path}${qs ? `?${qs}` : ''}`, { method, headers, body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body) });
    } catch {
      throw new ApiClientError(0, 'network');
    }
    if (res.ok) return (await res.json()) as T;
    let code = 'error';
    try {
      code = ((await res.json()) as { error?: string }).error || code;
    } catch {
      /* not JSON */
    }
    if (res.status === 401 && token) opts.onUnauthorized?.();
    const retry = Number(res.headers.get('retry-after'));
    throw new ApiClientError(res.status, code, Number.isFinite(retry) && retry > 0 ? retry : null);
  }

  return {
    requestCode: (phone: string) => request<{ ok: true; codeMinutes: number }>('POST', '/auth/code/request', { phone }),
    verifyCode: (phone: string, code: string) => request<LoginResult>('POST', '/auth/code/verify', { phone, code }),
    logout: () => request<{ ok: true }>('POST', '/auth/logout', {}),
    me: () => request<{ broker: ApiBroker; agency: ApiAgency; expiresAt: string }>('GET', '/me'),
    units: (q: UnitsQuery = {}) => request<UnitsPage>('GET', '/units', undefined, { ...q }),
    search: (q: string, o: { ai?: boolean; drop?: boolean } = {}) => request<SearchResult>('GET', '/search', undefined, { q, ai: o.ai, drop: o.drop }),
    /** Sends a recorded note; the server writes it down and answers the text to search. */
    voiceToText: (file: VoiceFile) => {
      const form = new FormData();
      form.append('voice', file as unknown as Blob);
      return request<{ q: string }>('POST', '/search/voice', form);
    },
    today: () => request<TodayData>('GET', '/today'),
    unit: (code: string) => request<ApiUnitDetail>('GET', `/units/${encodeURIComponent(code)}`),
  };
}
export type ApiClient = ReturnType<typeof createApiClient>;
