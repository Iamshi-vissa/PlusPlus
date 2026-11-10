import { router } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { getMyResponder } from '@/features/responder/api';
import { registerForPush } from '@/lib/push';

import { pendingAlerts } from './api';

const POLL_MS = 4000;
const RECHECK_RESPONDER_MS = 60000;

/**
 * While a verified responder is available, checks for new SOS alerts and opens the alert screen.
 * Push notifications are the fast path in real builds; this keeps alerts working in Expo Go
 * and whenever push is not configured.
 */
export function AlertWatcher() {
  const { session } = useAuth();
  const shown = useRef(new Set<string>());

  useEffect(() => {
    if (!session) return;
    void registerForPush(session.user.id);
    let available = false;
    let stopped = false;
    const check = async () => {
      try {
        available = (await getMyResponder())?.is_available ?? false;
      } catch {
        // keep previous value
      }
    };
    void check();
    const recheck = setInterval(check, RECHECK_RESPONDER_MS);
    const poll = setInterval(async () => {
      if (!available || stopped) return;
      const alerts = await pendingAlerts();
      const fresh = alerts.find((a) => !shown.current.has(a.sos_id));
      if (fresh) {
        shown.current.add(fresh.sos_id);
        router.push({ pathname: '/responder/incoming/[id]', params: { id: fresh.sos_id } });
      }
    }, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(recheck);
      clearInterval(poll);
    };
  }, [session]);

  return null;
}
