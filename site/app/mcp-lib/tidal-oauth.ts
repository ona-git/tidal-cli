import crypto from 'crypto';
import { TIDAL_CLIENT_ID, TIDAL_SCOPES, TIDAL_AUTH_URL, TIDAL_TOKEN_URL, SITE_URL } from './constants';

export function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  return { codeVerifier, codeChallenge };
}

export function generateId(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function buildTidalAuthorizationUrl(codeChallenge: string, state: string): string {
  if (!TIDAL_CLIENT_ID) throw new Error('TIDAL_CLIENT_ID environment variable is not set');
  const params = new URLSearchParams({
    client_id: TIDAL_CLIENT_ID,
    response_type: 'code',
    redirect_uri: `${SITE_URL}/api/callback`,
    scope: TIDAL_SCOPES.join(' '),
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
  });
  return `${TIDAL_AUTH_URL}?${params.toString()}`;
}

export interface TidalTokenResponse {
  access_token: string;
  /** Present on the authorization code exchange. Tidal's refresh grant does NOT return a new one. */
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  user?: { userId?: string; countryCode?: string };
}

export async function exchangeTidalCode(code: string, codeVerifier: string): Promise<TidalTokenResponse> {
  const res = await fetch(TIDAL_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: TIDAL_CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${SITE_URL}/api/callback`,
      code_verifier: codeVerifier,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Tidal token exchange failed (${res.status}): ${body}`);
  }

  return res.json();
}

// Refresh the Tidal access token this long before it expires.
export const TIDAL_REFRESH_MARGIN_MS = 5 * 60 * 1000;

/** Tidal answered the token request with an error. status 400/401 means the refresh token is no longer valid. */
export class TidalTokenError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }

  get isInvalidGrant(): boolean {
    return this.status === 400 || this.status === 401;
  }
}

/**
 * Renew stored Tidal tokens. Tidal's refresh response has no refresh_token
 * (developer.tidal.com/documentation/api-sdk/api-sdk-authorization), so the old one is kept;
 * dropping it made the next refresh fail and the connector disconnect.
 */
export async function renewTidalTokens<T extends { accessToken: string; refreshToken: string; expiresAt: number }>(tokens: T): Promise<T> {
  if (!tokens.refreshToken) throw new TidalTokenError('No Tidal refresh token stored', 400);
  const refreshed = await refreshTidalToken(tokens.refreshToken);
  return {
    ...tokens,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token || tokens.refreshToken,
    expiresAt: Date.now() + refreshed.expires_in * 1000,
  };
}

export async function refreshTidalToken(refreshToken: string): Promise<TidalTokenResponse> {
  const res = await fetch(TIDAL_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: TIDAL_CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new TidalTokenError(`Tidal token refresh failed (${res.status}): ${body}`, res.status);
  }

  return res.json();
}
