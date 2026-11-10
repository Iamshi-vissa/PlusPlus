'use client';
import { useCallback, useEffect, useState } from 'react';

import { errorText, supabase } from '@/lib/supabase';

type Doctor = {
  id: string;
  name: string;
  specialities: string[];
  qualifications: string;
  years_experience: number;
  fee: number;
  nmc_registration_no: string | null;
  place_name: string;
  created_at: string;
};

export default function Doctors() {
  const [rows, setRows] = useState<Doctor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    supabase()
      .rpc('admin_unverified_doctors')
      .then(({ data, error: e }) => {
        setRows((data ?? []) as Doctor[]);
        setError(errorText(e));
      });
  }, []);
  useEffect(load, [load]);
  const decide = async (id: string, ok: boolean) => {
    const { error: e } = await supabase().rpc('admin_verify_doctor', { p_id: id, p_verified: ok });
    setError(errorText(e));
    load();
  };
  return (
    <>
      <h1>Doctors to verify</h1>
      <p className="muted">
        Check the registration number on the National Medical Commission / Karnataka Medical Council
        register before verifying.
      </p>
      {error ? <p className="error">{error}</p> : null}
      {rows.length === 0 ? <p className="muted">Nothing to verify.</p> : null}
      <table>
        <tbody>
          {rows.map((d) => (
            <tr key={d.id} data-testid="doctor-row">
              <td>
                <b>{d.name}</b>
                <br />
                <span className="muted">{d.place_name}</span>
              </td>
              <td>
                {d.qualifications}
                <br />
                {d.specialities.join(', ')}
              </td>
              <td>
                {d.years_experience} yrs · ₹{d.fee}
              </td>
              <td>
                Reg. <b>{d.nmc_registration_no ?? '— missing —'}</b>
              </td>
              <td>
                <button onClick={() => decide(d.id, true)}>Verify</button>
                <button className="danger" onClick={() => decide(d.id, false)}>
                  Reject
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
