// The app's JSON API (backend /api/v1): types and a small typed client, shared by the mobile app and the future website.

export type Lang = 'ar' | 'en';
export type UnitStatus = 'active' | 'sold' | 'archived';
export type StatusCounts = Record<UnitStatus, number>;
/** What this person may do. The server decides; the app hides what is not allowed. */
export interface Rights { addUnits: boolean; editUnits: boolean; leads: boolean; search: boolean; team: boolean; owners: boolean; manager: boolean; agencyOwner: boolean; dataEntry: boolean; teamLead: boolean }
export interface ApiBroker { id: string; name: string; role: string; lang: Lang }
export interface ApiAgency { id: string; name: string; slug: string; logoUrl: string | null }
/** Present only for the test number: its roles, its own role, and whether it may view NCH (read only). */
export interface ApiTestSwitch { roles: string[]; role: string; canView: boolean; viewing: boolean }
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
  canEdit?: boolean;
  features: string[];
  images:{ id: string; url: string; position: number }[];
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
  assigneeId?: string | null;
  version: number;
}
export interface LeadsPage { items: ApiLead[]; more: boolean; total: number; offset: number; limit: number }
export interface LeadEvent { id: string; kind: string; at: string; by: string | null; text: string | null; stage: string | null }
export interface TeamRules { rules: { enabled: boolean; wait_minutes: number; start: number; end: number; days: number[]; max_jumps: number }; roundRobin: boolean; order: string[]; brokers: { id: string; name: string; role: string; away: boolean; open: number }[] }
export interface TeamMember { id: string; name: string; role: string; me: boolean; away: boolean; open: number; overdue: number; soon: number }
export interface OwnerRow { id: string; name: string | null; code: string | null; phones: string[]; unit_count: number; flag: string | null; is_private: boolean }
export interface OwnerUnit { code: string; compound: string | null; status: string; is_private: boolean }
export interface OwnerProfile extends OwnerRow { notes: string | null; canEdit: boolean; units: OwnerUnit[] }
export interface OwnerEvent { kind: string; data: Record<string, unknown> | null; created_at: string; broker_name: string | null }
export interface OwnerRename { id: number; code: string; old_value: string | null; new_value: string; requested_by_name: string | null; created_at: string }
export interface AccessRequest { id: number; status: 'pending' | 'approved' | 'declined'; created_at: string; code: string; broker_name: string; decided_by_name: string | null }
export interface ActivityRow { id: string | number; at: string; who: string; text: string; device: string }
export interface DashboardData { days: number; weekly: number[]; sources: { source: string; n: number }[]; pipeline: Record<string, number>; unassigned: number; uncontacted: number; overdue: number; units: { active: number; stale: number }; deals: { n: number; commission: number; value: number }; leads: number; board: { id: string; name: string; leads: number; contacted: number; forward: number; deals: number; commission: number }[] }
export interface PriceRow { place: string; listing_type: 'sale' | 'rent'; units: number; median: number; low: number; high: number }
export interface WinLossGroup { key: string; name?: string; won: number; lost: number; rate: number | null; top: string | null }
export interface WinLossData { days: number; won: number; lost: number; rate: number | null; reasons: { key: string; n: number; pct: number }[]; brokers: WinLossGroup[]; sources: WinLossGroup[] }
export type Row = Record<string, unknown>;
export interface DealsData { items: Row[]; more: boolean; totals: Row[]; statuses: string[] }
export interface CommissionsData { kind: string; period: string; items: Row[]; total: number; totals: Row | null; statuses: string[] }
export interface SourcesData { month: string; rows: { source: string; leads: number; deals: number; commission: number; spend: number | null; perLead: number | null; perDeal: number | null }[]; totals: Row }
export interface AskAnswer { answer: string; found: boolean; lang: Lang; dataDates: string | null }
export interface UnitImage { id: string; url: string; position: number }
export interface ApiViewing { id: string; startsAt: string; place: string | null; status: string; proposedAt: string | null; clientNote: string | null; leadRef: string; leadName: string | null; unitCode: string | null }
export interface SentLink { createdAt: string; unitCode: string; compound: string | null; opens: number; lastOpenedAt: string | null; recipientPhone: string | null; leadRef: string | null; leadName: string | null; note: string | null }
export interface ViewingSet { lead: ApiLead; viewing: { id: string; startsAt: string; place: string | null; status: string }; url: string; message: string; wa: string | null }
export interface LeadDetail { lead: ApiLead; timeline: LeadEvent[] }
export interface NewLead { phone1: string; phone2?: string; name?: string; kind?: ApiLead['kind']; notes?: string; lawfulBasis?: 'client_request' | 'consent' | 'existing_client' }
/** The fields of the add-unit form use the website form's names (strings, features as an array). */
/** One entry of the place suggestion list: a compound (or its other name), an area, or a sub-zone. area_id and subzone_id are what a unit stores when it is picked. */
export interface PlaceSuggestion { kind: 'compound' | 'area' | 'subzone'; id: string; name_en: string | null; name_ar: string | null; path: string; via: 'name' | 'alias' | 'alike'; area_id: string | null; subzone_id: string | null }
export interface PlaceList { version: string; places: import('./placeMatch').ListPlace[]; areas: import('./placeMatch').ListArea[] }
export type PlaceListReply = PlaceList | { version: string; unchanged: true };
export type UnitFields = Record<string, string | string[] | boolean | undefined>;
export interface UnitChange { field: string; ar: string; en: string; from: string; to: string }
export interface ReviewResult { ok: boolean; blockers: { field: string; label: string }[]; warnings: { field: string; text: string }[]; duplicate: string | null; /** Edit only: the main fields that would change. */ changes?: UnitChange[] }
export interface FirebaseClientConfig { apiKey: string; appId: string; projectId: string; messagingSenderId: string }
export interface AppConfig {
  minAppVersion: string;
  storeUrl: { android: string | null; ios: string | null };
  /** The phone's public Firebase identifiers; null until the server has them. Alerts and crash reports stay off without them. */
  firebase?: { android?: FirebaseClientConfig; ios?: FirebaseClientConfig } | null;
}
/** key: set once the photo is stored (direct upload); pct: upload progress 0 to 100; failed: the upload stopped and can be retried. */
export interface UploadFile { uri: string; name: string; type: string; key?: string; pct?: number; failed?: boolean }
export interface PhotoUploadLink { key: string; upload_url: string; thumb_key: string; thumb_upload_url: string | null }
export interface SearchAsk { terms: string[]; numbers?: unknown[]; aiDown?: boolean; withoutTotal: number }
export interface SearchResult {
  status: 'results' | 'none' | 'ask' | 'small_talk' | 'listing' | 'other';
  source: string;
  total: number;
  items: ApiUnitListItem[];
  unitStatus?: UnitStatus;
  counts?: StatusCounts;
  offset?: number;
  limit?: number;
  relaxed?: boolean;
  ignoredTerms?: string[];
  /** What the server understood, in the broker's language (e.g. "شقة · بيع أو إيجار · هايد بارك"). */
  reading?: string;
  ask?: SearchAsk;
}
export interface VoiceFile { uri: string; name: string; type: string }
export interface UnitsPage { total: number; counts: StatusCounts; limit: number; offset: number; items: ApiUnitListItem[] }
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
  photo?: string | null;
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
  staleDays?: number;
  bedrooms?: number;
  furnishing?: string;
  finishing?: string;
  limit?: number;
  offset?: number;
}

/** A failed call: `status` is the HTTP status (0 when the phone could not reach the server), `code` the API's error code. */
export class ApiClientError extends Error {
  status: number;
  code: string;
  retryAfterSec: number | null;
  /** The rest of the error body (e.g. `access` on a hidden contact, `blockers` on an incomplete save). */
  extra: Record<string, unknown>;
  constructor(status: number, code: string, retryAfterSec: number | null = null, extra: Record<string, unknown> = {}) {
    super(`${status} ${code}`);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.retryAfterSec = retryAfterSec;
    this.extra = extra;
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  getToken: () => string | null;
  /** Called when the server says the session is over (HTTP 401 on a call that sent a token). */
  onUnauthorized?: () => void;
  /** Sent with every call (the app's platform and version), so the server's failure log can tell the phones apart. */
  headers?: Record<string, string>;
  fetchImpl?: typeof fetch;
}

export function createApiClient(opts: ApiClientOptions) {
  const doFetch = opts.fetchImpl ?? fetch;

  async function request<T>(method: 'GET' | 'POST' | 'PUT', path: string, body?: unknown, query?: Record<string, string | number | boolean | undefined>): Promise<T> {
    const qs = query
      ? Object.entries(query)
          .filter(([, v]) => v !== undefined && v !== '' && v !== false)
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v === true ? '1' : String(v))}`)
          .join('&')
      : '';
    const token = opts.getToken();
    const headers: Record<string, string> = { Accept: 'application/json', ...(opts.headers ?? {}) };
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
    let extra: Record<string, unknown> = {};
    try {
      extra = (await res.json()) as Record<string, unknown>;
      code = (typeof extra.error === 'string' && extra.error) || code;
    } catch {
      /* not JSON */
    }
    if (res.status === 401 && token) opts.onUnauthorized?.();
    const retry = Number(res.headers.get('retry-after'));
    throw new ApiClientError(res.status, code, Number.isFinite(retry) && retry > 0 ? retry : null, extra);
  }

  return {
    notificationSettings: () => request<NotificationSettings>('GET', '/notification-settings'),
    saveNotificationSettings: (body: NotificationSettingsInput) => request<NotificationSettings>('PUT', '/notification-settings', body),
    requestCode: (phone: string) => request<{ ok: true; codeMinutes: number }>('POST', '/auth/code/request', { phone }),
    verifyCode: (phone: string, code: string) => request<LoginResult>('POST', '/auth/code/verify', { phone, code }),
    logout: () => request<{ ok: true }>('POST', '/auth/logout', {}),
    me: () => request<{ broker: ApiBroker; agency: ApiAgency; rights: Rights; expiresAt: string; testSwitch: ApiTestSwitch | null; platformOwner?: boolean }>('GET', '/me'),
    testRole: (role: string) => request<{ ok: true; role: string }>('POST', '/test-role', { role }),
    testView: (view: 'home' | 'other') => request<{ ok: true; viewing: boolean }>('POST', '/test-view', { view }),
    units: (q: UnitsQuery = {}) => request<UnitsPage>('GET', '/units', undefined, { ...q }),
    map: (f: MapFilters = {}) => request<MapData>('GET', '/map', undefined, { ...f }),
    mapUnits: (placeId: string, f: MapFilters = {}) => request<MapUnits>('GET', `/map/places/${encodeURIComponent(placeId)}/units`, undefined, { ...f }),
    search: (q: string, o: { ai?: boolean; drop?: boolean; status?: UnitStatus; offset?: number } = {}) => request<SearchResult>('GET', '/search', undefined, { q, ai: o.ai, drop: o.drop, status: o.status, offset: o.offset }),
    leadCounts: (q?: string, broker?: string) => request<{ counts: Record<string, number> }>('GET', '/leads/counts', undefined, { q, broker }),
    /** Sends a recorded note; the server writes it down and answers the text to search. */
    voiceToText: (file: VoiceFile) => {
      const form = new FormData();
      form.append('voice', file as unknown as Blob);
      return request<{ q: string }>('POST', '/search/voice', form);
    },
    config: () => request<AppConfig>('GET', '/config'),
    registerDevice: (token: string, platform: 'android' | 'ios') => request<{ ok: true }>('POST', '/devices', { token, platform }),
    removeDevice: (token: string) => request<{ ok: true }>('POST', '/devices/remove', { token }),
    leads: (o: { tab?: LeadTab; q?: string; offset?: number; broker?: string } = {}) => request<LeadsPage>('GET', '/leads', undefined, { tab: o.tab && o.tab !== 'all' ? o.tab : undefined, q: o.q, offset: o.offset || undefined, broker: o.broker }),
    lead: (ref: string) => request<LeadDetail>('GET', `/leads/${encodeURIComponent(ref)}`),
    /** Sets a viewing. Nothing is sent: the answer carries the client's message and link for the broker to send or not. */
    setViewing: (ref: string, o: { version: number; at: string; unitCode?: string; place?: string; lang: Lang }) => request<ViewingSet>('POST', `/leads/${encodeURIComponent(ref)}/viewing`, o),
    viewings: (o: { from?: string; to?: string } = {}) => request<{ items: ApiViewing[] }>('GET', '/viewings', undefined, { from: o.from, to: o.to }),
    sentLinks: (offset = 0) => request<{ offset: number; hasMore: boolean; items: SentLink[] }>('GET', '/links', undefined, { offset: offset || undefined }),
    extractLead: (message: string) => request<{ name: string; phones: string[]; kind: ApiLead['kind']; source: string; note: string }>('POST', '/leads/extract', { message }),
    createLead: (l: NewLead) => request<{ outcome: 'created' | 'merged'; lead: ApiLead }>('POST', '/leads', { lawfulBasis: 'client_request', ...l }),
    leadCalled: (ref: string, version: number) => request<{ lead: ApiLead }>('POST', `/leads/${encodeURIComponent(ref)}/contacted`, { version }),
    leadStage: (ref: string, version: number, stage: LeadStage, lostReason?: string) => request<{ lead: ApiLead }>('POST', `/leads/${encodeURIComponent(ref)}/stage`, { version, stage, lostReason }),
    leadFollowUp: (ref: string, version: number, at: string, kind: 'call' | 'viewing', note?: string) => request<{ lead: ApiLead }>('POST', `/leads/${encodeURIComponent(ref)}/follow-up`, { version, at, kind, note }),
    leadDraft: (ref: string, lang: 'ar' | 'en') => request<{ text: string; wa: string | null }>('POST', `/leads/${encodeURIComponent(ref)}/draft`, { lang }),
    leadSend: (ref: string, code: string, lang: 'ar' | 'en') => request<{ url: string }>('POST', `/leads/${encodeURIComponent(ref)}/send`, { code, lang }),
    leadMerge: (ref: string, other: string, confirm: string) => request<{ lead: ApiLead }>('POST', `/leads/${encodeURIComponent(ref)}/merge`, { other, confirm }),
    leadErase: (ref: string, confirm: string) => request<{ ok: true }>('POST', `/leads/${encodeURIComponent(ref)}/erase`, { confirm }),
    leadNote: (ref: string, version: number, text: string) => request<{ lead: ApiLead }>('POST', `/leads/${encodeURIComponent(ref)}/note`, { version, text }),
    /** Reads a pasted/shared message and/or a voice note into the add-unit fields. Nothing is saved. */
    extractUnit: (o: { describe?: string; voice?: UploadFile; fields?: UnitFields }) => {
      const form = new FormData();
      if (o.describe) form.append('describe', o.describe);
      if (o.voice) form.append('voice', o.voice as unknown as Blob);
      if (o.fields) form.append('fields', JSON.stringify(o.fields));
      return request<{ fields: UnitFields }>('POST', '/units/extract', form);
    },
    /** `code` set (edit): the review also lists what would change. */
    reviewUnit: (fields: UnitFields, photoCount: number, code?: string) => request<ReviewResult>('POST', '/units/review', { fields, photoCount, ...(code ? { code } : {}) }),
    /** An error caught inside the app (a screen crash); the server keeps it with the failures and alerts the owner. */
    reportClientError: (body: { message: string; screen?: string; stack?: string; platform: string; appVersion: string }) => request<unknown>('POST', '/client-error', body),
    /** Saves the unit; photos are sent in the broker's order. */
    createUnit: (fields: UnitFields, photos: UploadFile[], saveKey?: string, photoKeys?: string[]) => {
      const form = new FormData();
      form.append('fields', JSON.stringify(fields));
      if (saveKey) form.append('save_key', saveKey);
      if (photoKeys?.length) form.append('photo_keys', JSON.stringify(photoKeys));
      for (const p of photos) form.append('photos', p as unknown as Blob);
      return request<{ code: string; photos: number; photosFailed: number }>('POST', '/units', form);
    },
    today: () => request<TodayData>('GET', '/today'),
    unit: (code: string) => request<ApiUnitDetail>('GET', `/units/${encodeURIComponent(code)}`),
    unitContact: (code: string) => request<{ name: string | null; phone: string | null }>('GET', `/units/${encodeURIComponent(code)}/contact`),
    /** `to` is a lead ref (L-0042) or a mobile number; leave it out to share without a client. */
    unitShareLink: (code: string, lang: Lang, to?: string) => request<{ url: string; recipientPhone: string | null; leadLinked: boolean }>('POST', `/units/${encodeURIComponent(code)}/share-link`, { lang, ...(to ? { to } : {}) }),
    team: () => request<{ items: TeamMember[] }>('GET', '/team'),
    teamRules: () => request<TeamRules>('GET', '/team/rules'),
    saveTeamRules: (b: { enabled: boolean; wait_minutes: string; start: string; end: string; days: number[]; max_jumps: number }) => request<{ rules: TeamRules['rules'] }>('POST', '/team/rules', b),
    saveTeamRouting: (b: { roundRobin: boolean; order: string[] }) => request<{ roundRobin: boolean; order: string[] }>('POST', '/team/routing', b),
    setTeamAway: (id: string, until: string | null) => request<{ id: string; awayUntil: string | null }>('POST', `/team/${encodeURIComponent(id)}/away`, { until }),
    invite: (b: { name: string; phone: string; role: string }) => request<{ ok: true; created: boolean; url: string | null }>('POST', '/team/invite', b),
    changeRole: (id: string, role: string) => request<{ ok: true }>('POST', `/team/${id}/role`, { role }),
    deactivate: (id: string) => request<{ ok: true }>('POST', `/team/${id}/deactivate`, {}),
    owners: (q: { q?: string; page?: number; private?: boolean } = {}) => request<{ items: OwnerRow[]; more: boolean }>('GET', '/owners', undefined, { q: q.q, page: q.page, private: q.private ? '1' : undefined }),
    owner: (id: string) => request<{ owner: OwnerProfile; events: OwnerEvent[]; lead: { ref: number } | null }>('GET', `/owners/${id}`),
    editOwner: (id: string, b: { name?: string; phone?: string; notes?: string; flag?: string }) => request<{ ok: true; nameRequested: boolean }>('POST', `/owners/${id}`, b),
    deleteOwner: (id: string) => request<{ ok: true }>('POST', `/owners/${id}/delete`, {}),
    ownerPrivate: (id: string, value: boolean, units: string[] = []) => request<{ ok: true }>('POST', `/owners/${id}/portfolio`, { value, units }),
    ownerRenames: () => request<{ items: OwnerRename[] }>('GET', '/owners/requests'),
    decideRename: (id: number, approve: boolean) => request<{ ok: true }>('POST', `/owners/requests/${id}`, { decision: approve ? 'approve' : 'reject' }),
    accessRequests: (status: string, page = 0) => request<{ items: AccessRequest[]; total: number }>('GET', '/access-requests', undefined, { status, page }),
    answerAccess: (id: number, approve: boolean) => request<{ ok: true }>('POST', `/access-requests/${id}`, { decision: approve ? 'approve' : 'decline' }),
    dashboard: (days = 30) => request<DashboardData>('GET', '/dashboard', undefined, { days }),
    pricePerM2: () => request<{ minUnits: number; items: PriceRow[] }>('GET', '/insights/prices'),
    winLoss: (days = 30) => request<WinLossData>('GET', '/insights/winloss', undefined, { days }),
    report: (text: string) => request<{ ok: true; id: number }>('POST', '/report', { text }),
    deals: (status?: string, page = 0) => request<DealsData>('GET', '/deals', undefined, { status, page }),
    dealStatus: (ref: string, status: string, version?: number) => request<{ ok: true }>('POST', `/deals/${ref}/status`, { status, version }),
    commissions: (kind: 'resale' | 'developers', status?: string, page = 0) => request<CommissionsData>('GET', '/commissions', undefined, { kind, status, page }),
    commission: (id: string) => request<{ commission: Row }>('GET', `/commissions/${id}`),
    commissionMove: (id: string, body: Row) => request<{ ok: true }>('POST', `/commissions/${id}`, body),
    sources: (month?: string) => request<SourcesData>('GET', '/sources', undefined, { month }),
    saveSpend: (month: string, spend: Record<string, string>) => request<{ ok: true }>('POST', '/sources/spend', { month, spend }),
    portalEnquiries: () => request<{ items: Row[] }>('GET', '/portal-enquiries'),
    assignEnquiry: (id: string, b: { phone: string; brokerId?: string }) => request<{ ok: true; outcome: string }>('POST', `/portal-enquiries/${id}/assign`, b),
    linkEnquiry: (id: string, unitCode: string) => request<{ ok: true }>('POST', `/portal-enquiries/${id}/link`, { unitCode }),
    openedLinks: (status?: string, page?: number) => request<{ rows: Row[]; total: number; pages: number; page: number }>('GET', '/opened-links', undefined, { status, page }),
    catalogue: (q?: string, page = 0) => request<{ projects: { items: Row[]; total: number; pages: number }; developers: { items: Row[] }; canEdit: boolean }>('GET', '/catalogue', undefined, { q, page }),
    project: (id: string) => request<{ project: Row; developer: Row | null; phases: Row[]; plans: Row[]; materials: Row[]; units: Row[]; canEdit: boolean }>('GET', `/catalogue/projects/${id}`),
    archiveProject: (id: string, archived: boolean) => request<{ ok: true }>('POST', `/catalogue/projects/${id}/archive`, { archived }),
    library: (q?: string, page = 0) => request<{ items: Row[]; pages: number }>('GET', '/library', undefined, { q, page }),
    useLibrary: (id: string) => request<{ ok: true; projectId: string }>('POST', `/library/${id}/use`, {}),
    compare: (codes: string[], lang: 'ar' | 'en') => request<{ url: string; codes: string[] }>('POST', '/compare', { codes, lang }),
    plan: () => request<{ allowance: Row; payTo: Row; limits: Row; payments: Row[]; requests: Row[]; referral: Row | null; canPay: boolean }>('GET', '/plan'),
    creditRequest: (credits: number, note: string) => request<{ ok: true }>('POST', '/plan/credit-request', { credits, note }),
    usage: () => request<{ state: Row; allowance: Row; mine: Row; agency: Row | null }>('GET', '/usage'),
    platform: () => request<{ dashboard: Row; period: Row; agencies: Row[]; signupOpen: boolean }>('GET', '/platform'),
    platformAgency: (id: string, action: 'suspend' | 'resume') => request<{ ok: boolean }>('POST', `/platform/agencies/${id}/${action}`, {}),
    platformSignup: (open: boolean) => request<{ ok: true }>('POST', '/platform/signup', { open }),
    platformAnnounce: (title: string, body: string) => request<{ ok: true; sent: number }>('POST', '/platform/announce', { title, body }),
    platformNewAgency: (b: { agency: string; ownerName: string; ownerPhone: string; plan?: string }) => request<{ ok: true; url: string | null }>('POST', '/platform/agencies', b),
    activityLog: (page = 0) => request<{ items: ActivityRow[]; more: boolean }>('GET', '/activity-log', undefined, { page }),
    /** Moves a lead to a broker of the team, or back to the managers with null. */
    assignLead: (ref: string, version: number, brokerId: string | null) => request<{ lead: ApiLead }>('POST', `/leads/${encodeURIComponent(ref)}/assign`, { version, brokerId }),
    ask: (question: string) => request<AskAnswer>('POST', '/ask', { question }),
    unitStatus: (code: string, status: 'active' | 'sold' | 'archived') => request<{ ok: true; status: string }>('POST', `/units/${encodeURIComponent(code)}/status`, { status }),
    unitDelete: (code: string) => request<{ ok: true }>('POST', `/units/${encodeURIComponent(code)}/delete`, {}),
    unitRestore: (code: string) => request<{ ok: true; code: string }>('POST', `/units/${encodeURIComponent(code)}/restore`, {}),
    unitLease: (code: string) => request<{ rent: boolean; lease: { startDate: string; months: number; rent: number | null; increasePct: number | null; tenantName: string | null; remind: boolean } | null }>('GET', `/units/${encodeURIComponent(code)}/lease`),
    saveUnitLease: (code: string, l: { startDate: string; months: string; rent: string; increasePct: string; tenantName: string; remind: boolean } | { remove: true }) => request<{ ok: true }>('POST', `/units/${encodeURIComponent(code)}/lease`, l),
    saveUnitPrivate: (code: string, p: { pin: string; unitNo: string; address: string }) => request<{ ok: true }>('POST', `/units/${encodeURIComponent(code)}/private`, p),
    unitFlyer: (code: string, theme: 'dark' | 'light' = 'dark') => request<{ url: string }>('POST', `/units/${encodeURIComponent(code)}/flyer`, { theme }),
    /** Photos of an existing unit: new files to add, ids to remove, and the order of the kept ones (first is the cover). */
    /** One-time links so each photo goes straight to storage; then send the returned keys as photoKeys. */
    photoUploadLinks: (count: number) => request<{ uploads: PhotoUploadLink[]; expires_in: number }>('POST', '/units/photo-upload', { count }),
    unitPhotos: (code: string, o: { add?: UploadFile[]; remove?: string[]; order?: string[]; photoKeys?: string[] }) => {
      const form = new FormData();
      if (o.photoKeys?.length) form.append('photo_keys', JSON.stringify(o.photoKeys));
      for (const p of o.add ?? []) form.append('photos', p as unknown as Blob);
      if (o.remove?.length) form.append('remove', JSON.stringify(o.remove));
      if (o.order?.length) form.append('order', JSON.stringify(o.order));
      return request<{ images: UnitImage[]; failed: number }>('POST', `/units/${encodeURIComponent(code)}/photos`, form);
    },
    unitEditFields: (code: string) => request<{ code: string; version: number; fields: UnitFields }>('GET', `/units/${encodeURIComponent(code)}/edit`),
    saveUnitEdit: (code: string, version: number, fields: UnitFields, saveKey?: string) => request<{ code: string; version: number }>('POST', `/units/${encodeURIComponent(code)}/edit`, { version, fields, ...(saveKey ? { save_key: saveKey } : {}) }),
    /** Was the save with this key stored? Asked once when a save has not answered for 60 seconds. */
    unitSaveStatus: (key: string) => request<{ saved: boolean; code?: string }>('GET', '/units/save-status', undefined, { key }),
    placeSuggest: (q: string) => request<{ items: PlaceSuggestion[] }>('GET', '/places/suggest', undefined, { q }),
    placeList: (since?: string) => request<PlaceListReply>('GET', '/places/list', undefined, since ? { since } : undefined),
    unitCompounds: (q: string) => request<{ items: { name: string; n: number }[] }>('GET', '/units/compounds', undefined, { q }),
    unitAccessRequest: (code: string) => request<{ ok: true; already: boolean; access: 'granted' | 'pending' }>('POST', `/units/${encodeURIComponent(code)}/access-request`, {}),
  };
}
export type ApiClient = ReturnType<typeof createApiClient>;

export type NotifyChannel = 'both' | 'telegram' | 'web' | 'whatsapp';
export type NotifyFrequency = 'immediate' | 'hourly' | 'daily';
export interface NotifyKind { label: { ar: string; en: string }; on: boolean; channel: NotifyChannel; frequency: NotifyFrequency; locked: 'owner' | 'manager' | null; urgent: boolean }
export interface NotificationSettings { kinds: Record<string, NotifyKind>; reminderMinutes: number[]; quiet: { enabled: boolean; start: number; end: number }; telegramLinked: boolean }
export interface NotificationSettingsInput { kinds: Record<string, { on?: boolean; channel?: NotifyChannel; frequency?: NotifyFrequency }>; reminderMinutes: number[]; quiet: { enabled: boolean; start: number; end: number } }
