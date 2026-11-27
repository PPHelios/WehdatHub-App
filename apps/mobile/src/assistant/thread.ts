import type { AssistantContext, AssistantQueryResponse } from '@wehdathub/shared';

export type TurnSource = 'text' | 'voice' | 'chip';
export interface Turn {
  id: string;
  question: string;
  source: TurnSource;
  status: 'pending' | 'done' | 'error';
  response?: AssistantQueryResponse;
  error?: string;
}

export type ThreadAction =
  | { type: 'ask'; id: string; question: string; source: TurnSource }
  | { type: 'resolve'; id: string; response: AssistantQueryResponse }
  | { type: 'fail'; id: string; error: string }
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
