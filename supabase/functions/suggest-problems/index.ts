// Edge Function: matches a patient's own words ("knee pain when climbing stairs") to problem codes
// from the reviewed `problems` table. The app then maps those codes to specialities with the
// doctor-reviewed table, so the model never chooses a speciality or gives medical advice.
//
// Request:  POST { text: string }  with the signed-in user's Authorization header.
// Response: { emergency: boolean, problemCodes: string[] }
//           503 { error: 'not_configured' } when no model key is set (the app carries on without it)
//           429 { error: 'rate_limited' }
//
// Secrets (Edge Function env): ANTHROPIC_API_KEY. Optional: SUGGEST_MODEL (default claude-haiku-5-5).
// Never logs what the user typed.
import Anthropic from 'npm:@anthropic-ai/sdk@1.8.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

import {
  cleanText,
  outputSchema,
  type ProblemOption,
  problemList,
  sanitize,
  SYSTEM_PROMPT,
} from '../_shared/suggest.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
const model = Deno.env.get('SUGGEST_MODEL') ?? 'claude-haiku-5-5';
const anthropic = apiKey ? new Anthropic({ apiKey, timeout: 15_000, maxRetries: 1 }) : null;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'method' });

  const authorization = req.headers.get('Authorization');
  if (!authorization) return json(401, { error: 'auth' });

  // Acts as the signed-in user, so RLS and the per-user rate limit apply.
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });

  let text = '';
  try {
    text = cleanText((await req.json())?.text);
  } catch {
    return json(400, { error: 'body' });
  }
  if (text.length < 3) return json(200, { emergency: false, problemCodes: [] });
  if (!anthropic) return json(503, { error: 'not_configured' });

  const { data: allowed, error: limitError } = await supabase.rpc('ai_suggest_allow');
  if (limitError) return json(401, { error: 'auth' });
  if (!allowed) return json(429, { error: 'rate_limited' });

  const { data: rows, error: loadError } = await supabase
    .from('problems')
    .select('code, name_en, is_red_flag');
  if (loadError || !rows?.length) return json(500, { error: 'load' });
  const problems = rows as ProblemOption[];

  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: 2048,
      system: [
        {
          type: 'text',
          text: `${SYSTEM_PROMPT}\n\nProblem codes:\n${problemList(problems)}`,
          cache_control: { type: 'ephemeral' },
        },
      ],
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: outputSchema(problems.map((p) => p.code)) },
      },
      messages: [{ role: 'user', content: `<patient_text>\n${text}\n</patient_text>` }],
    });

    if (response.stop_reason === 'refusal') return json(200, sanitize({}, problems));
    const block = response.content.find((b) => b.type === 'text');
    const parsed = block && block.type === 'text' ? JSON.parse(block.text) : {};
    return json(200, sanitize(parsed, problems));
  } catch (e) {
    const status = e instanceof Anthropic.APIError ? e.status : undefined;
    console.error('suggest-problems: model call failed', status ?? 'network');
    return json(502, { error: 'model' });
  }
});
