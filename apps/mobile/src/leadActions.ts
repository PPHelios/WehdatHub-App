import type { QueryClient } from '@tanstack/react-query';
import { api } from './api';
import { usage } from './usage';

/** Nudge / assign calls shared by the assistant cards and the Home decision cards. */
export async function nudgeLead(ref: string): Promise<void> {
  await api.nudgeLead(ref);
  usage('lead_nudge_sent', true);
  usage('assistant_action_tapped', true, undefined, { action: 'nudge' });
}

export async function assignLead(queries: QueryClient, ref: string, brokerId: string, version?: number): Promise<void> {
  const ver = version ?? (await api.lead(ref)).lead.version;
  await api.assignLead(ref, ver, brokerId);
  usage('lead_assign', true);
  usage('assistant_action_tapped', true, undefined, { action: 'reassign' });
  for (const key of [['leads'], ['lead', ref], ['today'], ['dashboard']]) queries.invalidateQueries({ queryKey: key });
}

export async function nudgeBroker(id: string): Promise<void> {
  await api.nudgeBroker(id);
  usage('assistant_action_tapped', true, undefined, { action: 'nudge_broker' });
}
