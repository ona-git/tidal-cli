export interface ListEntry {
    raw: string;
    artist: string;
    title: string;
}
export interface MatchedEntry {
    line: string;
    trackId: string;
    tidalTitle: string;
    tidalArtists: string[];
    /** 'exact' = same artist and same title; 'variant' = same artist, title with an extra suffix (e.g. "(Remastered)") */
    match: 'exact' | 'variant';
}
export interface MissingEntry {
    line: string;
    reason: string;
    /** Closest tracks found on Tidal (any artist), to help the user pick a correct title */
    candidates: Array<{
        trackId: string;
        title: string;
        artists: string[];
    }>;
}
export interface PlaylistFromListResult {
    dryRun: boolean;
    playlist?: {
        id: string;
        name: string;
        url: string;
    };
    matched: MatchedEntry[];
    notFound: MissingEntry[];
    duplicates: string[];
    invalidLines: string[];
}
/** Lower-case, strip diacritics and punctuation, collapse whitespace. */
export declare function normalize(s: string): string;
export declare function parseList(lines: string[]): {
    entries: ListEntry[];
    invalid: string[];
};
/**
 * Takes lines in the form "Artist - Title", resolves each to a Tidal track requiring an exact artist
 * match, creates one playlist in list order and reports what could not be found.
 * With dryRun = true nothing is created.
 */
export declare function createPlaylistFromListData(name: string, lines: string[], client: any, countryCode: string, options?: {
    dryRun?: boolean;
    description?: string;
}): Promise<PlaylistFromListResult>;
