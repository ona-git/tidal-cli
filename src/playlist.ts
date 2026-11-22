import { getApiClient, getCountryCode } from './auth';
import { fetchAllPages } from './pagination';
import { getWithRetry, writeWithRetry, sleep } from './retry';
import type { PlaylistInfo } from './types';
export type { PlaylistInfo };

export async function listPlaylistsData(client: any, countryCode: string): Promise<PlaylistInfo[]> {
  const { data } = await fetchAllPages(client, '/playlists', {
    query: {
      'filter[owners.id]': ['me'],
      countryCode,
    },
  });

  return data.map((p: any) => ({
    id: p.id,
    name: p.attributes?.name ?? 'Untitled',
    description: p.attributes?.description,
    numberOfItems: p.attributes?.numberOfItems,
    createdAt: p.attributes?.createdAt,
    lastModifiedAt: p.attributes?.lastModifiedAt,
  }));
}

export async function listPlaylists(json: boolean): Promise<void> {
  const client = await getApiClient();
  const countryCode = await getCountryCode();

  try {
    const playlists = await listPlaylistsData(client, countryCode);

    if (json) {
      console.log(JSON.stringify(playlists, null, 2));
      return;
    }

    if (playlists.length === 0) {
      console.log('No playlists found.');
      return;
    }

    console.log('\nYour playlists:\n');
    for (const p of playlists) {
      console.log(`  [${p.id}] ${p.name} (${p.numberOfItems ?? 0} tracks)`);
      if (p.description) console.log(`    ${p.description}`);
    }
    console.log();
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

export async function createPlaylistData(name: string, description: string, client: any): Promise<{ id: string; name: string; description: string }> {
  const { data, error } = await client.POST('/playlists', {
    body: {
      data: {
        type: 'playlists',
        attributes: {
          name,
          description,
          accessType: 'UNLISTED',
        },
      },
    } as any,
  });

  if (error || !data) {
    throw new Error(`Failed to create playlist — ${JSON.stringify(error)}`);
  }

  const created = (data as any).data;
  return {
    id: created.id,
    name: created.attributes?.name ?? name,
    description: created.attributes?.description ?? description,
  };
}

export async function createPlaylist(name: string, description: string, json: boolean): Promise<void> {
  const client = await getApiClient();

  try {
    const result = await createPlaylistData(name, description, client);

    if (json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(`\nPlaylist created: [${result.id}] ${result.name}`);
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

export async function renamePlaylistData(playlistId: string, name: string, client: any): Promise<{ id: string; name: string; success: boolean }> {
  const { error } = await client.PATCH('/playlists/{id}', {
    params: { path: { id: playlistId } },
    body: {
      data: {
        type: 'playlists',
        id: playlistId,
        attributes: { name },
      },
    } as any,
  });

  if (error) {
    throw new Error(`Failed to rename playlist — ${JSON.stringify(error)}`);
  }

  return { id: playlistId, name, success: true };
}

export async function renamePlaylist(playlistId: string, name: string, json: boolean): Promise<void> {
  const client = await getApiClient();

  try {
    const result = await renamePlaylistData(playlistId, name, client);

    if (json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(`\nPlaylist ${playlistId} renamed to "${name}".`);
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

export async function deletePlaylistData(playlistId: string, client: any): Promise<{ id: string; deleted: boolean }> {
  const { error } = await client.DELETE('/playlists/{id}', {
    params: { path: { id: playlistId } },
  });

  if (error) {
    throw new Error(`Failed to delete playlist — ${JSON.stringify(error)}`);
  }

  return { id: playlistId, deleted: true };
}

export async function deletePlaylist(playlistId: string, json: boolean): Promise<void> {
  const client = await getApiClient();

  try {
    const result = await deletePlaylistData(playlistId, client);

    if (json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(`\nPlaylist ${playlistId} deleted.`);
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

export async function addTrackToPlaylistData(playlistId: string, trackId: string, client: any): Promise<{ playlistId: string; trackId: string; added: boolean }> {
  const r = await writeWithRetry(() => client.POST('/playlists/{id}/relationships/items' as any, {
    params: { path: { id: playlistId } },
    body: {
      data: [{ id: trackId, type: 'tracks' }],
    },
  }));

  if (!r.ok) {
    throw new Error(`Failed to add track — ${JSON.stringify(r.error)}`);
  }

  return { playlistId, trackId, added: true };
}

export async function addTrackToPlaylist(playlistId: string, trackId: string, json: boolean): Promise<void> {
  const client = await getApiClient();

  try {
    const result = await addTrackToPlaylistData(playlistId, trackId, client);

    if (json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(`\nTrack ${trackId} added to playlist ${playlistId}.`);
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

export async function removeTrackFromPlaylistData(playlistId: string, trackId: string, client: any): Promise<{ playlistId: string; trackId: string; removed: boolean }> {
  const { data: items } = await fetchAllPages(client, '/playlists/{id}/relationships/items', {
    path: { id: playlistId },
  });

  const item = items.find((i: any) => i.id === trackId);
  if (!item) {
    throw new Error(`Track ${trackId} not found in playlist ${playlistId}.`);
  }

  const { error } = await client.DELETE('/playlists/{id}/relationships/items' as any, {
    params: { path: { id: playlistId } },
    body: {
      data: [{ id: trackId, type: 'tracks', meta: { itemId: item.meta.itemId } }],
    },
  });

  if (error) {
    throw new Error(`Failed to remove track — ${JSON.stringify(error)}`);
  }

  return { playlistId, trackId, removed: true };
}

export async function removeTrackFromPlaylist(playlistId: string, trackId: string, json: boolean): Promise<void> {
  const client = await getApiClient();

  try {
    const result = await removeTrackFromPlaylistData(playlistId, trackId, client);

    if (json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(`\nTrack ${trackId} removed from playlist ${playlistId}.`);
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

export async function addAlbumToPlaylistData(playlistId: string, albumId: string, client: any, countryCode: string): Promise<{ playlistId: string; albumId: string; tracksAdded: number }> {
  const { data: albumData, error: albumError } = await client.GET('/albums/{id}', {
    params: {
      path: { id: albumId },
      query: { countryCode, include: ['items'] as any },
    },
  });

  if (albumError || !albumData) {
    throw new Error(`Failed to get album — ${JSON.stringify(albumError)}`);
  }

  const included = (albumData as any).included ?? [];
  const trackIds = included
    .filter((item: any) => item.type === 'tracks')
    .map((item: any) => ({ id: item.id, type: 'tracks' }));

  if (trackIds.length === 0) {
    throw new Error('No tracks found in album.');
  }

  const { added, failed } = await addTrackIdsToPlaylistData(playlistId, trackIds.map((t: any) => t.id), client);
  if (failed) {
    throw new Error(added ? `Added ${added} of ${trackIds.length} album tracks. ${failed}` : `Failed to add album tracks — ${failed}`);
  }

  return { playlistId, albumId, tracksAdded: trackIds.length };
}

export async function addAlbumToPlaylist(playlistId: string, albumId: string, json: boolean): Promise<void> {
  const client = await getApiClient();
  const countryCode = await getCountryCode();

  try {
    const result = await addAlbumToPlaylistData(playlistId, albumId, client, countryCode);

    if (json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(`\n${result.tracksAdded} tracks from album ${albumId} added to playlist ${playlistId}.`);
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

export async function moveTrackInPlaylistData(
  playlistId: string,
  trackId: string,
  positionBefore: string,
  client: any,
): Promise<{ playlistId: string; trackId: string; positionBefore: string; moved: boolean }> {
  const { data: items } = await fetchAllPages(client, '/playlists/{id}/relationships/items', {
    path: { id: playlistId },
  });

  const item = items.find((i: any) => i.id === trackId);
  if (!item) {
    throw new Error(`Track ${trackId} not found in playlist ${playlistId}.`);
  }

  const itemId = item.meta?.itemId;
  if (!itemId) {
    throw new Error(`Could not find itemId for track ${trackId}.`);
  }

  const meta: any = {};
  if (positionBefore !== 'end') {
    meta.positionBefore = positionBefore;
  }

  const { error } = await (client as any).PATCH('/playlists/{id}/relationships/items', {
    params: { path: { id: playlistId } },
    body: {
      data: [{ id: trackId, type: 'tracks', meta: { itemId } }],
      meta,
    },
  });

  if (error) {
    throw new Error(`Failed to move track — ${JSON.stringify(error)}`);
  }

  return { playlistId, trackId, positionBefore, moved: true };
}

export async function moveTrackInPlaylist(
  playlistId: string,
  trackId: string,
  positionBefore: string,
  json: boolean,
): Promise<void> {
  const client = await getApiClient();

  try {
    const result = await moveTrackInPlaylistData(playlistId, trackId, positionBefore, client);

    if (json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    const posDesc = positionBefore === 'end' ? 'to end of playlist' : `before item ${positionBefore}`;
    console.log(`\nTrack ${trackId} moved ${posDesc} in playlist ${playlistId}.`);
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

export async function updatePlaylistDescriptionData(
  playlistId: string,
  description: string,
  client: any,
): Promise<{ id: string; description: string; success: boolean }> {
  const { error } = await client.PATCH('/playlists/{id}', {
    params: { path: { id: playlistId } },
    body: {
      data: {
        type: 'playlists',
        id: playlistId,
        attributes: { description },
      },
    } as any,
  });

  if (error) {
    throw new Error(`Failed to update playlist description — ${JSON.stringify(error)}`);
  }

  return { id: playlistId, description, success: true };
}

export async function updatePlaylistDescription(
  playlistId: string,
  description: string,
  json: boolean,
): Promise<void> {
  const client = await getApiClient();

  try {
    const result = await updatePlaylistDescriptionData(playlistId, description, client);

    if (json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(`\nPlaylist ${playlistId} description updated.`);
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Lists the tracks in a playlist in order, with the track details that differ between
 * catalog copies of the "same" song (track id, album, ISRC, version, availability).
 */
export async function playlistItemsData(
  playlistId: string,
  client: any,
  countryCode: string,
): Promise<Array<Record<string, unknown>>> {
  const { data: items } = await fetchAllPages(client, '/playlists/{id}/relationships/items', {
    path: { id: playlistId },
    query: { countryCode },
  });

  const trackIds: string[] = items.filter((i: any) => i.type === 'tracks').map((i: any) => i.id);
  const details = new Map<string, any>();
  for (let i = 0; i < trackIds.length; i += 20) {
    const chunk = [...new Set(trackIds.slice(i, i + 20))];
    const { data, error } = await client.GET('/tracks' as any, {
      params: { query: { countryCode, 'filter[id]': [chunk.join(',')], include: ['albums', 'artists'] } as any },
    });
    if (error || !data) throw new Error(`Failed to get tracks — ${JSON.stringify(error)}`);
    const inc = new Map<string, any>();
    for (const x of (data as any).included ?? []) inc.set(`${x.type}:${x.id}`, x);
    const rows = Array.isArray((data as any).data) ? (data as any).data : [(data as any).data];
    for (const row of rows) {
      if (!row?.id) continue;
      const albums = (row.relationships?.albums?.data ?? []).map((r: any) => {
        const a = inc.get(`albums:${r.id}`);
        return { id: r.id, title: a?.attributes?.title, barcode: a?.attributes?.barcodeId, releaseDate: a?.attributes?.releaseDate, availability: a?.attributes?.availability };
      });
      const artists = (row.relationships?.artists?.data ?? []).map((r: any) => inc.get(`artists:${r.id}`)?.attributes?.name ?? r.id);
      details.set(row.id, { attributes: row.attributes ?? {}, albums, artists });
    }
  }

  return items.map((item: any, index: number) => {
    const d = details.get(item.id);
    const a = d?.attributes ?? {};
    return {
      position: index + 1,
      type: item.type,
      trackId: item.id,
      itemId: item.meta?.itemId,
      addedAt: item.meta?.addedAt,
      title: a.title,
      version: a.version ?? null,
      artists: d?.artists ?? [],
      isrc: a.isrc,
      explicit: a.explicit,
      availability: a.availability,
      mediaTags: a.mediaTags,
      albums: d?.albums ?? [],
      found: !!d,
    };
  });
}


export interface CreateFromItemsResult {
  id: string;
  name: string;
  /** Tracks that are really in the playlist, read back from Tidal after adding (falls back to the confirmed adds if the read fails). */
  tracksAdded: number;
  tracksRequested: number;
  /** Read back from Tidal after adding; null if the read failed. */
  tracksInPlaylist: number | null;
  /** Track ids that are not in the playlist, in playlist order (empty when everything landed). */
  missingTrackIds: string[];
  failed?: string;
}

const ADD_CHUNK = 20;
const ADD_PACE_MS = 300;

/** Counts the items of a playlist by reading every page. Returns the item track ids in order. */
export async function playlistTrackIdsData(playlistId: string, client: any, countryCode: string): Promise<string[]> {
  const { data } = await fetchAllPages(client, '/playlists/{id}/relationships/items', {
    path: { id: playlistId },
    query: { countryCode },
  });
  return data.map((i: any) => String(i.id));
}

/** Ids in `wanted` that are not covered by `present` (counts duplicates), keeping the order of `wanted`. */
export function missingIds(wanted: string[], present: string[]): string[] {
  const left = new Map<string, number>();
  for (const id of present) left.set(id, (left.get(id) ?? 0) + 1);
  const out: string[] = [];
  for (const id of wanted) {
    const n = left.get(id) ?? 0;
    if (n > 0) left.set(id, n - 1);
    else out.push(id);
  }
  return out;
}

/**
 * Adds tracks to a playlist in order, in sequential chunks of 20 with retry/backoff.
 * A chunk counts as added only on a confirmed 2xx answer; stops at the first chunk that
 * still fails after retries, so the playlist keeps the given order.
 */
export async function addTrackIdsToPlaylistData(
  playlistId: string,
  trackIds: string[],
  client: any,
  options: { paceMs?: number; retryDelayMs?: number } = {},
): Promise<{ added: number; failed?: string }> {
  const pace = options.paceMs ?? ADD_PACE_MS;
  let added = 0;
  for (let i = 0; i < trackIds.length; i += ADD_CHUNK) {
    if (i > 0 && pace > 0) await sleep(pace);
    const chunk = trackIds.slice(i, i + ADD_CHUNK).map((id) => ({ id, type: 'tracks' }));
    const r = await writeWithRetry(() => client.POST('/playlists/{id}/relationships/items' as any, {
      params: { path: { id: playlistId } },
      body: { data: chunk },
    }), 4, options.retryDelayMs ?? 800);
    if (!r.ok) {
      return { added, failed: `Failed to add tracks ${i + 1}-${i + chunk.length}${r.status ? ` (HTTP ${r.status})` : ''} — ${JSON.stringify(r.error)}` };
    }
    added += chunk.length;
  }
  return { added };
}

export interface AddTracksResult {
  playlistId: string;
  tracksRequested: number;
  tracksAdded: number;
  tracksInPlaylist: number | null;
  missingTrackIds: string[];
  failed?: string;
}

/** Reads the playlist back (once more after a short pause if items seem missing) and reports what is really there. */
async function verifyPlaylist(
  playlistId: string,
  wanted: string[],
  client: any,
  countryCode: string,
  verifyDelayMs: number,
): Promise<{ count: number | null; missing: string[] }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const present = await playlistTrackIdsData(playlistId, client, countryCode);
      const missing = missingIds(wanted, present);
      if (!missing.length || attempt === 1) return { count: present.length, missing };
    } catch {
      if (attempt === 1) return { count: null, missing: [] };
    }
    await sleep(verifyDelayMs);
  }
  return { count: null, missing: [] };
}

/**
 * Adds tracks (by id, in order) to an existing playlist and reads the playlist back to
 * report how many tracks it really holds and which of the given ids are not in it.
 */
export async function addTracksToPlaylistData(
  playlistId: string,
  trackIds: string[],
  client: any,
  countryCode: string,
  options: { paceMs?: number; retryDelayMs?: number; verifyDelayMs?: number } = {},
): Promise<AddTracksResult> {
  const before = await playlistTrackIdsData(playlistId, client, countryCode).catch(() => null);
  const { added, failed } = await addTrackIdsToPlaylistData(playlistId, trackIds, client, options);
  const wanted = [...(before ?? []), ...trackIds];
  const v = before ? await verifyPlaylist(playlistId, wanted, client, countryCode, options.verifyDelayMs ?? 1500) : { count: null, missing: [] as string[] };
  const missing = v.count === null ? trackIds.slice(added) : v.missing;
  return {
    playlistId,
    tracksRequested: trackIds.length,
    tracksAdded: v.count === null || !before ? added : Math.max(0, v.count - before.length),
    tracksInPlaylist: v.count,
    missingTrackIds: missing,
    failed: failed ?? (missing.length ? `Tidal has ${v.count} tracks in the playlist; ${missing.length} of the requested tracks are missing` : undefined),
  };
}

/**
 * Creates a playlist and fills it with tracks and whole albums in one call, server side:
 * albums are expanded to their tracks (fetched in parallel), then tracks are added in
 * sequential chunks of 20 so the order stays exactly as given. Afterwards the playlist is
 * read back, so tracksAdded is what Tidal really holds, not what was sent.
 */
export async function createPlaylistFromItemsData(
  name: string,
  description: string,
  items: Array<{ type: 'tracks' | 'albums'; id: string }>,
  client: any,
  countryCode: string,
  options: { paceMs?: number; retryDelayMs?: number; verifyDelayMs?: number } = {},
): Promise<CreateFromItemsResult> {
  const created = await createPlaylistData(name, description, client);

  const expanded: string[][] = await Promise.all(
    items.map(async (it) => {
      if (it.type === 'tracks') return [it.id];
      const { data, error } = await getWithRetry(client, '/albums/{id}', {
        params: { path: { id: it.id }, query: { countryCode, include: ['items'] as any } },
      }, 3, options.retryDelayMs ?? 600);
      if (error || !data) return [];
      return ((data as any).included ?? []).filter((x: any) => x.type === 'tracks').map((x: any) => x.id as string);
    }),
  );
  const ids = expanded.flat();

  const { added, failed } = await addTrackIdsToPlaylistData(created.id, ids, client, options);
  const v = await verifyPlaylist(created.id, ids, client, countryCode, options.verifyDelayMs ?? 1500);
  const inPlaylist = v.count;
  const missing = inPlaylist === null ? ids.slice(added) : v.missing;
  let note = failed;
  if (!note && missing.length) note = `Tidal holds ${inPlaylist} of ${ids.length} tracks after adding; ${missing.length} are missing`;
  return {
    id: created.id,
    name: created.name,
    tracksAdded: inPlaylist ?? added,
    tracksRequested: ids.length,
    tracksInPlaylist: inPlaylist,
    missingTrackIds: missing,
    failed: note,
  };
}
