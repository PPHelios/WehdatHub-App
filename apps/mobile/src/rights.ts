import { useQuery } from '@tanstack/react-query';
import type { ApiWorkspace, Rights, Nav } from '@wehdathub/shared';
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

/** Rights plus server-driven nav, workspace, and invite roles so screens can adapt per tier cleanly. */
export function useRightsState(): {
  rights: Rights;
  ready: boolean;
  nav: Nav | undefined;
  workspace: ApiWorkspace | null | undefined;
  inviteRoles: string[] | undefined;
} {
  const signedIn = useAuth((s) => s.status === 'signedIn');
  const q = useQuery(meOptions(signedIn));
  return {
    rights: q.data?.rights ?? PLAIN,
    ready: !q.isPending,
    nav: q.data?.nav,
    workspace: q.data?.workspace,
    inviteRoles: q.data?.inviteRoles,
  };
}

/** Whether a server-driven nav destination app name is enabled for this workspace and role. */
export function hasNavApp(nav: Nav | undefined, app: string): boolean {
  if (!nav) return false;
  return nav.tabs.some((item) => item.app === app) || nav.groups.some((g) => g.items.some((item) => item.app === app));
}
