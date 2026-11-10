'use client';
import { useCallback, useEffect, useState } from 'react';

import { errorText, supabase } from '@/lib/supabase';

type Report = {
  kind: string;
  id: string;
  created_at: string;
  subject_type: string;
  subject_id: string | null;
  reason: string;
  details: string | null;
  status: string;
  reporter_name: string | null;
  reporter_phone: string | null;
};

export default function Reports() {
  const [rows, setRows] = useState<Report[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const load = useCallback(() => {
    supabase()
      .rpc('admin_reports')
      .then(({ data, error }) => {
        setRows((data ?? []) as Report[]);
        setMessage(errorText(error));
      });
  }, []);
  useEffect(load, [load]);

  const resolve = async (id: string, status: 'resolved' | 'dismissed') => {
    const note = window.prompt('Note:') ?? null;
    const { error } = await supabase().rpc('admin_resolve_report', {
      p_id: Number(id),
      p_status: status,
      p_note: note,
    });
    setMessage(errorText(error));
    load();
  };
  const flagUser = async (userId: string) => {
    if (
      !window.confirm(
        'Record a fake SOS for this person? First time = warning, second = 90-day SOS suspension.',
      )
    )
      return;
    const { data, error } = await supabase().rpc('admin_flag_fake_sos', {
      p_user: userId,
      p_note: 'from reports',
    });
    setMessage(error ? errorText(error) : `Result: ${data}`);
    load();
  };

  return (
    <>
      <h1>Reports</h1>
      {message ? <p className="muted">{message}</p> : null}
      {rows.length === 0 ? <p className="muted">No reports.</p> : null}
      <table>
        <thead>
          <tr>
            <th>When</th>
            <th>About</th>
            <th>Reason</th>
            <th>Details</th>
            <th>From</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.kind}-${r.id}`}>
              <td>{new Date(r.created_at).toLocaleString('en-IN')}</td>
              <td>
                {r.subject_type}
                <br />
                <span className="muted">{r.subject_id ?? ''}</span>
              </td>
              <td>{r.reason}</td>
              <td>{r.details ?? ''}</td>
              <td>
                {r.reporter_name ?? '—'}
                <br />
                <span className="muted">{r.reporter_phone ?? ''}</span>
              </td>
              <td>
                {r.kind === 'report' && r.status === 'open' ? (
                  <>
                    <button onClick={() => resolve(r.id, 'resolved')}>Resolve</button>
                    <button className="secondary" onClick={() => resolve(r.id, 'dismissed')}>
                      Dismiss
                    </button>
                  </>
                ) : (
                  <span className="pill">{r.status}</span>
                )}
                {r.subject_type === 'user' && r.subject_id ? (
                  <button className="danger" onClick={() => flagUser(r.subject_id!)}>
                    Fake SOS
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
