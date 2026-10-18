# Deploy via GitHub Actions (current method)

Workflow: `.github/workflows/deploy-cloudflare.yml` (runs on push to `main` touching `site/`, or manually).
Needs two repository secrets (GitHub > Settings > Secrets and variables > Actions):
`CLOUDFLARE_API_TOKEN` (template "Edit Cloudflare Workers") and `CLOUDFLARE_ACCOUNT_ID`.
Public values (Tidal client ID, site URL) live in `site/wrangler.jsonc` `vars` and in the workflow env.
The Worker name is `tidal-mcp` -> https://tidal-mcp.nelson-ona.workers.dev. Disable the Git integration of any
other Cloudflare Worker for this repo so only one builder deploys.

---
(Older notes for the dashboard-based method follow.)

# Deploy on Cloudflare Workers (personal Tidal MCP server)

Everything below is done in the Cloudflare / Tidal / Upstash dashboards. Do not paste secrets in chats.

## 1. Tidal developer app
developer.tidal.com/dashboard → Create App. Copy the **Client ID** (no secret needed, PKCE).
Scopes to enable: `user.read search.read playlists.read playlists.write`.
Redirect URI: `https://<YOUR-WORKER-URL>/api/callback` (you get the URL after the first deploy, then add it here).

## 2. Storage
Cloudflare D1 database `tidal-mcp` (already created in your account; bound as `DB` in `site/wrangler.jsonc`). No Upstash needed.

## 3. Cloudflare: Workers & Pages → Create → Import a repository (your fork, branch `feat/playlist-from-list` or `main` after merging)
- Root directory: `site`
- Build command:
  `npm install --no-save @opennextjs/cloudflare@latest wrangler@latest && npx opennextjs-cloudflare build`
- Deploy command: `npx wrangler deploy`
  (the extra packages are installed in the build command so that the committed package-lock.json stays valid)
- Build variables: `NEXT_PUBLIC_SITE_URL=https://<YOUR-WORKER-URL>` (inlined at build time → set it, then redeploy once you know the URL)
- Build variable `NODE_VERSION` = `22`.
- Runtime variables (Settings → Variables and Secrets): `TIDAL_CLIENT_ID`, `NEXT_PUBLIC_SITE_URL`. Optional: `TIDAL_SCOPES`.

## 4. Claude
Settings → Connectors → Add custom connector → `https://<YOUR-WORKER-URL>/api/mcp`, then sign in with Tidal.

## 5. Use
Ask Claude to call `tidal_playlist_from_list` with `dryRun: true` first, review the "notFound" list, then run again without dryRun.

Status: untested on Cloudflare. Known risk: compatibility of `mcp-handler` / Next 16 with the Workers runtime.
