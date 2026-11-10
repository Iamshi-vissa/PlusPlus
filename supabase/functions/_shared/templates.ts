/**
 * PURE: notification texts (push + SMS) in English and Kannada.
 * Shared by the send-notifications Edge Function and unit tests. No Deno or Node APIs here.
 * SMS in India must use DLT-registered templates: register these exact texts with the SMS provider.
 */
export type Lang = 'en' | 'kn';
export type Rendered = {
  title: string;
  body: string;
  priority: 'high' | 'normal';
  channel: 'sos' | 'default';
};

type Payload = Record<string, unknown>;

const km = (m: unknown) => {
  const n = Number(m);
  return Number.isFinite(n)
    ? n < 1000
      ? `${Math.round(n / 10) * 10} m`
      : `${(n / 1000).toFixed(1)} km`
    : '';
};
const time = (iso: unknown, lang: Lang) =>
  typeof iso === 'string'
    ? new Intl.DateTimeFormat(lang === 'kn' ? 'kn-IN' : 'en-IN', {
        timeZone: 'Asia/Kolkata',
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(iso))
    : '';

const STATUS: Record<string, { en: string; kn: string }> = {
  en_route_to_scene: { en: 'The driver is on the way.', kn: 'ಚಾಲಕರು ಬರುತ್ತಿದ್ದಾರೆ.' },
  picked_up: { en: 'Picked up — going to hospital.', kn: 'ಕರೆದುಕೊಂಡು ಆಸ್ಪತ್ರೆಗೆ ಹೋಗುತ್ತಿದ್ದಾರೆ.' },
  reached_hospital: { en: 'Reached the hospital.', kn: 'ಆಸ್ಪತ್ರೆ ತಲುಪಿದ್ದಾರೆ.' },
  searching: {
    en: 'The driver could not continue. Alerting others now.',
    kn: 'ಚಾಲಕರಿಗೆ ಮುಂದುವರಿಸಲು ಆಗಲಿಲ್ಲ. ಬೇರೆಯವರಿಗೆ ಎಚ್ಚರಿಕೆ ಕಳುಹಿಸಲಾಗುತ್ತಿದೆ.',
  },
};

export function render(
  template: string,
  payload: Payload,
  lang: Lang,
  appUrl: string,
): Rendered | null {
  const kn = lang === 'kn';
  const sos = (title: string, body: string): Rendered => ({
    title,
    body,
    priority: 'high',
    channel: 'sos',
  });
  switch (template) {
    case 'sos_alert':
      return sos(
        kn ? '🚨 ಹತ್ತಿರದಲ್ಲಿ ತುರ್ತು ಸ್ಥಿತಿ' : '🚨 Emergency nearby',
        kn
          ? `${km(payload.distance_m)} ದೂರ. ಸಹಾಯ ಮಾಡಲು ಸಾಧ್ಯವೇ? plusplus ತೆರೆಯಿರಿ.`
          : `${km(payload.distance_m)} away. Can you help? Open plusplus.`,
      );
    case 'sos_alert_sms':
      // bilingual: we can't be sure of the language setting on a phone without the app open
      return sos(
        'plusplus SOS',
        `plusplus: Emergency ${km(payload.distance_m)} away. Open the app to accept. / ${km(payload.distance_m)} ದೂರದಲ್ಲಿ ತುರ್ತು ಸ್ಥಿತಿ. ಒಪ್ಪಿಕೊಳ್ಳಲು ಆ್ಯಪ್ ತೆರೆಯಿರಿ.`,
      );
    case 'sos_filled':
      return {
        title: kn ? 'ಸಹಾಯ ಬರುತ್ತಿದೆ' : 'Help is on the way',
        body: kn ? 'ಬೇರೆಯವರು ಹೋಗುತ್ತಿದ್ದಾರೆ — ಧನ್ಯವಾದಗಳು!' : 'Someone else is going — thank you!',
        priority: 'normal',
        channel: 'default',
      };
    case 'sos_cancelled':
      return {
        title: kn ? 'SOS ರದ್ದಾಗಿದೆ' : 'SOS cancelled',
        body: kn
          ? 'ಈ ತುರ್ತು ಸ್ಥಿತಿ ರದ್ದಾಗಿದೆ. ಧನ್ಯವಾದಗಳು.'
          : 'This emergency was cancelled. Thank you.',
        priority: 'normal',
        channel: 'default',
      };
    case 'sos_assigned':
      return sos(
        kn ? 'ಸಹಾಯ ಬರುತ್ತಿದೆ' : 'Help is on the way',
        kn
          ? 'ಒಬ್ಬ ಸ್ವಯಂಸೇವಕ ಚಾಲಕರು ಬರುತ್ತಿದ್ದಾರೆ. ವಿವರಗಳಿಗೆ plusplus ತೆರೆಯಿರಿ.'
          : 'A volunteer driver is coming. Open plusplus for details.',
      );
    case 'sos_status': {
      const s = STATUS[String(payload.status)];
      return s ? sos('plusplus SOS', kn ? s.kn : s.en) : null;
    }
    case 'sos_no_responder':
      return sos(
        kn ? 'ಈಗ ಚಾಲಕರು ಲಭ್ಯವಿಲ್ಲ' : 'No driver available right now',
        kn ? 'ದಯವಿಟ್ಟು ಈಗಲೇ 108 ಅಥವಾ 112 ಗೆ ಕರೆ ಮಾಡಿ.' : 'Please call 108 or 112 now.',
      );
    case 'sos_contact_sms': {
      const link = `${appUrl.replace(/\/$/, '')}/l/${String(payload.token ?? '')}`;
      const who = String(payload.raiser_name ?? 'Someone');
      return sos(
        'plusplus SOS',
        `plusplus: ${who} raised an emergency SOS. Live location: ${link} . Call 108 if you can help. / ${who} ತುರ್ತು SOS ಕಳುಹಿಸಿದ್ದಾರೆ. ಲೈವ್ ಸ್ಥಳ: ${link}`,
      );
    }
    case 'appointment_reminder_24h':
      return {
        title: kn ? 'ನಾಳೆ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್' : 'Appointment tomorrow',
        body: kn
          ? `${time(payload.starts_at, lang)} — plusplus ತೆರೆಯಿರಿ.`
          : `${time(payload.starts_at, lang)} — open plusplus for details.`,
        priority: 'normal',
        channel: 'default',
      };
    case 'appointment_reminder_1h':
      return {
        title: kn ? '1 ಗಂಟೆಯಲ್ಲಿ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್' : 'Appointment in 1 hour',
        body: kn
          ? `${time(payload.starts_at, lang)}. ಸಮಯಕ್ಕೆ ತಲುಪಿ.`
          : `${time(payload.starts_at, lang)}. Please be on time.`,
        priority: 'normal',
        channel: 'default',
      };
    default:
      return null;
  }
}

/** PURE: retry with back-off; give up after 3 attempts (SOS) or 5 (others). */
export function nextAttempt(
  attempts: number,
  template: string,
  now: number,
): { retryAt: number } | { giveUp: true } {
  const max = template.startsWith('sos_') ? 3 : 5;
  if (attempts + 1 >= max) return { giveUp: true };
  const delay = template.startsWith('sos_') ? 5000 * (attempts + 1) : 60000 * 2 ** attempts;
  return { retryAt: now + delay };
}
