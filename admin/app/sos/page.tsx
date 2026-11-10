'use client';
import { useEffect, useState } from 'react';

import { errorText, supabase } from '@/lib/supabase';

type Sos = {
  id: string;
  status: string;
  created_at: string;
  wave: number;
  radius_m: number;
  alerted: number;
  raiser_name: string | null;
  responder_name: string | null;
  responder_vehicle: string | null;
  district: string | null;
};

export default function LiveSos() {
  const [rows, setRows] = useState<Sos[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const load = () =>
      supabase()
        .rpc('admin_active_sos')
        .then(({ data, error: e }) => {
          setRows((data ?? []) as Sos[]);
          setError(errorText(e));
        });
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);
  return (
    <>
      <h1>Live SOS (last 24 h)</h1>
      <p className="muted">Refreshes every 5 seconds. Exact locations are not shown here.</p>
      {error ? <p className="error">{error}</p> : null}
      {rows.length === 0 ? <p className="muted">No SOS right now.</p> : null}
      <table>
        <thead>
          <tr>
            <th>Started</th>
            <th>District</th>
            <th>Status</th>
            <th>Wave / radius</th>
            <th>Alerted</th>
            <th>Raised by</th>
            <th>Responder</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id} data-testid="sos-row">
              <td>{new Date(s.created_at).toLocaleTimeString('en-IN')}</td>
              <td>{s.district ?? '—'}</td>
              <td>
                <b style={{ color: s.status === 'no_responder' ? 'var(--danger)' : undefined }}>
                  {s.status}
                </b>
              </td>
              <td>
                {s.wave} / {s.radius_m / 1000} km
              </td>
              <td>{s.alerted}</td>
              <td>{s.raiser_name ?? '—'}</td>
              <td>
                {s.responder_name ?? '—'} {s.responder_vehicle ? `(${s.responder_vehicle})` : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
