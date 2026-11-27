import React, { useState } from 'react';
import { Share } from 'react-native';
import { ApiClientError } from '@wehdathub/shared';
import { api } from '../api';
import { track } from '../analytics';
import { currentLang } from '../auth';
import { ClientLinkModal } from '../components/ClientLinkModal';
import { toast } from '../components/Toast';
import { t } from '../i18n';
import { clientLang } from '../prefs';
import { timed } from '../usage';

/** "Send to client" from a unit card in the thread: the same link flow as UnitScreen (modal, share sheet, link_shared). */
export function useUnitShare() {
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lang = currentLang();
  const submit = async (to: string) => {
    if (!code) return;
    setBusy(true);
    setError(null);
    try {
      const { url } = await timed('client_link', () => api.unitShareLink(code, clientLang(), to || undefined), { kind: to ? 'to_client' : 'open' });
      setCode(null);
      const shared = await Share.share({ message: url });
      if (shared.action === Share.sharedAction) track('link_shared');
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 422) setError(t(lang, 'badRecipient'));
      else {
        setCode(null);
        toast(t(lang, 'linkFailed'), true);
      }
    } finally {
      setBusy(false);
    }
  };
  const modal = <ClientLinkModal visible={code !== null} busy={busy} error={error} onSubmit={submit} onCancel={() => setCode(null)} />;
  return { open: (c: string) => { setError(null); setCode(c); }, modal };
}
