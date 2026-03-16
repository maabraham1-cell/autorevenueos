import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/turnstile-verify
 * Body: { token: string }
 * Verifies a Cloudflare Turnstile token with the Siteverify API.
 * Returns 200 if valid, 400 if invalid or missing.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.warn('[turnstile-verify] TURNSTILE_SECRET_KEY not set');
    return NextResponse.json(
      { error: 'Turnstile not configured' },
      { status: 503 }
    );
  }

  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Missing or invalid body' },
      { status: 400 }
    );
  }

  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!token) {
    return NextResponse.json(
      { error: 'Missing token' },
      { status: 400 }
    );
  }

  const remoteip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    undefined;

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret,
        response: token,
        ...(remoteip && { remoteip }),
      }),
    });
    const result = (await res.json()) as {
      success?: boolean;
      'error-codes'?: string[];
      message?: string;
    };
    const errorCodes = result['error-codes'] ?? [];

    if (result.success) {
      return NextResponse.json({ success: true });
    }

    // Log so you can see the real reason in Vercel logs
    console.warn('[turnstile-verify] Cloudflare siteverify failed', {
      errorCodes,
      message: result.message,
      httpStatus: res.status,
    });

    // Map common Cloudflare error codes to a clearer message
    const code = errorCodes[0];
    let userMessage = 'Human verification failed. Please try again.';
    if (code === 'missing-input-secret' || code === 'invalid-input-secret') {
      userMessage = 'Verification is misconfigured. Please try again later.';
    } else if (code === 'timeout-or-duplicate') {
      userMessage = 'Verification expired or was already used. Complete the challenge again and submit.';
    } else if (code === 'invalid-input-response') {
      userMessage = 'Verification failed. Complete the challenge again and submit.';
    } else if (code === 'bad-request') {
      userMessage = 'Verification request was invalid. Please try again.';
    }

    return NextResponse.json(
      { error: userMessage, errorCodes },
      { status: 400 }
    );
  } catch (e) {
    console.error('[turnstile-verify] siteverify error:', e);
    return NextResponse.json(
      { error: 'Verification error' },
      { status: 500 }
    );
  }
}
