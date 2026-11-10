/**
 * SOS end to end through the real API, with separate signed-in people:
 * raiser → wave → two responders accept at the same moment (exactly one wins) → live status →
 * pickup → hospital → closed; then "no responder found".
 * Needs `pnpm supabase start`; run with `pnpm test:integration`.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { admin, signIn, userId } from './helpers';

const RAISER = '+919999900005';
const RESPONDER_A = '+919999900003';
const RESPONDER_B = '+919999900004';
const P = { lat: 12.9716, lng: 77.5946 }; // MG Road, Bengaluru

async function makeResponder(
  id: string,
  metresNorth: number,
  vehicle: 'three_wheeler' | 'four_wheeler',
) {
  const { error } = await admin()
    .from('responders')
    .upsert({
      user_id: id,
      vehicle_type: vehicle,
      vehicle_number: vehicle === 'three_wheeler' ? 'KA01AB9003' : 'KA01AB9004',
      licence_number: `KA0120230009${vehicle === 'three_wheeler' ? '003' : '004'}`,
      licence_doc_path: `${id}/l.jpg`,
      rc_doc_path: `${id}/r.jpg`,
      vehicle_photo_path: `${id}/v.jpg`,
      selfie_path: `${id}/s.jpg`,
      verification_status: 'verified',
      guide_completed_at: new Date().toISOString(),
      is_available: true,
      last_location: `SRID=4326;POINT(${P.lng} ${P.lat + metresNorth / 111320})`,
      last_seen_at: new Date().toISOString(),
      alerts_received: 0,
      alerts_accepted: 0,
      no_shows: 0,
    });
  if (error) throw error;
}

describe('SOS end to end (local Supabase)', () => {
  let raiser: SupabaseClient;
  let a: SupabaseClient;
  let b: SupabaseClient;
  let ids: { raiser: string; a: string; b: string };

  beforeAll(async () => {
    [raiser, a, b] = await Promise.all([signIn(RAISER), signIn(RESPONDER_A), signIn(RESPONDER_B)]);
    ids = { raiser: await userId(raiser), a: await userId(a), b: await userId(b) };
    const svc = admin();
    // fresh start: earlier runs' SOS (and the hourly limit), other responders out of the way
    await svc.from('sos_requests').delete().eq('raised_by', ids.raiser);
    await svc
      .from('sos_requests')
      .update({ status: 'closed' })
      .in('assigned_responder', [ids.a, ids.b]);
    await svc
      .from('responders')
      .update({ is_available: false })
      .not('user_id', 'in', `(${ids.a},${ids.b})`);
    await makeResponder(ids.a, 400, 'three_wheeler');
    await makeResponder(ids.b, 700, 'four_wheeler');
  });

  afterAll(async () => {
    await admin().from('responders').update({ is_available: false }).in('user_id', [ids.a, ids.b]);
  });

  it('runs the whole flow, and only one of two simultaneous accepts wins', async () => {
    const { data: sosId, error } = await raiser.rpc('sos_create', {
      p_lat: P.lat,
      p_lng: P.lng,
      p_injured_count: 1,
      p_is_conscious: true,
    });
    expect(error).toBeNull();

    // both responders were alerted (only 2 in range, so the radius widened to 8 km)
    const [{ data: alertsA }, { data: alertsB }] = await Promise.all([
      a.rpc('my_pending_alerts'),
      b.rpc('my_pending_alerts'),
    ]);
    expect((alertsA as { sos_id: string }[]).map((x) => x.sos_id)).toContain(sosId);
    expect((alertsB as { sos_id: string }[]).map((x) => x.sos_id)).toContain(sosId);

    // before accepting: no exact pickup point
    const { data: before } = await a.rpc('sos_for_responder', { p_sos: sosId });
    expect(before.pickup).toBeNull();

    // two responders tap Accept at the same moment
    const [ra, rb] = await Promise.all([
      a.rpc('sos_accept', { p_sos: sosId }),
      b.rpc('sos_accept', { p_sos: sosId }),
    ]);
    expect(ra.error).toBeNull();
    expect(rb.error).toBeNull();
    expect([ra.data, rb.data].filter((won) => won === true)).toHaveLength(1);
    const winner = ra.data ? a : b;
    const loser = ra.data ? b : a;

    // raiser sees who is coming, with a live location
    const { data: status } = await raiser.rpc('sos_status', { p_sos: sosId });
    expect(status.status).toBe('assigned');
    expect(status.responder.vehicle_number).toMatch(/^KA01AB900[34]$/);
    expect(typeof status.responder.lat).toBe('number');

    // the winner sees the pickup point; the other does not
    const { data: mine } = await winner.rpc('sos_for_responder', { p_sos: sosId });
    expect(mine.pickup.lat).toBeCloseTo(P.lat, 4);
    const { data: theirs } = await loser.rpc('sos_for_responder', { p_sos: sosId });
    expect(theirs.pickup).toBeNull();
    expect(theirs.my_response).toBe('too_late');

    // nobody else can read the SOS
    const { data: snoop } = await loser.rpc('sos_status', { p_sos: sosId });
    expect(snoop).toBeNull();

    // on the way → picked up → hospital → closed
    for (const s of ['en_route_to_scene', 'picked_up', 'reached_hospital', 'closed']) {
      const { error: e } = await winner.rpc('sos_set_status', { p_sos: sosId, p_status: s });
      expect(e).toBeNull();
    }
    const { data: done } = await raiser.rpc('sos_status', { p_sos: sosId });
    expect(done.status).toBe('closed');
  });

  it('tells the raiser honestly when no responder is available', async () => {
    await admin().from('responders').update({ is_available: false }).in('user_id', [ids.a, ids.b]);
    const { data: sosId, error } = await raiser.rpc('sos_create', { p_lat: P.lat, p_lng: P.lng });
    expect(error).toBeNull();
    const { data: status } = await raiser.rpc('sos_status', { p_sos: sosId });
    expect(status.status).toBe('no_responder');
    expect(status.radius_m).toBe(8000);
  });
});
