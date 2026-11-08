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
export type LeadStage = 'new' | 'contacted' | 'interested' | 'viewing' | 'negotiation' | 'won' | 'lost';
export const LEAD_STAGES: LeadStage[] = ['new', 'contacted', 'interested', 'viewing', 'negotiation', 'won', 'lost'];
export type LeadTab = 'all' | LeadStage | 'due_today' | 'overdue' | 'no_next_step';
export interface ApiLead {
  ref: string;
  name: string | null;
  phones: string[];
  kind: 'buyer' | 'tenant' | 'seller' | 'landlord';
  stage: LeadStage;
  lostReason: string | null;
  source: string | null;
  notes: string | null;
  nextFollowUpAt: string | null;
  followUpKind: 'call' | 'viewing' | null;
  followUpNote: string | null;
  lastContactAt: string | null;
  assignee: string | null;
  version: number;
}
export interface LeadsPage { items: ApiLead[]; more: boolean; offset: number; limit: number }
export interface LeadEvent { id: string; kind: string; at: string; by: string | null; text: string | null; stage: string | null }
export interface LeadDetail { lead: ApiLead; timeline: LeadEvent[] }
export interface NewLead { phone1: string; phone2?: string; name?: string; kind?: ApiLead['kind']; notes?: string; lawfulBasis?: 'client_request' | 'consent' | 'existing_client' }
/** The fields of the add-unit form use the website form's names (strings, features as an array). */
export type UnitFields = Record<string, string | string[] | boolean | undefined>;
export interface ReviewResult { ok: boolean; blockers: { field: string; label: string }[]; warnings: { field: string; text: string }[]; duplicate: string | null }
export interface FirebaseClientConfig { apiKey: string; appId: string; projectId: string; messagingSenderId: string }
export interface AppConfig {
  minAppVersion: string;
  storeUrl: { android: string | null; ios: string | null };
  /** The phone's public Firebase identifiers; null until the server has them. Alerts and crash reports stay off without them. */
  firebase?: { android?: FirebaseClientConfig; ios?: FirebaseClientConfig } | null;
}
export interface UploadFile { uri: string; name: string; type: string }
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
export interface MapPin {
  id: string;
  n: number;
  name: string;
  name_ar: string | null;
  name_en: string | null;
  developer: string | null;
  district: string | null;
  lat: number;
  lng: number;
}
export interface MapFilters {
  type?: 'sale' | 'rent';
  rooms?: number;
  ptype?: string;
  fin?: string;
  furn?: string;
  pmin?: number;
  pmax?: number;
}
export interface MapData {
  tilesUrl: string | null;
  pins: MapPin[];
  total: number;
  unmapped: number;
  facets: { types?: string[]; rooms?: number[] };
}
export interface MapUnit {
  code: string;
  title: string | null;
  propertyType: string | null;
  listingType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  area: number | null;
  price: number | null;
  priceText: string | null;
}
export interface MapUnits {
  place: { id: string; name_en: string | null; name_ar: string | null };
  items: MapUnit[];
}

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
    map: (f: MapFilters = {}) => request<MapData>('GET', '/map', undefined, { ...f }),
    mapUnits: (placeId: string, f: MapFilters = {}) => request<MapUnits>('GET', `/map/places/${encodeURIComponent(placeId)}/units`, undefined, { ...f }),
    search: (q: string, o: { ai?: boolean; drop?: boolean } = {}) => request<SearchResult>('GET', '/search', undefined, { q, ai: o.ai, drop: o.drop }),
    /** Sends a recorded note; the server writes it down and answers the text to search. */
    voiceToText: (file: VoiceFile) => {
      const form = new FormData();
      form.append('voice', file as unknown as Blob);
      return request<{ q: string }>('POST', '/search/voice', form);
    },
    config: () => request<AppConfig>('GET', '/config'),
    registerDevice: (token: string, platform: 'android' | 'ios') => request<{ ok: true }>('POST', '/devices', { token, platform }),
    removeDevice: (token: string) => request<{ ok: true }>('POST', '/devices/remove', { token }),
    leads: (o: { tab?: LeadTab; q?: string; offset?: number } = {}) => request<LeadsPage>('GET', '/leads', undefined, { tab: o.tab && o.tab !== 'all' ? o.tab : undefined, q: o.q, offset: o.offset || undefined }),
    lead: (ref: string) => request<LeadDetail>('GET', `/leads/${encodeURIComponent(ref)}`),
    createLead: (l: NewLead) => request<{ outcome: 'created' | 'merged'; lead: ApiLead }>('POST', '/leads', { lawfulBasis: 'client_request', ...l }),
    leadCalled: (ref: string, version: number) => request<{ lead: ApiLead }>('POST', `/leads/${encodeURIComponent(ref)}/contacted`, { version }),
    leadStage: (ref: string, version: number, stage: LeadStage, lostReason?: string) => request<{ lead: ApiLead }>('POST', `/leads/${encodeURIComponent(ref)}/stage`, { version, stage, lostReason }),
    leadFollowUp: (ref: string, version: number, at: string, kind: 'call' | 'viewing', note?: string) => request<{ lead: ApiLead }>('POST', `/leads/${encodeURIComponent(ref)}/follow-up`, { version, at, kind, note }),
    leadNote: (ref: string, version: number, text: string) => request<{ lead: ApiLead }>('POST', `/leads/${encodeURIComponent(ref)}/note`, { version, text }),
    /** Reads a pasted/shared message and/or a voice note into the add-unit fields. Nothing is saved. */
    extractUnit: (o: { describe?: string; voice?: UploadFile; fields?: UnitFields }) => {
      const form = new FormData();
      if (o.describe) form.append('describe', o.describe);
      if (o.voice) form.append('voice', o.voice as unknown as Blob);
      if (o.fields) form.append('fields', JSON.stringify(o.fields));
      return request<{ fields: UnitFields }>('POST', '/units/extract', form);
    },
    reviewUnit: (fields: UnitFields, photoCount: number) => request<ReviewResult>('POST', '/units/review', { fields, photoCount }),
    /** Saves the unit; photos are sent in the broker's order. */
    createUnit: (fields: UnitFields, photos: UploadFile[]) => {
      const form = new FormData();
      form.append('fields', JSON.stringify(fields));
      for (const p of photos) form.append('photos', p as unknown as Blob);
      return request<{ code: string; photos: number; photosFailed: number }>('POST', '/units', form);
    },
    today: () => request<TodayData>('GET', '/today'),
    unit: (code: string) => request<ApiUnitDetail>('GET', `/units/${encodeURIComponent(code)}`),
  };
}
export type ApiClient = ReturnType<typeof createApiClient>;
