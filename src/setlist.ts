// setlist.fm data for concert playlists.
// Uses the official setlist.fm REST API (https://api.setlist.fm/docs/1.0/), which needs a free
// API key for non-commercial use, sent as the `x-api-key` header. The key is read from the
// SETLISTFM_API_KEY environment variable (a Worker secret on the MCP server).

const BASE = 'https://api.setlist.fm/rest/1.0';
const PACE_MS = 600; // stay well under setlist.fm's request rate limit

export interface SetlistArtist {
  mbid: string;
  name: string;
  disambiguation?: string;
  url?: string;
}

export interface ConcertSummary {
  date: string; // ISO yyyy-mm-dd
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
  lastPlayed: { date: string; venue: string; city: string } | null;
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let configuredKey: string | undefined;
/** Lets the host (e.g. the Cloudflare Worker) pass the key from its own environment. */
export function setSetlistApiKey(key: string | undefined): void {
  configuredKey = key || undefined;
}

function apiKey(): string {
  const key = configuredKey || process.env.SETLISTFM_API_KEY;
  if (!key) throw new Error('setlist.fm is not configured: the SETLISTFM_API_KEY secret is missing on the server.');
  return key;
}

async function sfGet(path: string, params: Record<string, string | number>, fetchImpl: typeof fetch = fetch): Promise<any> {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
  const url = `${BASE}${path}${qs ? `?${qs}` : ''}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetchImpl(url, { headers: { 'x-api-key': apiKey(), Accept: 'application/json', 'Accept-Language': 'en' } });
    if (res.status === 404) return null; // setlist.fm answers 404 for "no results"
    if (res.status === 429) { await sleep(1500 * (attempt + 1)); continue; }
    if (!res.ok) throw new Error(`setlist.fm request failed (HTTP ${res.status})`);
    return res.json();
  }
  throw new Error('setlist.fm rate limit: try again in a moment');
}

export function normalizeName(s: string): string {
  return String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
}

/** "dd-MM-yyyy" → "yyyy-mm-dd" */
export function isoDate(d: string): string {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(d || '');
  return m ? `${m[3]}-${m[2]}-${m[1]}` : d || '';
}

export async function searchSetlistArtistsData(name: string, fetchImpl: typeof fetch = fetch): Promise<SetlistArtist[]> {
  const data = await sfGet('/search/artists', { artistName: name, sort: 'relevance', p: 1 }, fetchImpl);
  const list: any[] = data?.artist ?? [];
  return list.map((a) => ({ mbid: a.mbid, name: a.name, disambiguation: a.disambiguation || undefined, url: a.url }));
}

function songsOf(setlist: any): string[] {
  const sets: any[] = setlist?.sets?.set ?? [];
  const out: string[] = [];
  for (const s of sets) {
    for (const song of s?.song ?? []) {
      if (!song || song.tape) continue; // intro/outro tapes are not played live
      const n = String(song.name || '').trim();
      if (n) out.push(n);
    }
  }
  return out;
}

function summary(s: any): ConcertSummary {
  return {
    date: isoDate(s.eventDate),
    venue: s.venue?.name ?? '',
    city: s.venue?.city?.name ?? '',
    country: s.venue?.city?.country?.code ?? '',
    songCount: songsOf(s).length,
    url: s.url,
  };
}

/**
 * Pure part: from setlists (newest first) compute the playlist-ready song selection.
 * Exported for tests.
 */
export function computeTopSongs(setlists: any[], today: string, recentN: number, topN: number) {
  const past = setlists.filter((s) => isoDate(s.eventDate) <= today);
  const upcoming = setlists.filter((s) => isoDate(s.eventDate) > today).map(summary);
  const withSongs = past.filter((s) => songsOf(s).length > 0);
  const recent = withSongs.slice(0, recentN);
  const lastRecentDate = recent.length ? isoDate(recent[recent.length - 1].eventDate) : '';
  const skippedWithoutSongs = past
    .filter((s) => songsOf(s).length === 0 && isoDate(s.eventDate) >= lastRecentDate)
    .map(summary);

  const stats = new Map<string, SongStat & { key: string }>();
  for (const s of withSongs) {
    const seenHere = new Set<string>();
    for (const name of songsOf(s)) {
      const key = normalizeName(name);
      if (seenHere.has(key)) continue; // a song repeated in one show counts once
      seenHere.add(key);
      let st = stats.get(key);
      if (!st) {
        st = { key, name, count: 0, lastPlayed: { date: isoDate(s.eventDate), venue: s.venue?.name ?? '', city: s.venue?.city?.name ?? '' }, inRecent: false };
        stats.set(key, st);
      }
      st.count++;
    }
  }
  for (const s of recent) for (const name of songsOf(s)) { const st = stats.get(normalizeName(name)); if (st) st.inRecent = true; }

  // Live order: start from the newest concert; insert songs from older ones after their predecessor.
  const order: string[] = [];
  for (const s of recent) {
    const keys = songsOf(s).map(normalizeName);
    keys.forEach((k, i) => {
      if (order.includes(k)) return;
      let insertAt = order.length;
      for (let j = i - 1; j >= 0; j--) { const p = order.indexOf(keys[j]); if (p !== -1) { insertAt = p + 1; break; } }
      order.splice(insertAt, 0, k);
    });
  }

  const byCount = [...stats.values()].sort((a, b) => b.count - a.count || (b.lastPlayed?.date ?? '').localeCompare(a.lastPlayed?.date ?? ''));
  const selectedKeys = byCount.filter((s) => s.inRecent).slice(0, topN).map((s) => s.key);
  selectedKeys.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const selectedSet = new Set(selectedKeys);
  const strip = ({ key, ...rest }: SongStat & { key: string }): SongStat => rest;
  const selected = selectedKeys.map((k) => strip(stats.get(k)!));
  const others = byCount.filter((s) => !selectedSet.has(s.key)).slice(0, 5).map(strip);

  // Do the recent concerts agree on the order of the selected songs?
  let orderDiffers = false;
  for (const s of recent) {
    const pos = songsOf(s).map(normalizeName).filter((k) => selectedSet.has(k));
    const expected = selectedKeys.filter((k) => pos.includes(k));
    if (pos.join('|') !== expected.join('|')) { orderDiffers = true; break; }
  }

  return { recent: recent.map(summary), skippedWithoutSongs, upcoming, withSongsCount: withSongs.length, selected, others, orderDiffers };
}

export async function getTopSongsData(
  artistName: string,
  options: { recentConcerts?: number; songs?: number; pages?: number; today?: string } = {},
  fetchImpl: typeof fetch = fetch,
): Promise<TopSongsResult> {
  const recentN = Math.min(Math.max(options.recentConcerts ?? 3, 1), 10);
  const topN = Math.min(Math.max(options.songs ?? 5, 1), 20);
  const pages = Math.min(Math.max(options.pages ?? 3, 1), 5);
  const today = options.today ?? new Date().toISOString().slice(0, 10);

  const artists = await searchSetlistArtistsData(artistName, fetchImpl);
  if (!artists.length) throw new Error(`No artist called "${artistName}" on setlist.fm`);
  const wanted = normalizeName(artistName);
  const artist = artists.find((a) => normalizeName(a.name) === wanted) ?? artists[0];

  const setlists: any[] = [];
  for (let p = 1; p <= pages; p++) {
    await sleep(PACE_MS);
    const data = await sfGet(`/artist/${encodeURIComponent(artist.mbid)}/setlists`, { p }, fetchImpl);
    const page: any[] = data?.setlist ?? [];
    setlists.push(...page);
    const total = Number(data?.total ?? 0), per = Number(data?.itemsPerPage ?? 20);
    if (page.length === 0 || p * per >= total) break;
  }

  const r = computeTopSongs(setlists, today, recentN, topN);
  const notes: string[] = [`Counts cover the last ${setlists.length} setlists on setlist.fm, not all-time statistics.`];
  if (r.withSongsCount === 0) notes.push('No setlist with songs was found for this artist.');
  else if (r.withSongsCount < recentN) notes.push(`Only ${r.withSongsCount} concert(s) with songs found; there is no real popularity ranking.`);
  if (normalizeName(artist.name) !== wanted) notes.push(`Closest setlist.fm match is "${artist.name}"${artist.disambiguation ? ` (${artist.disambiguation})` : ''}; check it is the right band.`);
  if (r.orderDiffers) notes.push('The recent concerts play these songs in different orders; the newest concert decides.');
  notes.push('setlist.fm data is entered by users and can have errors or gaps.');

  return {
    artist,
    otherArtists: artists.filter((a) => a.mbid !== artist.mbid).slice(0, 4),
    setlistsConsidered: setlists.length,
    concertsWithSongs: r.withSongsCount,
    recentConcerts: r.recent,
    skippedWithoutSongs: r.skippedWithoutSongs,
    upcoming: r.upcoming,
    selected: r.selected,
    others: r.others,
    orderDiffers: r.orderDiffers,
    notes,
  };
}
