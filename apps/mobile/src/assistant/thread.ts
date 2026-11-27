import type { AssistantContext, AssistantQueryResponse } from '@wehdathub/shared';
import type { LeadFilters, ReportKind } from './ReportView';

export type TurnSource = 'text' | 'voice' | 'chip';
/** A report answered inline in the thread; the full screen opens from it. */
export interface ReportSpec { kind: Extract<ReportKind, 'leads' | 'deals' | 'dashboard' | 'ranking'>; leadFilters?: LeadFilters; assignee?: string; dealLastMonth?: boolean }
export interface Turn {
  id: string;
  question: string;
  source: TurnSource;
  status: 'pending' | 'done' | 'error';
  response?: AssistantQueryResponse;
  error?: string;
  report?: ReportSpec;
  /** The broker gave this answer a thumbs-down: no second send. */
  rated?: boolean;
}

export type ThreadAction =
  | { type: 'ask'; id: string; question: string; source: TurnSource }
  | { type: 'resolve'; id: string; response: AssistantQueryResponse }
  | { type: 'fail'; id: string; error: string }
  | { type: 'report'; id: string; question: string; report: ReportSpec }
  | { type: 'rate'; id: string }
  | { type: 'retry'; id: string }
  | { type: 'discard'; id: string }
  | { type: 'restore'; turns: Turn[] }
  | { type: 'reset' };

export const MAX_TURNS = 20;
export const PERSISTED_TURNS = 10;

const patch = (turns: Turn[], id: string, change: Partial<Turn>) => turns.map((t) => (t.id === id ? { ...t, ...change } : t));

export function threadReducer(turns: Turn[], action: ThreadAction): Turn[] {
  switch (action.type) {
    case 'ask':
      return [...turns, { id: action.id, question: action.question, source: action.source, status: 'pending' as const }].slice(-MAX_TURNS);
    case 'report':
      return [...turns, { id: action.id, question: action.question, source: 'text' as const, status: 'done' as const, report: action.report }].slice(-MAX_TURNS);
    case 'rate':
      return patch(turns, action.id, { rated: true });
    case 'resolve':
      return patch(turns, action.id, { status: 'done', response: action.response, error: undefined });
    case 'fail':
      return patch(turns, action.id, { status: 'error', error: action.error });
    case 'retry':
      return patch(turns, action.id, { status: 'pending', error: undefined });
    case 'discard':
      return turns.filter((t) => t.id !== action.id);
    case 'restore':
      // Never clobber a thread the broker has already started.
      return turns.length ? turns : action.turns.slice(-MAX_TURNS);
    case 'reset':
      return [];
  }
}

/** The follow-up context: from the last answered turn. A "which one?" answer does not change it. */
export function contextOf(turns: Turn[]): AssistantContext | null {
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    const r = turns[i].status === 'done' ? turns[i].response : undefined;
    if (r && r.intent !== 'disambiguate') return r.nextContext ?? null;
  }
  return null;
}

const SAFE_INTENTS = new Set(['unit_search', 'inventory_count', 'primary', 'clarify']);
const SAFE_CARDS = new Set(['text_answer', 'disambiguate']);

/** What may be saved on the phone: finished inventory/project answers only. Lead and CRM data (client names, phones) is never persisted. */
export function persistableTurns(turns: Turn[]): Turn[] {
  return turns
    .filter((x) => x.status === 'done' && x.response && SAFE_INTENTS.has(x.response.intent))
    .map((x) => ({ ...x, response: { ...x.response!, cards: x.response!.cards.filter((c) => SAFE_CARDS.has(c.kind)) } }));
}
