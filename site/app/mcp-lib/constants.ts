// Shared constants from the CLI auth module
// Client ID of YOUR Tidal developer app (developer.tidal.com/dashboard). Set TIDAL_CLIENT_ID in Vercel.
export const TIDAL_CLIENT_ID = process.env.TIDAL_CLIENT_ID || '';

// Minimal scopes for searching and managing playlists. Override with TIDAL_SCOPES (space separated)
// if you want more tools to work (e.g. add "collection.read collection.write").
// The scopes must also be enabled on your Tidal developer app.
export const TIDAL_SCOPES = (process.env.TIDAL_SCOPES || 'user.read search.read playlists.read playlists.write')
  .split(/\s+/)
  .filter(Boolean);

export const TIDAL_AUTH_URL = 'https://login.tidal.com/authorize';
export const TIDAL_TOKEN_URL = 'https://auth.tidal.com/v1/oauth2/token';

// Public URL of YOUR deployment (e.g. https://my-tidal.vercel.app). No fallback to a third-party domain on purpose.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '');

// Claude MCP callback URLs to allowlist
export const ALLOWED_REDIRECT_URIS = [
  'https://claude.ai/api/mcp/auth_callback',
  'https://claude.com/api/mcp/auth_callback',
  'http://localhost:6274/oauth/callback',
  'http://localhost:6274/oauth/callback/debug',
];
