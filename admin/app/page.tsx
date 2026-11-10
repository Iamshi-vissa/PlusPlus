'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

type Stats = Record<string, number>;
const CARDS: { key: string; label: string; href: string; warnIfAbove?: number }[] = [
  { key: 'clinics_pending', label: 'Clinics to verify', href: '/clinics', warnIfAbove: 0 },
  { key: 'responders_pending', label: 'Responders to verify', href: '/responders', warnIfAbove: 0 },
  { key: 'doctors_unverified', label: 'Doctors to verify', href: '/doctors', warnIfAbove: 0 },
  { key: 'reports_open', label: 'Open reports', href: '/reports', warnIfAbove: 0 },
  { key: 'sos_active', label: 'Active SOS', href: '/sos', warnIfAbove: 0 },
  { key: 'sos_today', label: 'SOS in last 24 h', href: '/sos' },
  {
    key: 'sos_no_responder_today',
    label: 'SOS with no responder (24 h)',
    href: '/sos',
    warnIfAbove: 0,
  },
  { key: 'responders_available', label: 'Responders available now', href: '/responders' },
];

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    const load = () =>
      supabase()
        .rpc('admin_dashboard')
        .then(({ data }) => setStats(data as Stats));
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, []);
  return (
    <>
      <h1>Dashboard</h1>
      <div className="grid">
        {CARDS.map((c) => (
          <Link
            key={c.key}
            href={c.href}
            className="card"
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <div
              className={`stat ${c.warnIfAbove !== undefined && (stats?.[c.key] ?? 0) > c.warnIfAbove ? 'warn' : ''}`}
              data-testid={c.key}
            >
              {stats ? stats[c.key] : '…'}
            </div>
            <div>{c.label}</div>
          </Link>
        ))}
      </div>
    </>
  );
}
