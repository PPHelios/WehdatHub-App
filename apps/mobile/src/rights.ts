import { useQuery } from '@tanstack/react-query';
import type { Rights, Nav } from '@wehdathub/shared';
import { meOptions } from './queries';
import { useAuth } from './auth';

/** Until the server answers, assume a plain broker: the server still refuses anything not allowed. */
const PLAIN: Rights = { addUnits: true, editUnits: true, leads: true, search: true, team: false, owners: false, manager: false, agencyOwner: false, dataEntry: false, teamLead: false };

/** What the signed-in person may do, kept for a day so it also works with no signal. */
export function useRights(): Rights {
  const signedIn = useAuth((s) => s.status === 'signedIn');
  const q = useQuery(meOptions(signedIn));
  return q.data?.rights ?? PLAIN;
}

/** Rights plus whether the first answer has arrived (or failed), so the tab bar is built once, for the right role. */
export function useRightsState(): { rights: Rights; ready: boolean; nav: Nav | undefined } {
  const signedIn = useAuth((s) => s.status === 'signedIn');
  const q = useQuery(meOptions(signedIn));
  return { rights: q.data?.rights ?? PLAIN, ready: !q.isPending, nav: q.data?.nav };
}
