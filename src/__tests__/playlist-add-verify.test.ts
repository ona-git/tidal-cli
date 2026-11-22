import { describe, it, expect, vi } from 'vitest';
import { createPlaylistFromItemsData, addTracksToPlaylistData, missingIds } from '../playlist';
import { writeWithRetry } from '../retry';

const FAST = { paceMs: 0, retryDelayMs: 0, verifyDelayMs: 0 };
const ok = (status = 201) => ({ data: undefined, error: undefined, response: { status, ok: true, headers: { get: () => null } } });
/* what openapi-fetch returns for HTTP 429 with an empty body: no data AND no error */
const rateLimited = () => ({ data: undefined, error: undefined, response: { status: 429, ok: false, headers: { get: () => null } } });

/** Fake Tidal: playlist items are stored, POSTs after `acceptChunks` successful chunks are rejected with an empty 429 (or `failTimes` times only). */
function fakeTidal(opts: { acceptChunks?: number; failTimes?: number } = {}) {
  const stored: string[] = [];
  let chunks = 0;
  let fails = 0;
  const client = {
    POST: vi.fn(async (path: string, init: any) => {
      if (path === '/playlists') return { data: { data: { id: 'pl1', attributes: { name: init.body.data.attributes.name } } }, error: undefined, response: { status: 201, ok: true } };
      if (opts.acceptChunks !== undefined && chunks >= opts.acceptChunks) return rateLimited();
      if (opts.failTimes && fails < opts.failTimes) { fails++; return rateLimited(); }
      chunks++;
      stored.push(...init.body.data.map((d: any) => d.id));
      return ok();
    }),
    GET: vi.fn(async (_path: string, init: any) => {
      const cursor = Number(init.params.query['page[cursor]'] ?? 0);
      const page = stored.slice(cursor, cursor + 20).map((id) => ({ id, type: 'tracks' }));
      const next = cursor + 20 < stored.length ? `/x?page[cursor]=${cursor + 20}` : undefined;
      return { data: { data: page, links: { next } }, error: undefined, response: { status: 200, ok: true } };
    }),
  };
  return { client, stored };
}

const ids = (n: number) => Array.from({ length: n }, (_, i) => `t${i + 1}`);

describe('createPlaylistFromItemsData: real count, not the sent count', () => {
  it('reports 80 of 135 when Tidal silently rejects later chunks with an empty 429 (Brno bug)', async () => {
    const { client, stored } = fakeTidal({ acceptChunks: 4 });
    const r = await createPlaylistFromItemsData('Brno', '', ids(135).map((id) => ({ type: 'tracks' as const, id })), client, 'DE', FAST);
    expect(stored).toHaveLength(80);
    expect(r.tracksAdded).toBe(80);
    expect(r.tracksInPlaylist).toBe(80);
    expect(r.tracksRequested).toBe(135);
    expect(r.missingTrackIds).toEqual(ids(135).slice(80));
    expect(r.failed).toMatch(/81-100.*429/);
  });

  it('retries a rate-limited chunk and gets all 135 in order', async () => {
    const { client, stored } = fakeTidal({ failTimes: 2 });
    const r = await createPlaylistFromItemsData('Brno', '', ids(135).map((id) => ({ type: 'tracks' as const, id })), client, 'DE', FAST);
    expect(stored).toEqual(ids(135));
    expect(r.tracksAdded).toBe(135);
    expect(r.missingTrackIds).toEqual([]);
    expect(r.failed).toBeUndefined();
  });
});

describe('addTracksToPlaylistData', () => {
  it('appends missing tracks to an existing playlist and verifies', async () => {
    const { client, stored } = fakeTidal();
    stored.push(...ids(80));
    const r = await addTracksToPlaylistData('pl1', ids(135).slice(80), client, 'DE', FAST);
    expect(stored).toEqual(ids(135));
    expect(r).toMatchObject({ tracksRequested: 55, tracksAdded: 55, tracksInPlaylist: 135, missingTrackIds: [] });
  });
});

describe('writeWithRetry / missingIds', () => {
  it('treats an empty-body failure as a failure, not a success', async () => {
    const r = await writeWithRetry(async () => rateLimited(), 1, 0);
    expect(r.ok).toBe(false);
    expect(r.status).toBe(429);
  });
  it('does not retry a 400 with a body', async () => {
    const call = vi.fn(async () => ({ error: { errors: [{ code: 'bad' }] }, response: { status: 400, ok: false } }));
    const r = await writeWithRetry(call, 3, 0);
    expect(r.ok).toBe(false);
    expect(call).toHaveBeenCalledTimes(1);
  });
  it('counts duplicates', () => {
    expect(missingIds(['a', 'a', 'b'], ['a'])).toEqual(['a', 'b']);
  });
});
