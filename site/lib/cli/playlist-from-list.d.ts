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
    /**
     * 'exact' = same title; 'variant' = title with an extra suffix (e.g. "(Remastered)");
     * 'fuzzy' = nearly the same title (one small word or a typo differs, e.g. "Kiss the Shadow" → "Kiss Your Shadow").
     * The artist always has to match, allowing for spelling variants such as "X-Mal" / "Xmal".
     */
    match: 'exact' | 'variant' | 'fuzzy';
    /** Can this track be streamed by a subscriber in the user's country? null = TIDAL gave no usable information. */
    playable: boolean | null;
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
    /** Lines whose best match exists in the catalog but is NOT streamable in the user's country */
    unplayable: string[];
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
/** Edit distance (Levenshtein), used only on short strings such as names and titles. */
export declare function editDistance(a: string, b: string): number;
export type TitleRelation = 'exact' | 'variant' | 'fuzzy' | 'none';
export declare function titleRelation(wanted: string, found: string): TitleRelation;
/**
 * 'exact' = same name after normalizing; 'close' = the same name spelled differently on Tidal:
 * hyphens or spaces ("X-Mal" / "XMAL"), a leading "The", or a letter off in a long name ("Poupée Fabrikk" / "Pouppée Fabrikk").
 */
export declare function artistRelation(wanted: string, found: string): 'exact' | 'close' | 'none';
/** Availability check for known track ids (e.g. to see why a track is greyed out). */
export declare function checkTracksData(trackIds: string[], client: any, countryCode: string): Promise<Array<{
    trackId: string;
    title: string;
    artists: string[];
    playable: boolean | null;
    country: string;
}>>;
/**
 * Takes lines in the form "Artist - Title", resolves each to a Tidal track requiring the artist to
 * match (spelling variants allowed), creates one playlist in list order and reports what could not be found.
 * With dryRun = true nothing is created.
 */
export declare function createPlaylistFromListData(name: string, lines: string[], client: any, countryCode: string, options?: {
    dryRun?: boolean;
    description?: string;
}): Promise<PlaylistFromListResult>;
