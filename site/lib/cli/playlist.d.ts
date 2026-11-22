import type { PlaylistInfo } from './types';
export type { PlaylistInfo };
export declare function listPlaylistsData(client: any, countryCode: string): Promise<PlaylistInfo[]>;
export declare function listPlaylists(json: boolean): Promise<void>;
export declare function createPlaylistData(name: string, description: string, client: any): Promise<{
    id: string;
    name: string;
    description: string;
}>;
export declare function createPlaylist(name: string, description: string, json: boolean): Promise<void>;
export declare function renamePlaylistData(playlistId: string, name: string, client: any): Promise<{
    id: string;
    name: string;
    success: boolean;
}>;
export declare function renamePlaylist(playlistId: string, name: string, json: boolean): Promise<void>;
export declare function deletePlaylistData(playlistId: string, client: any): Promise<{
    id: string;
    deleted: boolean;
}>;
export declare function deletePlaylist(playlistId: string, json: boolean): Promise<void>;
export declare function addTrackToPlaylistData(playlistId: string, trackId: string, client: any): Promise<{
    playlistId: string;
    trackId: string;
    added: boolean;
}>;
export declare function addTrackToPlaylist(playlistId: string, trackId: string, json: boolean): Promise<void>;
export declare function removeTrackFromPlaylistData(playlistId: string, trackId: string, client: any): Promise<{
    playlistId: string;
    trackId: string;
    removed: boolean;
}>;
export declare function removeTrackFromPlaylist(playlistId: string, trackId: string, json: boolean): Promise<void>;
export declare function addAlbumToPlaylistData(playlistId: string, albumId: string, client: any, countryCode: string): Promise<{
    playlistId: string;
    albumId: string;
    tracksAdded: number;
}>;
export declare function addAlbumToPlaylist(playlistId: string, albumId: string, json: boolean): Promise<void>;
export declare function moveTrackInPlaylistData(playlistId: string, trackId: string, positionBefore: string, client: any): Promise<{
    playlistId: string;
    trackId: string;
    positionBefore: string;
    moved: boolean;
}>;
export declare function moveTrackInPlaylist(playlistId: string, trackId: string, positionBefore: string, json: boolean): Promise<void>;
export declare function updatePlaylistDescriptionData(playlistId: string, description: string, client: any): Promise<{
    id: string;
    description: string;
    success: boolean;
}>;
export declare function updatePlaylistDescription(playlistId: string, description: string, json: boolean): Promise<void>;
/**
 * Lists the tracks in a playlist in order, with the track details that differ between
 * catalog copies of the "same" song (track id, album, ISRC, version, availability).
 */
export declare function playlistItemsData(playlistId: string, client: any, countryCode: string): Promise<Array<Record<string, unknown>>>;
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
/** Counts the items of a playlist by reading every page. Returns the item track ids in order. */
export declare function playlistTrackIdsData(playlistId: string, client: any, countryCode: string): Promise<string[]>;
/** Ids in `wanted` that are not covered by `present` (counts duplicates), keeping the order of `wanted`. */
export declare function missingIds(wanted: string[], present: string[]): string[];
/**
 * Adds tracks to a playlist in order, in sequential chunks of 20 with retry/backoff.
 * A chunk counts as added only on a confirmed 2xx answer; stops at the first chunk that
 * still fails after retries, so the playlist keeps the given order.
 */
export declare function addTrackIdsToPlaylistData(playlistId: string, trackIds: string[], client: any, options?: {
    paceMs?: number;
    retryDelayMs?: number;
}): Promise<{
    added: number;
    failed?: string;
}>;
export interface AddTracksResult {
    playlistId: string;
    tracksRequested: number;
    tracksAdded: number;
    tracksInPlaylist: number | null;
    missingTrackIds: string[];
    failed?: string;
}
/**
 * Adds tracks (by id, in order) to an existing playlist and reads the playlist back to
 * report how many tracks it really holds and which of the given ids are not in it.
 */
export declare function addTracksToPlaylistData(playlistId: string, trackIds: string[], client: any, countryCode: string, options?: {
    paceMs?: number;
    retryDelayMs?: number;
    verifyDelayMs?: number;
}): Promise<AddTracksResult>;
/**
 * Creates a playlist and fills it with tracks and whole albums in one call, server side:
 * albums are expanded to their tracks (fetched in parallel), then tracks are added in
 * sequential chunks of 20 so the order stays exactly as given. Afterwards the playlist is
 * read back, so tracksAdded is what Tidal really holds, not what was sent.
 */
export declare function createPlaylistFromItemsData(name: string, description: string, items: Array<{
    type: 'tracks' | 'albums';
    id: string;
}>, client: any, countryCode: string, options?: {
    paceMs?: number;
    retryDelayMs?: number;
    verifyDelayMs?: number;
}): Promise<CreateFromItemsResult>;
