export interface SetlistArtist {
    mbid: string;
    name: string;
    disambiguation?: string;
    url?: string;
}
export interface ConcertSummary {
    date: string;
    venue: string;
    city: string;
    country: string;
    songCount: number;
    url?: string;
}
export interface SongStat {
    name: string;
    /** Times played in the setlists considered (not all-time) */
    count: number;
    lastPlayed: {
        date: string;
        venue: string;
        city: string;
    } | null;
    /** Played in at least one of the last N concerts that have songs */
    inRecent: boolean;
}
export interface TopSongsResult {
    artist: SetlistArtist;
    otherArtists: SetlistArtist[];
    setlistsConsidered: number;
    concertsWithSongs: number;
    recentConcerts: ConcertSummary[];
    /** Past concerts newer than the last recent one that have no songs entered */
    skippedWithoutSongs: ConcertSummary[];
    upcoming: ConcertSummary[];
    /** Top songs among those played in the recent concerts, in the order they are played live */
    selected: SongStat[];
    /** Next most-played songs, for the user to add if wanted */
    others: SongStat[];
    /** True when the recent concerts play the selected songs in different orders */
    orderDiffers: boolean;
    notes: string[];
}
/** Lets the host (e.g. the Cloudflare Worker) pass the key from its own environment. */
export declare function setSetlistApiKey(key: string | undefined): void;
export declare function normalizeName(s: string): string;
/** "dd-MM-yyyy" → "yyyy-mm-dd" */
export declare function isoDate(d: string): string;
export declare function searchSetlistArtistsData(name: string, fetchImpl?: typeof fetch): Promise<SetlistArtist[]>;
/**
 * Pure part: from setlists (newest first) compute the playlist-ready song selection.
 * Exported for tests.
 */
export declare function computeTopSongs(setlists: any[], today: string, recentN: number, topN: number): {
    recent: ConcertSummary[];
    skippedWithoutSongs: ConcertSummary[];
    upcoming: ConcertSummary[];
    withSongsCount: number;
    selected: SongStat[];
    others: SongStat[];
    orderDiffers: boolean;
};
export declare function getTopSongsData(artistName: string, options?: {
    recentConcerts?: number;
    songs?: number;
    pages?: number;
    today?: string;
}, fetchImpl?: typeof fetch): Promise<TopSongsResult>;
export interface UpcomingShow {
    date: string;
    venue: string;
    venueId: string;
    city: string;
    country: string;
    tour?: string;
    url?: string;
}
export interface NextConcertResult {
    artist: SetlistArtist;
    /** Upcoming shows of the artist (today or later), nearest first, after applying the city/country filter */
    upcoming: UpcomingShow[];
    /** The nearest matching show (or the one on `date` when given) */
    next: UpcomingShow | null;
    /** Other acts with a setlist entry at the same venue on the same day (support bands, festival or package-tour bill); order on stage is NOT known */
    sameDayActs: {
        name: string;
        mbid: string;
        songCount: number;
    }[];
    notes: string[];
}
/** Pure part, exported for tests: filter and order the upcoming shows. */
export declare function pickUpcoming(setlists: any[], today: string, filter?: {
    city?: string;
    country?: string;
    date?: string;
}): UpcomingShow[];
/**
 * Finds the next upcoming show of an artist (optionally in a city/country or on a date) and the other acts that
 * have a setlist entry at the same venue on the same day. setlist.fm has no real "line-up" data, so the acts list
 * is only as complete as what users entered; their running order is unknown.
 */
export declare function getNextConcertData(artistName: string, options?: {
    city?: string;
    country?: string;
    date?: string;
    today?: string;
}, fetchImpl?: typeof fetch): Promise<NextConcertResult>;
