import './globals.css';

import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { AdminGate } from '@/lib/AdminGate';

export const metadata: Metadata = {
  title: 'plusplus admin',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header>
          <strong>plusplus admin</strong>
          <Link href="/">Dashboard</Link>
          <Link href="/clinics">Clinics</Link>
          <Link href="/responders">Responders</Link>
          <Link href="/doctors">Doctors</Link>
          <Link href="/reports">Reports</Link>
          <Link href="/sos">Live SOS</Link>
        </header>
        <main>
          <AdminGate>{children}</AdminGate>
        </main>
      </body>
    </html>
  );
}
