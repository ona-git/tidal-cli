import { searchData } from './search';
import { createPlaylistData } from './playlist';

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
  candidates: Array<{ trackId: string; title: string; artists: string[] }>;
}

export interface PlaylistFromListResult {
  dryRun: boolean;
  playlist?: { id: string; name: string; url: string };
  matched: MatchedEntry[];
  notFound: MissingEntry[];
  duplicates: string[];
  invalidLines: string[];
}

/** Lower-case, strip diacritics and punctuation, collapse whitespace. */
export function normalize(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ð/g, 'd') // ð
    .replace(/þ/g, 'th') // þ
    .replace(/æ/g, 'ae') // æ
    .replace(/ø/g, 'o') // ø
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function parseList(lines: string[]): { entries: ListEntry[]; invalid: string[] } {
  const entries: ListEntry[] = [];
  const invalid: string[] = [];
  for (const rawLine of lines) {
    const raw = rawLine.trim();
    if (!raw) continue;
    const idx = raw.indexOf(' - ');
    if (idx <= 0 || idx + 3 >= raw.length) {
      invalid.push(raw);
      continue;
    }
    entries.push({ raw, artist: raw.slice(0, idx).trim(), title: raw.slice(idx + 3).trim() });
  }
  return { entries, invalid };
}

function titleRelation(wanted: string, found: string): 'exact' | 'variant' | 'none' {
  const w = normalize(wanted);
  const f = normalize(found);
  if (!w || !f) return 'none';
  if (w === f) return 'exact';
  // Same title with a suffix such as "Remastered 2020", "Live", "Radio Edit" is accepted only as variant.
  if (f.startsWith(w + ' ')) return 'variant';
  return 'none';
}

function artistMatches(wanted: string, found: string[]): boolean {
  const w = normalize(wanted);
  return found.some((a) => normalize(a) === w);
}

async function getTrackArtists(trackId: string, client: any, countryCode: string): Promise<{ title: string; artists: string[] }> {
  const { data, error } = await client.GET('/tracks/{id}', {
    params: { path: { id: trackId }, query: { countryCode, include: ['artists'] as any } },
  });
  if (error || !data) {
    throw new Error(`Failed to get track ${trackId} — ${JSON.stringify(error)}`);
  }
  const attrs = (data as any).data?.attributes ?? {};
  const included = (data as any).included ?? [];
  const artists = included.filter((i: any) => i.type === 'artists').map((i: any) => i.attributes?.name ?? i.id);
  return { title: attrs.title ?? 'Unknown', artists };
}

async function findTrack(
  entry: ListEntry,
  client: any,
  countryCode: string,
): Promise<{ hit?: MatchedEntry; candidates: MissingEntry['candidates'] }> {
  const queries = [`${entry.artist} ${entry.title}`, entry.title];
  const seen = new Map<string, { title: string; artists: string[] }>();
  let variant: MatchedEntry | undefined;

  for (const query of queries) {
    const results = await searchData('track', query, client, countryCode);
    // Only look up artists for tracks whose title is plausibly the wanted one (keeps API calls low).
    const plausible = results
      .filter((r) => titleRelation(entry.title, r.name) !== 'none' && !seen.has(r.id))
      .slice(0, 8);

    for (const r of plausible) {
      const info = await getTrackArtists(r.id, client, countryCode);
      seen.set(r.id, info);
      if (!artistMatches(entry.artist, info.artists)) continue;
      const rel = titleRelation(entry.title, info.title);
      if (rel === 'exact') {
        return {
          hit: { line: entry.raw, trackId: r.id, tidalTitle: info.title, tidalArtists: info.artists, match: 'exact' },
          candidates: [],
        };
      }
      if (rel === 'variant' && !variant) {
        variant = { line: entry.raw, trackId: r.id, tidalTitle: info.title, tidalArtists: info.artists, match: 'variant' };
      }
    }
    if (variant) return { hit: variant, candidates: [] };

    // Keep a few unfiltered results (title only) as suggestions in case nothing matched.
    for (const r of results.slice(0, 5)) {
      if (!seen.has(r.id)) seen.set(r.id, { title: r.name, artists: [] });
    }
  }

  const candidates = [...seen.entries()].slice(0, 5).map(([trackId, v]) => ({ trackId, title: v.title, artists: v.artists }));
  return { candidates };
}

/**
 * Takes lines in the form "Artist - Title", resolves each to a Tidal track requiring an exact artist
 * match, creates one playlist in list order and reports what could not be found.
 * With dryRun = true nothing is created.
 */
export async function createPlaylistFromListData(
  name: string,
  lines: string[],
  client: any,
  countryCode: string,
  options: { dryRun?: boolean; description?: string } = {},
): Promise<PlaylistFromListResult> {
  const { entries, invalid } = parseList(lines);
  const matched: MatchedEntry[] = [];
  const notFound: MissingEntry[] = [];
  const duplicates: string[] = [];
  const usedIds = new Set<string>();

  for (const entry of entries) {
    let found: Awaited<ReturnType<typeof findTrack>>;
    try {
      found = await findTrack(entry, client, countryCode);
    } catch (e: any) {
      notFound.push({ line: entry.raw, reason: `Search error: ${e?.message ?? e}`, candidates: [] });
      continue;
    }
    if (!found.hit) {
      notFound.push({ line: entry.raw, reason: 'No track with this artist and title found on Tidal', candidates: found.candidates });
      continue;
    }
    if (usedIds.has(found.hit.trackId)) {
      duplicates.push(entry.raw);
      continue;
    }
    usedIds.add(found.hit.trackId);
    matched.push(found.hit);
  }

  const result: PlaylistFromListResult = {
    dryRun: !!options.dryRun,
    matched,
    notFound,
    duplicates,
    invalidLines: invalid,
  };

  if (options.dryRun || matched.length === 0) return result;

  const created = await createPlaylistData(name, options.description ?? '', client);
  const CHUNK = 20; // sequential chunks keep the original order
  for (let i = 0; i < matched.length; i += CHUNK) {
    const chunk = matched.slice(i, i + CHUNK).map((m) => ({ id: m.trackId, type: 'tracks' }));
    const { error } = await client.POST('/playlists/{id}/relationships/items' as any, {
      params: { path: { id: created.id } },
      body: { data: chunk },
    });
    if (error) {
      throw new Error(`Playlist ${created.id} was created but adding tracks ${i + 1}-${i + chunk.length} failed — ${JSON.stringify(error)}`);
    }
  }

  result.playlist = { id: created.id, name: created.name, url: `https://tidal.com/playlist/${created.id}` };
  return result;
}
