import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthCodeUserId,
  deleteAuthCode,
  saveAccessToken,
  saveRefreshToken,
  getRefreshTokenUserId,
  getTidalTokens,
  saveTidalTokens,
} from '../../mcp-lib/redis';
import { generateId, renewTidalTokens, TidalTokenError, TIDAL_REFRESH_MARGIN_MS } from '../../mcp-lib/tidal-oauth';

export async function POST(req: NextRequest) {
  const body = await req.formData().catch(() => null);
  const params = body
    ? Object.fromEntries(body.entries())
    : await req.json().catch(() => ({}));

  const grantType = params.grant_type as string;

  if (grantType === 'authorization_code') {
    return handleAuthorizationCode(params);
  } else if (grantType === 'refresh_token') {
    return handleRefreshToken(params);
  }

  return NextResponse.json(
    { error: 'unsupported_grant_type' },
    { status: 400 },
  );
}

async function handleAuthorizationCode(params: Record<string, any>) {
  const code = params.code as string;
  if (!code) {
    return NextResponse.json({ error: 'invalid_request', error_description: 'Missing code' }, { status: 400 });
  }

  const userId = await getAuthCodeUserId(code);
  if (!userId) {
    return NextResponse.json({ error: 'invalid_grant', error_description: 'Invalid or expired code' }, { status: 400 });
  }

  await deleteAuthCode(code);

  // Generate MCP access and refresh tokens
  const accessToken = generateId();
  const refreshToken = generateId();

  await saveAccessToken(accessToken, userId);
  await saveRefreshToken(refreshToken, userId);

  return NextResponse.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 86400,
    refresh_token: refreshToken,
  }, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

async function handleRefreshToken(params: Record<string, any>) {
  const refreshTokenValue = params.refresh_token as string;
  if (!refreshTokenValue) {
    return NextResponse.json({ error: 'invalid_request', error_description: 'Missing refresh_token' }, { status: 400 });
  }

  const userId = await getRefreshTokenUserId(refreshTokenValue);
  if (!userId) {
    return NextResponse.json({ error: 'invalid_grant', error_description: 'Invalid or expired refresh token' }, { status: 400 });
  }

  // Check if Tidal tokens need refresh
  const tidalTokens = await getTidalTokens(userId);
  if (!tidalTokens) {
    return NextResponse.json({ error: 'invalid_grant', error_description: 'No Tidal session' }, { status: 400 });
  }
  if (tidalTokens.expiresAt < Date.now() + TIDAL_REFRESH_MARGIN_MS) {
    try {
      await saveTidalTokens(userId, await renewTidalTokens(tidalTokens));
    } catch (err) {
      // Only a rejected refresh token means the user must sign in again; anything else is temporary.
      if (err instanceof TidalTokenError && err.isInvalidGrant) {
        return NextResponse.json({ error: 'invalid_grant', error_description: 'Tidal session expired' }, { status: 400 });
      }
      return NextResponse.json({ error: 'server_error', error_description: 'Tidal is unreachable, try again' }, { status: 503 });
    }
  }

  // Issue new MCP tokens
  const newAccessToken = generateId();
  const newRefreshToken = generateId();

  await saveAccessToken(newAccessToken, userId);
  await saveRefreshToken(newRefreshToken, userId);

  return NextResponse.json({
    access_token: newAccessToken,
    token_type: 'Bearer',
    expires_in: 86400,
    refresh_token: newRefreshToken,
  }, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

// Support CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
