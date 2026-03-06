// api/chat.js
// Serverless proxy: receives requests from Ensemble frontend,
// attaches the Anthropic API key from env vars, and streams back.

export const config = { runtime: 'edge' };

const ALLOWED_ORIGIN = 'https://noor2-boop-2025.github.io';

export default async function handler(req) {
  const origin = req.headers.get('origin') || '';

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(origin)
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Block requests from unknown origins
  if (origin !== ALLOWED_ORIGIN) {
    return new Response('Forbidden', { status: 403 });
  }

  try {
    const body = await req.json();

    // Forward to Anthropic — key comes from Vercel env var, never from client
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    });

    if (!anthropicRes.ok) {
      const err = await anthropicRes.text();
      return new Response(`Anthropic error: ${err}`, {
        status: anthropicRes.status,
        headers: corsHeaders(origin)
      });
    }

    // Stream the response directly back to the client
    return new Response(anthropicRes.body, {
      headers: {
        ...corsHeaders(origin),
        'Content-Type': anthropicRes.headers.get('Content-Type') || 'text/event-stream',
        'Cache-Control': 'no-cache'
      }
    });

  } catch (err) {
    console.error(err);
    return new Response(`Proxy error: ${err.message}`, {
      status: 500,
      headers: corsHeaders(origin)
    });
  }
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}
