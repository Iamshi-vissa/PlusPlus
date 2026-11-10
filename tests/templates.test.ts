import { nextAttempt, render } from '../supabase/functions/_shared/templates';

describe('notification templates', () => {
  it('renders an SOS alert in both languages, high priority', () => {
    expect(render('sos_alert', { distance_m: 1240 }, 'en', 'https://x')).toEqual({
      title: '🚨 Emergency nearby',
      body: '1.2 km away. Can you help? Open plusplus.',
      priority: 'high',
      channel: 'sos',
    });
    expect(render('sos_alert', { distance_m: 640 }, 'kn', 'https://x')?.body).toContain('640 m');
  });

  it('gives emergency contacts a bilingual SMS with the live link', () => {
    const sms = render(
      'sos_contact_sms',
      { raiser_name: 'Asha', token: 'abc123' },
      'en',
      'https://plusplus.in/',
    );
    expect(sms?.body).toContain('https://plusplus.in/l/abc123');
    expect(sms?.body).toContain('Asha');
    expect(sms?.body).toContain('ತುರ್ತು');
  });

  it('always points to 108 / 112 when nobody is available', () => {
    expect(render('sos_no_responder', {}, 'en', '')?.body).toBe('Please call 108 or 112 now.');
  });

  it('shows appointment times in India time', () => {
    expect(
      render('appointment_reminder_1h', { starts_at: '2026-11-10T04:30:00Z' }, 'en', '')?.body,
    ).toMatch(/10:00/);
  });

  it('returns null for unknown templates', () => {
    expect(render('nope', {}, 'en', '')).toBeNull();
  });

  it('retries SOS messages fast and gives up after 3 tries', () => {
    expect(nextAttempt(0, 'sos_alert', 0)).toEqual({ retryAt: 5000 });
    expect(nextAttempt(2, 'sos_alert', 0)).toEqual({ giveUp: true });
    expect(nextAttempt(0, 'appointment_reminder_1h', 0)).toEqual({ retryAt: 60000 });
  });
});
