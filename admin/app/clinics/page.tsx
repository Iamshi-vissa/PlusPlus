'use client';
import { useCallback, useEffect, useState } from 'react';

import { errorText, signedUrl, supabase } from '@/lib/supabase';

type App = {
  id: string;
  name: string;
  type: string;
  address: string;
  phone: string;
  registration_no: string;
  hfr_facility_id: string | null;
  document_path: string | null;
  status: string;
  reviewer_note: string | null;
  created_at: string;
  applicant_name: string | null;
  applicant_phone: string | null;
  lat: number;
  lng: number;
  district: string | null;
};

export default function Clinics() {
  const [status, setStatus] = useState('pending');
  const [rows, setRows] = useState<App[]>([]);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    supabase()
      .rpc('admin_clinic_applications', { p_status: status })
      .then(({ data, error: e }) => {
        setRows((data ?? []) as App[]);
        setError(errorText(e));
      });
  }, [status]);
  useEffect(load, [load]);

  const review = async (id: string, approve: boolean) => {
    const note =
      window.prompt(approve ? 'Note (what you checked):' : 'Reason (shown to the clinic):') ?? null;
    if (!approve && !note) return;
    const { error: e } = await supabase().rpc('review_clinic_application', {
      p_id: id,
      p_approve: approve,
      p_note: note,
    });
    setError(errorText(e));
    load();
  };

  return (
    <>
      <h1>Clinic applications</h1>
      <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: 220 }}>
        <option value="pending">Pending</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
      </select>
      {error ? <p className="error">{error}</p> : null}
      {rows.length === 0 ? <p className="muted">Nothing here.</p> : null}
      {rows.map((a) => (
        <div key={a.id} className="card" data-testid="clinic-app">
          <h3>
            {a.name} <span className="pill">{a.type}</span>
          </h3>
          <p>
            {a.address} · {a.district ?? '—'} ·{' '}
            <a
              href={`https://www.google.com/maps?q=${a.lat},${a.lng}`}
              target="_blank"
              rel="noreferrer"
            >
              map
            </a>
          </p>
          <p>
            Clinic phone {a.phone} · KPME reg. <b>{a.registration_no}</b>
            {a.hfr_facility_id ? ` · HFR ${a.hfr_facility_id}` : ''}
          </p>
          <p className="muted">
            Applicant: {a.applicant_name ?? '—'} ({a.applicant_phone ?? '—'}) ·{' '}
            {new Date(a.created_at).toLocaleString('en-IN')}
          </p>
          <DocButton path={a.document_path} />
          {a.status === 'pending' ? (
            <div>
              <button onClick={() => review(a.id, true)} data-testid="approve-clinic">
                Approve
              </button>
              <button className="danger" onClick={() => review(a.id, false)}>
                Reject
              </button>
            </div>
          ) : (
            <p>
              Status: {a.status}
              {a.reviewer_note ? ` — ${a.reviewer_note}` : ''}
            </p>
          )}
        </div>
      ))}
    </>
  );
}

function DocButton({ path }: { path: string | null }) {
  if (!path) return <p className="error">No certificate uploaded.</p>;
  return (
    <button
      className="secondary"
      onClick={async () => {
        const url = await signedUrl('clinic-docs', path);
        if (url) window.open(url, '_blank', 'noopener');
      }}
    >
      View registration certificate
    </button>
  );
}
