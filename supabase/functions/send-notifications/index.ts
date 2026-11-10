// Edge Function: sends queued notifications (push via Expo, SMS via the configured provider).
// Run it every ~10 seconds (pg_cron + pg_net, see PROJECT.md "Operations"), or call it after queuing.
// Secrets (Edge Function env): SUPABASE_SERVICE_ROLE_KEY, EXPO_ACCESS_TOKEN, SMS_PROVIDER (console | msg91),
// SMS_PROVIDER_API_KEY, SMS_SENDER_ID, MSG91_FLOW_IDS (JSON: template → DLT flow id), APP_URL.
// Never logs phone numbers, names or locations.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { type Lang, nextAttempt, render } from '../_shared/templates.ts';

type Row = {
  id: number;
  user_id: string | null;
  phone: string | null;
  channel: 'push' | 'sms';
  template: string;
  payload: Record<string, unknown>;
  attempts: number;
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  {
    auth: { persistSession: false },
  },
);
const APP_URL = Deno.env.get('APP_URL') ?? 'https://plusplus.example';

async function language(userId: string | null): Promise<Lang> {
  if (!userId) return 'en';
  const { data } = await supabase
    .from('profiles')
    .select('language')
    .eq('id', userId)
    .maybeSingle();
  return data?.language === 'kn' ? 'kn' : 'en';
}

async function phoneOf(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const { data } = await supabase.from('profiles').select('phone').eq('id', userId).maybeSingle();
  return data?.phone ?? null;
}

async function sendPush(row: Row, lang: Lang): Promise<boolean> {
  const msg = render(row.template, row.payload, lang, APP_URL);
  if (!msg || !row.user_id) return true; // nothing to send
  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('user_id', row.user_id);
  if (!tokens?.length) return true; // no device registered: in-app polling still delivers SOS alerts
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(Deno.env.get('EXPO_ACCESS_TOKEN')
        ? { Authorization: `Bearer ${Deno.env.get('EXPO_ACCESS_TOKEN')}` }
        : {}),
    },
    body: JSON.stringify(
      tokens.map((t) => ({
        to: t.token,
        title: msg.title,
        body: msg.body,
        priority: msg.priority,
        channelId: msg.channel,
        sound: msg.channel === 'sos' ? 'default' : undefined,
        data: row.payload,
      })),
    ),
  });
  return res.ok;
}

async function sendSms(row: Row): Promise<boolean> {
  const msg = render(row.template, row.payload, 'en', APP_URL);
  const to = row.phone ?? (await phoneOf(row.user_id));
  if (!msg || !to) return true;
  const provider = Deno.env.get('SMS_PROVIDER') ?? 'console';
  if (provider === 'console') {
    console.log(`[sms:console] template=${row.template} id=${row.id}`); // no number, no text
    return true;
  }
  if (provider === 'msg91') {
    const flows = JSON.parse(Deno.env.get('MSG91_FLOW_IDS') ?? '{}') as Record<string, string>;
    const flowId = flows[row.template];
    if (!flowId) return false;
    const res = await fetch('https://control.msg91.com/api/v5/flow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authkey: Deno.env.get('SMS_PROVIDER_API_KEY') ?? '',
      },
      body: JSON.stringify({
        template_id: flowId,
        short_url: '0',
        recipients: [{ mobiles: to.replace('+', ''), body: msg.body }],
      }),
    });
    return res.ok;
  }
  return false;
}

Deno.serve(async () => {
  const { data: rows, error } = await supabase
    .from('notification_outbox')
    .select('id, user_id, phone, channel, template, payload, attempts')
    .eq('status', 'queued')
    .lte('send_after', new Date().toISOString())
    .order('send_after')
    .limit(100);
  if (error) return new Response('error', { status: 500 });

  let sent = 0;
  for (const row of (rows ?? []) as Row[]) {
    const ok =
      row.channel === 'push'
        ? await sendPush(row, await language(row.user_id))
        : await sendSms(row);
    if (ok) {
      await supabase
        .from('notification_outbox')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', row.id);
      sent++;
    } else {
      const next = nextAttempt(row.attempts, row.template, Date.now());
      await supabase
        .from('notification_outbox')
        .update(
          'giveUp' in next
            ? { status: 'failed', attempts: row.attempts + 1 }
            : { attempts: row.attempts + 1, send_after: new Date(next.retryAt).toISOString() },
        )
        .eq('id', row.id);
    }
  }
  return new Response(JSON.stringify({ sent, checked: rows?.length ?? 0 }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
