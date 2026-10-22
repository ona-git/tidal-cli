import { getApiClient, getCountryCode } from './auth';
import { fetchAllPages } from './pagination';
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
  const { error } = await client.POST('/playlists/{id}/relationships/items' as any, {
    params: { path: { id: playlistId } },
    body: {
      data: [{ id: trackId, type: 'tracks' }],
    },
  });

  if (error) {
    throw new Error(`Failed to add track — ${JSON.stringify(error)}`);
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

  const { error } = await client.POST('/playlists/{id}/relationships/items' as any, {
    params: { path: { id: playlistId } },
    body: { data: trackIds },
  });

  if (error) {
    throw new Error(`Failed to add album tracks — ${JSON.stringify(error)}`);
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
  tracksAdded: number;
  tracksRequested: number;
  failed?: string;
}

/**
 * Creates a playlist and fills it with tracks and whole albums in one call, server side:
 * albums are expanded to their tracks (fetched in parallel), then tracks are added in
 * sequential chunks of 20 so the order stays exactly as given.
 */
export async function createPlaylistFromItemsData(
  name: string,
  description: string,
  items: Array<{ type: 'tracks' | 'albums'; id: string }>,
  client: any,
  countryCode: string,
): Promise<CreateFromItemsResult> {
  const created = await createPlaylistData(name, description, client);

  const expanded: string[][] = await Promise.all(
    items.map(async (it) => {
      if (it.type === 'tracks') return [it.id];
      const { data, error } = await client.GET('/albums/{id}', {
        params: { path: { id: it.id }, query: { countryCode, include: ['items'] as any } },
      });
      if (error || !data) return [];
      return ((data as any).included ?? []).filter((x: any) => x.type === 'tracks').map((x: any) => x.id as string);
    }),
  );
  const ids = expanded.flat();

  let added = 0;
  let failed: string | undefined;
  for (let i = 0; i < ids.length; i += 20) {
    const chunk = ids.slice(i, i + 20).map((id) => ({ id, type: 'tracks' }));
    const { error } = await client.POST('/playlists/{id}/relationships/items' as any, {
      params: { path: { id: created.id } },
      body: { data: chunk },
    });
    if (error) { failed = `Failed to add tracks ${i + 1}-${i + chunk.length} — ${JSON.stringify(error)}`; break; }
    added += chunk.length;
  }
  return { id: created.id, name: created.name, tracksAdded: added, tracksRequested: ids.length, failed };
}
