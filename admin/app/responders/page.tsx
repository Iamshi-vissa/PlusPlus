'use client';
import { useCallback, useEffect, useState } from 'react';

import { errorText, signedUrl, supabase } from '@/lib/supabase';

type Responder = {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  vehicle_type: string;
  vehicle_number: string;
  licence_number: string;
  licence_doc_path: string;
  rc_doc_path: string;
  vehicle_photo_path: string;
  selfie_path: string;
  verification_status: string;
  reviewer_note: string | null;
  created_at: string;
  alerts_received: number;
  alerts_accepted: number;
  no_shows: number;
  helped_count: number;
};
const DOCS: [keyof Responder, string][] = [
  ['licence_doc_path', 'Licence'],
  ['rc_doc_path', 'RC'],
  ['vehicle_photo_path', 'Vehicle'],
  ['selfie_path', 'Selfie'],
];

export default function Responders() {
  const [status, setStatus] = useState('pending');
  const [rows, setRows] = useState<Responder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    supabase()
      .rpc('admin_responders', { p_status: status })
      .then(({ data, error: e }) => {
        setRows((data ?? []) as Responder[]);
        setError(errorText(e));
      });
  }, [status]);
  useEffect(load, [load]);

  const review = async (id: string, next: string) => {
    const note =
      window.prompt(
        next === 'verified' ? 'Note (what you checked):' : 'Reason (shown to the driver):',
      ) ?? null;
    if (next !== 'verified' && !note) return;
    const { error: e } = await supabase().rpc('review_responder', {
      p_user_id: id,
      p_status: next,
      p_note: note,
    });
    setError(errorText(e));
    load();
  };

  return (
    <>
      <h1>Responders</h1>
      <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: 220 }}>
        <option value="pending">Pending</option>
        <option value="verified">Verified</option>
        <option value="rejected">Rejected</option>
        <option value="suspended">Suspended</option>
      </select>
      {error ? <p className="error">{error}</p> : null}
      {rows.length === 0 ? <p className="muted">Nothing here.</p> : null}
      {rows.map((r) => (
        <div key={r.user_id} className="card" data-testid="responder-row">
          <h3>
            {r.full_name ?? '—'}{' '}
            <span className="pill">{r.vehicle_type === 'four_wheeler' ? 'Car' : 'Auto'}</span>
          </h3>
          <p>
            Vehicle <b>{r.vehicle_number}</b> · Licence <b>{r.licence_number}</b> · Phone{' '}
            {r.phone ?? '—'}
          </p>
          <p className="muted">
            Applied {new Date(r.created_at).toLocaleString('en-IN')} · alerts {r.alerts_received} ·
            accepted {r.alerts_accepted} · no-shows {r.no_shows} · helped {r.helped_count}
          </p>
          <p className="docs">
            {DOCS.map(([key, label]) => (
              <button
                key={key}
                className="secondary"
                onClick={async () => {
                  const url = await signedUrl('responder-docs', r[key] as string);
                  if (url) window.open(url, '_blank', 'noopener');
                }}
              >
                {label}
              </button>
            ))}
          </p>
          <p className="muted">
            Check: name on licence matches the selfie; RC vehicle number matches; licence is valid
            for the vehicle class.
          </p>
          {r.verification_status === 'pending' || r.verification_status === 'rejected' ? (
            <>
              <button onClick={() => review(r.user_id, 'verified')} data-testid="verify-responder">
                Verify
              </button>
              <button className="danger" onClick={() => review(r.user_id, 'rejected')}>
                Reject
              </button>
            </>
          ) : r.verification_status === 'verified' ? (
            <button className="danger" onClick={() => review(r.user_id, 'suspended')}>
              Suspend
            </button>
          ) : (
            <button className="secondary" onClick={() => review(r.user_id, 'verified')}>
              Re-activate
            </button>
          )}
          {r.reviewer_note ? <p className="muted">Note: {r.reviewer_note}</p> : null}
        </div>
      ))}
    </>
  );
}
