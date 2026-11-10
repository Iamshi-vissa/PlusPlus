/**
 * Booking through the real API, including two people booking the same slot at the same moment.
 * Needs `pnpm supabase start` (with the sample doctors seeded) — run with `pnpm test:integration`.
 */
import { anon, signIn } from './helpers';

const USER_A = '+919999900001';
const USER_B = '+919999900002';

describe('booking (local Supabase)', () => {
  it('lets exactly one of two simultaneous bookings win', async () => {
    const [a, b] = await Promise.all([signIn(USER_A), signIn(USER_B)]);
    // clear earlier runs so neither user hits the 5-upcoming limit
    for (const c of [a, b]) {
      const { data } = await c
        .from('appointments')
        .select('id')
        .in('status', ['confirmed', 'pending']);
      for (const row of data ?? []) await c.rpc('cancel_appointment', { p_id: row.id });
    }

    const { data: slots } = await anon()
      .from('slots')
      .select('id')
      .eq('status', 'open')
      .gt('starts_at', new Date(Date.now() + 6 * 3600000).toISOString())
      .order('starts_at')
      .limit(1);
    expect(slots).toHaveLength(1);
    const slotId = slots![0].id;

    const results = await Promise.all([
      a.rpc('book_appointment', { p_slot_id: slotId, p_description: 'from A' }),
      b.rpc('book_appointment', { p_slot_id: slotId, p_description: 'from B' }),
    ]);
    const winners = results.filter((r) => !r.error);
    const losers = results.filter((r) => r.error);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect(losers[0].error?.message).toContain('slot_taken');

    // Only the winner sees an appointment for that slot, and the slot is no longer listed as open
    const [{ data: aRows }, { data: bRows }] = await Promise.all([
      a.from('appointments').select('id').eq('slot_id', slotId),
      b.from('appointments').select('id').eq('slot_id', slotId),
    ]);
    expect((aRows?.length ?? 0) + (bRows?.length ?? 0)).toBe(1);
    const { data: stillOpen } = await anon().from('slots').select('id').eq('id', slotId);
    expect(stillOpen).toEqual([]);

    // Cancelling frees the slot for others again
    const winner = winners[0] === results[0] ? a : b;
    const { error } = await winner.rpc('cancel_appointment', { p_id: winners[0].data });
    expect(error).toBeNull();
    const { data: reopened } = await anon().from('slots').select('id').eq('id', slotId);
    expect(reopened).toHaveLength(1);
  });

  it('finds doctors without signing in', async () => {
    const { data, error } = await anon().rpc('find_doctors', {
      p_lat: 12.9716,
      p_lng: 77.5946,
      p_specialities: ['gp', 'family_medicine'],
      p_radius_m: 10000,
    });
    expect(error).toBeNull();
    expect((data as unknown[]).length).toBeGreaterThan(0);
  });
});
