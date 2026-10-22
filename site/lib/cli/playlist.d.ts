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
    tracksAdded: number;
    tracksRequested: number;
    failed?: string;
}
/**
 * Creates a playlist and fills it with tracks and whole albums in one call, server side:
 * albums are expanded to their tracks (fetched in parallel), then tracks are added in
 * sequential chunks of 20 so the order stays exactly as given.
 */
export declare function createPlaylistFromItemsData(name: string, description: string, items: Array<{
    type: 'tracks' | 'albums';
    id: string;
}>, client: any, countryCode: string): Promise<CreateFromItemsResult>;
