"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPlaylistsData = listPlaylistsData;
exports.listPlaylists = listPlaylists;
exports.createPlaylistData = createPlaylistData;
exports.createPlaylist = createPlaylist;
exports.renamePlaylistData = renamePlaylistData;
exports.renamePlaylist = renamePlaylist;
exports.deletePlaylistData = deletePlaylistData;
exports.deletePlaylist = deletePlaylist;
exports.addTrackToPlaylistData = addTrackToPlaylistData;
exports.addTrackToPlaylist = addTrackToPlaylist;
exports.removeTrackFromPlaylistData = removeTrackFromPlaylistData;
exports.removeTrackFromPlaylist = removeTrackFromPlaylist;
exports.addAlbumToPlaylistData = addAlbumToPlaylistData;
exports.addAlbumToPlaylist = addAlbumToPlaylist;
exports.moveTrackInPlaylistData = moveTrackInPlaylistData;
exports.moveTrackInPlaylist = moveTrackInPlaylist;
exports.updatePlaylistDescriptionData = updatePlaylistDescriptionData;
exports.updatePlaylistDescription = updatePlaylistDescription;
exports.playlistItemsData = playlistItemsData;
exports.playlistTrackIdsData = playlistTrackIdsData;
exports.missingIds = missingIds;
exports.addTrackIdsToPlaylistData = addTrackIdsToPlaylistData;
exports.addTracksToPlaylistData = addTracksToPlaylistData;
exports.createPlaylistFromItemsData = createPlaylistFromItemsData;
const auth_1 = require("./auth");
const pagination_1 = require("./pagination");
const retry_1 = require("./retry");
async function listPlaylistsData(client, countryCode) {
    const { data } = await (0, pagination_1.fetchAllPages)(client, '/playlists', {
        query: {
            'filter[owners.id]': ['me'],
            countryCode,
        },
    });
    return data.map((p) => ({
        id: p.id,
        name: p.attributes?.name ?? 'Untitled',
        description: p.attributes?.description,
        numberOfItems: p.attributes?.numberOfItems,
        createdAt: p.attributes?.createdAt,
        lastModifiedAt: p.attributes?.lastModifiedAt,
    }));
}
async function listPlaylists(json) {
    const client = await (0, auth_1.getApiClient)();
    const countryCode = await (0, auth_1.getCountryCode)();
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
            if (p.description)
                console.log(`    ${p.description}`);
        }
        console.log();
    }
    catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
    }
}
async function createPlaylistData(name, description, client) {
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
        },
    });
    if (error || !data) {
        throw new Error(`Failed to create playlist — ${JSON.stringify(error)}`);
    }
    const created = data.data;
    return {
        id: created.id,
        name: created.attributes?.name ?? name,
        description: created.attributes?.description ?? description,
    };
}
async function createPlaylist(name, description, json) {
    const client = await (0, auth_1.getApiClient)();
    try {
        const result = await createPlaylistData(name, description, client);
        if (json) {
            console.log(JSON.stringify(result, null, 2));
            return;
        }
        console.log(`\nPlaylist created: [${result.id}] ${result.name}`);
    }
    catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
    }
}
async function renamePlaylistData(playlistId, name, client) {
    const { error } = await client.PATCH('/playlists/{id}', {
        params: { path: { id: playlistId } },
        body: {
            data: {
                type: 'playlists',
                id: playlistId,
                attributes: { name },
            },
        },
    });
    if (error) {
        throw new Error(`Failed to rename playlist — ${JSON.stringify(error)}`);
    }
    return { id: playlistId, name, success: true };
}
async function renamePlaylist(playlistId, name, json) {
    const client = await (0, auth_1.getApiClient)();
    try {
        const result = await renamePlaylistData(playlistId, name, client);
        if (json) {
            console.log(JSON.stringify(result, null, 2));
            return;
        }
        console.log(`\nPlaylist ${playlistId} renamed to "${name}".`);
    }
    catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
    }
}
async function deletePlaylistData(playlistId, client) {
    const { error } = await client.DELETE('/playlists/{id}', {
        params: { path: { id: playlistId } },
    });
    if (error) {
        throw new Error(`Failed to delete playlist — ${JSON.stringify(error)}`);
    }
    return { id: playlistId, deleted: true };
}
async function deletePlaylist(playlistId, json) {
    const client = await (0, auth_1.getApiClient)();
    try {
        const result = await deletePlaylistData(playlistId, client);
        if (json) {
            console.log(JSON.stringify(result, null, 2));
            return;
        }
        console.log(`\nPlaylist ${playlistId} deleted.`);
    }
    catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
    }
}
async function addTrackToPlaylistData(playlistId, trackId, client) {
    const r = await (0, retry_1.writeWithRetry)(() => client.POST('/playlists/{id}/relationships/items', {
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
async function addTrackToPlaylist(playlistId, trackId, json) {
    const client = await (0, auth_1.getApiClient)();
    try {
        const result = await addTrackToPlaylistData(playlistId, trackId, client);
        if (json) {
            console.log(JSON.stringify(result, null, 2));
            return;
        }
        console.log(`\nTrack ${trackId} added to playlist ${playlistId}.`);
    }
    catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
    }
}
async function removeTrackFromPlaylistData(playlistId, trackId, client) {
    const { data: items } = await (0, pagination_1.fetchAllPages)(client, '/playlists/{id}/relationships/items', {
        path: { id: playlistId },
    });
    const item = items.find((i) => i.id === trackId);
    if (!item) {
        throw new Error(`Track ${trackId} not found in playlist ${playlistId}.`);
    }
    const { error } = await client.DELETE('/playlists/{id}/relationships/items', {
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
async function removeTrackFromPlaylist(playlistId, trackId, json) {
    const client = await (0, auth_1.getApiClient)();
    try {
        const result = await removeTrackFromPlaylistData(playlistId, trackId, client);
        if (json) {
            console.log(JSON.stringify(result, null, 2));
            return;
        }
        console.log(`\nTrack ${trackId} removed from playlist ${playlistId}.`);
    }
    catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
    }
}
async function addAlbumToPlaylistData(playlistId, albumId, client, countryCode) {
    const { data: albumData, error: albumError } = await client.GET('/albums/{id}', {
        params: {
            path: { id: albumId },
            query: { countryCode, include: ['items'] },
        },
    });
    if (albumError || !albumData) {
        throw new Error(`Failed to get album — ${JSON.stringify(albumError)}`);
    }
    const included = albumData.included ?? [];
    const trackIds = included
        .filter((item) => item.type === 'tracks')
        .map((item) => ({ id: item.id, type: 'tracks' }));
    if (trackIds.length === 0) {
        throw new Error('No tracks found in album.');
    }
    const { added, failed } = await addTrackIdsToPlaylistData(playlistId, trackIds.map((t) => t.id), client);
    if (failed) {
        throw new Error(added ? `Added ${added} of ${trackIds.length} album tracks. ${failed}` : `Failed to add album tracks — ${failed}`);
    }
    return { playlistId, albumId, tracksAdded: trackIds.length };
}
async function addAlbumToPlaylist(playlistId, albumId, json) {
    const client = await (0, auth_1.getApiClient)();
    const countryCode = await (0, auth_1.getCountryCode)();
    try {
        const result = await addAlbumToPlaylistData(playlistId, albumId, client, countryCode);
        if (json) {
            console.log(JSON.stringify(result, null, 2));
            return;
        }
        console.log(`\n${result.tracksAdded} tracks from album ${albumId} added to playlist ${playlistId}.`);
    }
    catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
    }
}
async function moveTrackInPlaylistData(playlistId, trackId, positionBefore, client) {
    const { data: items } = await (0, pagination_1.fetchAllPages)(client, '/playlists/{id}/relationships/items', {
        path: { id: playlistId },
    });
    const item = items.find((i) => i.id === trackId);
    if (!item) {
        throw new Error(`Track ${trackId} not found in playlist ${playlistId}.`);
    }
    const itemId = item.meta?.itemId;
    if (!itemId) {
        throw new Error(`Could not find itemId for track ${trackId}.`);
    }
    const meta = {};
    if (positionBefore !== 'end') {
        meta.positionBefore = positionBefore;
    }
    const { error } = await client.PATCH('/playlists/{id}/relationships/items', {
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
async function moveTrackInPlaylist(playlistId, trackId, positionBefore, json) {
    const client = await (0, auth_1.getApiClient)();
    try {
        const result = await moveTrackInPlaylistData(playlistId, trackId, positionBefore, client);
        if (json) {
            console.log(JSON.stringify(result, null, 2));
            return;
        }
        const posDesc = positionBefore === 'end' ? 'to end of playlist' : `before item ${positionBefore}`;
        console.log(`\nTrack ${trackId} moved ${posDesc} in playlist ${playlistId}.`);
    }
    catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
    }
}
async function updatePlaylistDescriptionData(playlistId, description, client) {
    const { error } = await client.PATCH('/playlists/{id}', {
        params: { path: { id: playlistId } },
        body: {
            data: {
                type: 'playlists',
                id: playlistId,
                attributes: { description },
            },
        },
    });
    if (error) {
        throw new Error(`Failed to update playlist description — ${JSON.stringify(error)}`);
    }
    return { id: playlistId, description, success: true };
}
async function updatePlaylistDescription(playlistId, description, json) {
    const client = await (0, auth_1.getApiClient)();
    try {
        const result = await updatePlaylistDescriptionData(playlistId, description, client);
        if (json) {
            console.log(JSON.stringify(result, null, 2));
            return;
        }
        console.log(`\nPlaylist ${playlistId} description updated.`);
    }
    catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
    }
}
/**
 * Lists the tracks in a playlist in order, with the track details that differ between
 * catalog copies of the "same" song (track id, album, ISRC, version, availability).
 */
async function playlistItemsData(playlistId, client, countryCode) {
    const { data: items } = await (0, pagination_1.fetchAllPages)(client, '/playlists/{id}/relationships/items', {
        path: { id: playlistId },
        query: { countryCode },
    });
    const trackIds = items.filter((i) => i.type === 'tracks').map((i) => i.id);
    const details = new Map();
    for (let i = 0; i < trackIds.length; i += 20) {
        const chunk = [...new Set(trackIds.slice(i, i + 20))];
        const { data, error } = await client.GET('/tracks', {
            params: { query: { countryCode, 'filter[id]': [chunk.join(',')], include: ['albums', 'artists'] } },
        });
        if (error || !data)
            throw new Error(`Failed to get tracks — ${JSON.stringify(error)}`);
        const inc = new Map();
        for (const x of data.included ?? [])
            inc.set(`${x.type}:${x.id}`, x);
        const rows = Array.isArray(data.data) ? data.data : [data.data];
        for (const row of rows) {
            if (!row?.id)
                continue;
            const albums = (row.relationships?.albums?.data ?? []).map((r) => {
                const a = inc.get(`albums:${r.id}`);
                return { id: r.id, title: a?.attributes?.title, barcode: a?.attributes?.barcodeId, releaseDate: a?.attributes?.releaseDate, availability: a?.attributes?.availability };
            });
            const artists = (row.relationships?.artists?.data ?? []).map((r) => inc.get(`artists:${r.id}`)?.attributes?.name ?? r.id);
            details.set(row.id, { attributes: row.attributes ?? {}, albums, artists });
        }
    }
    return items.map((item, index) => {
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
const ADD_CHUNK = 20;
const ADD_PACE_MS = 300;
/** Counts the items of a playlist by reading every page. Returns the item track ids in order. */
async function playlistTrackIdsData(playlistId, client, countryCode) {
    const { data } = await (0, pagination_1.fetchAllPages)(client, '/playlists/{id}/relationships/items', {
        path: { id: playlistId },
        query: { countryCode },
    });
    return data.map((i) => String(i.id));
}
/** Ids in `wanted` that are not covered by `present` (counts duplicates), keeping the order of `wanted`. */
function missingIds(wanted, present) {
    const left = new Map();
    for (const id of present)
        left.set(id, (left.get(id) ?? 0) + 1);
    const out = [];
    for (const id of wanted) {
        const n = left.get(id) ?? 0;
        if (n > 0)
            left.set(id, n - 1);
        else
            out.push(id);
    }
    return out;
}
/**
 * Adds tracks to a playlist in order, in sequential chunks of 20 with retry/backoff.
 * A chunk counts as added only on a confirmed 2xx answer; stops at the first chunk that
 * still fails after retries, so the playlist keeps the given order.
 */
async function addTrackIdsToPlaylistData(playlistId, trackIds, client, options = {}) {
    const pace = options.paceMs ?? ADD_PACE_MS;
    let added = 0;
    for (let i = 0; i < trackIds.length; i += ADD_CHUNK) {
        if (i > 0 && pace > 0)
            await (0, retry_1.sleep)(pace);
        const chunk = trackIds.slice(i, i + ADD_CHUNK).map((id) => ({ id, type: 'tracks' }));
        const r = await (0, retry_1.writeWithRetry)(() => client.POST('/playlists/{id}/relationships/items', {
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
/** Reads the playlist back (once more after a short pause if items seem missing) and reports what is really there. */
async function verifyPlaylist(playlistId, wanted, client, countryCode, verifyDelayMs) {
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const present = await playlistTrackIdsData(playlistId, client, countryCode);
            const missing = missingIds(wanted, present);
            if (!missing.length || attempt === 1)
                return { count: present.length, missing };
        }
        catch {
            if (attempt === 1)
                return { count: null, missing: [] };
        }
        await (0, retry_1.sleep)(verifyDelayMs);
    }
    return { count: null, missing: [] };
}
/**
 * Adds tracks (by id, in order) to an existing playlist and reads the playlist back to
 * report how many tracks it really holds and which of the given ids are not in it.
 */
async function addTracksToPlaylistData(playlistId, trackIds, client, countryCode, options = {}) {
    const before = await playlistTrackIdsData(playlistId, client, countryCode).catch(() => null);
    const { added, failed } = await addTrackIdsToPlaylistData(playlistId, trackIds, client, options);
    const wanted = [...(before ?? []), ...trackIds];
    const v = before ? await verifyPlaylist(playlistId, wanted, client, countryCode, options.verifyDelayMs ?? 1500) : { count: null, missing: [] };
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
async function createPlaylistFromItemsData(name, description, items, client, countryCode, options = {}) {
    const created = await createPlaylistData(name, description, client);
    const expanded = await Promise.all(items.map(async (it) => {
        if (it.type === 'tracks')
            return [it.id];
        const { data, error } = await (0, retry_1.getWithRetry)(client, '/albums/{id}', {
            params: { path: { id: it.id }, query: { countryCode, include: ['items'] } },
        }, 3, options.retryDelayMs ?? 600);
        if (error || !data)
            return [];
        return (data.included ?? []).filter((x) => x.type === 'tracks').map((x) => x.id);
    }));
    const ids = expanded.flat();
    const { added, failed } = await addTrackIdsToPlaylistData(created.id, ids, client, options);
    const v = await verifyPlaylist(created.id, ids, client, countryCode, options.verifyDelayMs ?? 1500);
    const inPlaylist = v.count;
    const missing = inPlaylist === null ? ids.slice(added) : v.missing;
    let note = failed;
    if (!note && missing.length)
        note = `Tidal holds ${inPlaylist} of ${ids.length} tracks after adding; ${missing.length} are missing`;
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
//# sourceMappingURL=playlist.js.map