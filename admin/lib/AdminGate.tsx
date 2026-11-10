'use client';
import type { Session } from '@supabase/supabase-js';
import { type ReactNode, useEffect, useState } from 'react';

import { supabase } from './supabase';

/** Shows the page only to signed-in platform admins; otherwise the phone sign-in form. */
export function AdminGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    const sb = supabase();
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    supabase()
      .rpc('is_platform_admin')
      .then(({ data }) => setIsAdmin(data === true));
  }, [session]);

  if (session === undefined) return null;
  if (!session) return <SignIn />;
  if (isAdmin === null) return <p>Checking access…</p>;
  if (!isAdmin) {
    return (
      <div className="card">
        <h2>No admin access</h2>
        <p>This account is not a plusplus platform admin.</p>
        <button onClick={() => supabase().auth.signOut()}>Sign out</button>
      </div>
    );
  }
  return <>{children}</>;
}

function SignIn() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const e164 = () => `+91${phone.replace(/\D/g, '').slice(-10)}`;

  return (
    <div className="card narrow">
      <h2>plusplus admin — sign in</h2>
      {!sent ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const { error: err } = await supabase().auth.signInWithOtp({ phone: e164() });
            if (err?.code === 'over_sms_send_rate_limit' || err?.status === 429) {
              // a code was sent less than a minute ago: let them type that one
              setSent(true);
              setError('A code was sent recently — enter it below.');
            } else if (err) setError('Could not send the code.');
            else {
              setSent(true);
              setError(null);
            }
          }}
        >
          <label>
            Mobile number
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              autoComplete="tel"
              required
            />
          </label>
          <button type="submit">Send code</button>
        </form>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const { error: err } = await supabase().auth.verifyOtp({
              phone: e164(),
              token: code.trim(),
              type: 'sms',
            });
            if (err) setError('Wrong or expired code.');
          }}
        >
          <label>
            6-digit code
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              required
            />
          </label>
          <button type="submit">Sign in</button>
        </form>
      )}
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
