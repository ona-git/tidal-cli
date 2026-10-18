import { getCloudflareContext } from '@opennextjs/cloudflare';

// Storage on Cloudflare D1 (binding "DB", see wrangler.jsonc). Same API as the former Upstash version:
// a tiny key/value table with expiry. D1 is strongly consistent, so a value written in one request
// is readable in the next one (important for the OAuth code exchange).
// Table (also created lazily below): kv(key TEXT PRIMARY KEY, value TEXT, expires_at INTEGER ms)

let ready = false;

async function db(): Promise<any> {
  const { env } = await getCloudflareContext({ async: true });
  const d1 = (env as any).DB;
  if (!d1) throw new Error('D1 binding "DB" is missing (check wrangler.jsonc)');
  if (!ready) {
    await d1.prepare('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL, expires_at INTEGER NOT NULL)').run();
    ready = true;
  }
  return d1;
}

async function kvSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  const d1 = await db();
  await d1
    .prepare('INSERT INTO kv (key, value, expires_at) VALUES (?1, ?2, ?3) ON CONFLICT(key) DO UPDATE SET value = ?2, expires_at = ?3')
    .bind(key, value, Date.now() + ttlSeconds * 1000)
    .run();
  // Opportunistic cleanup of expired rows.
  await d1.prepare('DELETE FROM kv WHERE expires_at < ?1').bind(Date.now()).run();
}

async function kvGet(key: string): Promise<string | null> {
  const d1 = await db();
  const row = await d1.prepare('SELECT value, expires_at FROM kv WHERE key = ?1').bind(key).first();
  if (!row || row.expires_at < Date.now()) return null;
  return row.value as string;
}

async function kvDel(key: string): Promise<void> {
  const d1 = await db();
  await d1.prepare('DELETE FROM kv WHERE key = ?1').bind(key).run();
}

// OAuth session (temporary, during auth flow)
export interface OAuthSession {
  redirectUri: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  tidalCodeVerifier: string;
  tidalState: string;
}

export async function saveOAuthSession(sessionId: string, session: OAuthSession): Promise<void> {
  await kvSet(`session:${sessionId}`, JSON.stringify(session), 600); // 10 min TTL
}

export async function getOAuthSession(sessionId: string): Promise<OAuthSession | null> {
  const data = await kvGet(`session:${sessionId}`);
  return data ? JSON.parse(data) : null;
}

export async function deleteOAuthSession(sessionId: string): Promise<void> {
  await kvDel(`session:${sessionId}`);
}

// Auth code → user mapping (temporary)
export async function saveAuthCode(code: string, userId: string): Promise<void> {
  await kvSet(`auth_code:${code}`, userId, 300); // 5 min TTL
}

export async function getAuthCodeUserId(code: string): Promise<string | null> {
  return kvGet(`auth_code:${code}`);
}

export async function deleteAuthCode(code: string): Promise<void> {
  await kvDel(`auth_code:${code}`);
}

// Tidal tokens per user (long-lived)
export interface TidalTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  countryCode?: string;
  userId?: string;
}

export async function saveTidalTokens(userId: string, tokens: TidalTokens): Promise<void> {
  await kvSet(`user:${userId}:tidal`, JSON.stringify(tokens), 2592000); // 30 days TTL
}

export async function getTidalTokens(userId: string): Promise<TidalTokens | null> {
  const data = await kvGet(`user:${userId}:tidal`);
  return data ? JSON.parse(data) : null;
}

// MCP access token → user mapping
export async function saveAccessToken(token: string, userId: string): Promise<void> {
  await kvSet(`mcp_token:${token}`, userId, 86400); // 24h TTL
}

export async function getAccessTokenUserId(token: string): Promise<string | null> {
  return kvGet(`mcp_token:${token}`);
}

// MCP refresh token → user mapping
export async function saveRefreshToken(token: string, userId: string): Promise<void> {
  await kvSet(`refresh:${token}`, userId, 2592000); // 30 days TTL
}

export async function getRefreshTokenUserId(token: string): Promise<string | null> {
  return kvGet(`refresh:${token}`);
}
