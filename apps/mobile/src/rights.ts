import { useQuery } from '@tanstack/react-query';
import type { Rights } from '@wehdathub/shared';
import { api } from './api';
import { useAuth } from './auth';

/** Until the server answers, assume a plain broker: the server still refuses anything not allowed. */
const PLAIN: Rights = { addUnits: true, editUnits: true, leads: true, search: true, team: false, owners: false, manager: false, agencyOwner: false, dataEntry: false, teamLead: false };

/** What the signed-in person may do, kept for a day so it also works with no signal. */
export function useRights(): Rights {
  const signedIn = useAuth((s) => s.status === 'signedIn');
  const q = useQuery({ queryKey: ['me'], queryFn: () => api.me(), enabled: signedIn, staleTime: 5 * 60_000 });
  return q.data?.rights ?? PLAIN;
}
