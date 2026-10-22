"use strict";
// setlist.fm data for concert playlists.
// Uses the official setlist.fm REST API (https://api.setlist.fm/docs/1.0/), which needs a free
// API key for non-commercial use, sent as the `x-api-key` header. The key is read from the
// SETLISTFM_API_KEY environment variable (a Worker secret on the MCP server).
Object.defineProperty(exports, "__esModule", { value: true });
exports.setSetlistApiKey = setSetlistApiKey;
exports.normalizeName = normalizeName;
exports.isoDate = isoDate;
exports.searchSetlistArtistsData = searchSetlistArtistsData;
exports.computeTopSongs = computeTopSongs;
exports.getTopSongsData = getTopSongsData;
exports.pickUpcoming = pickUpcoming;
exports.getNextConcertData = getNextConcertData;
const BASE = 'https://api.setlist.fm/rest/1.0';
const PACE_MS = 600; // stay well under setlist.fm's request rate limit
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let configuredKey;
/** Lets the host (e.g. the Cloudflare Worker) pass the key from its own environment. */
function setSetlistApiKey(key) {
    configuredKey = key || undefined;
}
function apiKey() {
    const key = configuredKey || process.env.SETLISTFM_API_KEY;
    if (!key)
        throw new Error('setlist.fm is not configured: the SETLISTFM_API_KEY secret is missing on the server.');
    return key;
}
async function sfGet(path, params, fetchImpl = fetch) {
    const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
    const url = `${BASE}${path}${qs ? `?${qs}` : ''}`;
    for (let attempt = 0; attempt < 3; attempt++) {
        const res = await fetchImpl(url, { headers: { 'x-api-key': apiKey(), Accept: 'application/json', 'Accept-Language': 'en' } });
        if (res.status === 404)
            return null; // setlist.fm answers 404 for "no results"
        if (res.status === 429) {
            await sleep(1500 * (attempt + 1));
            continue;
        }
        if (!res.ok)
            throw new Error(`setlist.fm request failed (HTTP ${res.status})`);
        return res.json();
    }
    throw new Error('setlist.fm rate limit: try again in a moment');
}
function normalizeName(s) {
    return String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
}
/** "dd-MM-yyyy" → "yyyy-mm-dd" */
function isoDate(d) {
    const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(d || '');
    return m ? `${m[3]}-${m[2]}-${m[1]}` : d || '';
}
async function searchSetlistArtistsData(name, fetchImpl = fetch) {
    const data = await sfGet('/search/artists', { artistName: name, sort: 'relevance', p: 1 }, fetchImpl);
    const list = data?.artist ?? [];
    return list.map((a) => ({ mbid: a.mbid, name: a.name, disambiguation: a.disambiguation || undefined, url: a.url }));
}
function songsOf(setlist) {
    const sets = setlist?.sets?.set ?? [];
    const out = [];
    for (const s of sets) {
        for (const song of s?.song ?? []) {
            if (!song || song.tape)
                continue; // intro/outro tapes are not played live
            const n = String(song.name || '').trim();
            if (n)
                out.push(n);
        }
    }
    return out;
}
function summary(s) {
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
function computeTopSongs(setlists, today, recentN, topN) {
    const past = setlists.filter((s) => isoDate(s.eventDate) <= today);
    const upcoming = setlists.filter((s) => isoDate(s.eventDate) > today).map(summary);
    const withSongs = past.filter((s) => songsOf(s).length > 0);
    const recent = withSongs.slice(0, recentN);
    const lastRecentDate = recent.length ? isoDate(recent[recent.length - 1].eventDate) : '';
    const skippedWithoutSongs = past
        .filter((s) => songsOf(s).length === 0 && isoDate(s.eventDate) >= lastRecentDate)
        .map(summary);
    const stats = new Map();
    for (const s of withSongs) {
        const seenHere = new Set();
        for (const name of songsOf(s)) {
            const key = normalizeName(name);
            if (seenHere.has(key))
                continue; // a song repeated in one show counts once
            seenHere.add(key);
            let st = stats.get(key);
            if (!st) {
                st = { key, name, count: 0, lastPlayed: { date: isoDate(s.eventDate), venue: s.venue?.name ?? '', city: s.venue?.city?.name ?? '' }, inRecent: false };
                stats.set(key, st);
            }
            st.count++;
        }
    }
    for (const s of recent)
        for (const name of songsOf(s)) {
            const st = stats.get(normalizeName(name));
            if (st)
                st.inRecent = true;
        }
    // Live order: start from the newest concert; insert songs from older ones after their predecessor.
    const order = [];
    for (const s of recent) {
        const keys = songsOf(s).map(normalizeName);
        keys.forEach((k, i) => {
            if (order.includes(k))
                return;
            let insertAt = order.length;
            for (let j = i - 1; j >= 0; j--) {
                const p = order.indexOf(keys[j]);
                if (p !== -1) {
                    insertAt = p + 1;
                    break;
                }
            }
            order.splice(insertAt, 0, k);
        });
    }
    const byCount = [...stats.values()].sort((a, b) => b.count - a.count || (b.lastPlayed?.date ?? '').localeCompare(a.lastPlayed?.date ?? ''));
    const selectedKeys = byCount.filter((s) => s.inRecent).slice(0, topN).map((s) => s.key);
    selectedKeys.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    const selectedSet = new Set(selectedKeys);
    const strip = ({ key, ...rest }) => rest;
    const selected = selectedKeys.map((k) => strip(stats.get(k)));
    const others = byCount.filter((s) => !selectedSet.has(s.key)).slice(0, 5).map(strip);
    // Do the recent concerts agree on the order of the selected songs?
    let orderDiffers = false;
    for (const s of recent) {
        const pos = songsOf(s).map(normalizeName).filter((k) => selectedSet.has(k));
        const expected = selectedKeys.filter((k) => pos.includes(k));
        if (pos.join('|') !== expected.join('|')) {
            orderDiffers = true;
            break;
        }
    }
    return { recent: recent.map(summary), skippedWithoutSongs, upcoming, withSongsCount: withSongs.length, selected, others, orderDiffers };
}
async function getTopSongsData(artistName, options = {}, fetchImpl = fetch) {
    const recentN = Math.min(Math.max(options.recentConcerts ?? 3, 1), 10);
    const topN = Math.min(Math.max(options.songs ?? 5, 1), 20);
    const pages = Math.min(Math.max(options.pages ?? 3, 1), 5);
    const today = options.today ?? new Date().toISOString().slice(0, 10);
    const artists = await searchSetlistArtistsData(artistName, fetchImpl);
    if (!artists.length)
        throw new Error(`No artist called "${artistName}" on setlist.fm`);
    const wanted = normalizeName(artistName);
    const artist = artists.find((a) => normalizeName(a.name) === wanted) ?? artists[0];
    const setlists = [];
    for (let p = 1; p <= pages; p++) {
        await sleep(PACE_MS);
        const data = await sfGet(`/artist/${encodeURIComponent(artist.mbid)}/setlists`, { p }, fetchImpl);
        const page = data?.setlist ?? [];
        setlists.push(...page);
        const total = Number(data?.total ?? 0), per = Number(data?.itemsPerPage ?? 20);
        if (page.length === 0 || p * per >= total)
            break;
    }
    const r = computeTopSongs(setlists, today, recentN, topN);
    const notes = [`Counts cover the last ${setlists.length} setlists on setlist.fm, not all-time statistics.`];
    if (r.withSongsCount === 0)
        notes.push('No setlist with songs was found for this artist.');
    else if (r.withSongsCount < recentN)
        notes.push(`Only ${r.withSongsCount} concert(s) with songs found; there is no real popularity ranking.`);
    if (normalizeName(artist.name) !== wanted)
        notes.push(`Closest setlist.fm match is "${artist.name}"${artist.disambiguation ? ` (${artist.disambiguation})` : ''}; check it is the right band.`);
    if (r.orderDiffers)
        notes.push('The recent concerts play these songs in different orders; the newest concert decides.');
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
function toShow(s) {
    return {
        date: isoDate(s.eventDate),
        venue: s.venue?.name ?? '',
        venueId: s.venue?.id ?? '',
        city: s.venue?.city?.name ?? '',
        country: s.venue?.city?.country?.code ?? '',
        tour: s.tour?.name || undefined,
        url: s.url,
    };
}
/** Pure part, exported for tests: filter and order the upcoming shows. */
function pickUpcoming(setlists, today, filter = {}) {
    const city = filter.city ? normalizeName(filter.city) : '';
    const country = (filter.country || '').toUpperCase();
    return setlists
        .map(toShow)
        .filter((x) => x.date >= today)
        .filter((x) => !city || normalizeName(x.city).includes(city))
        .filter((x) => !country || x.country === country)
        .filter((x) => !filter.date || x.date === filter.date)
        .sort((a, b) => a.date.localeCompare(b.date));
}
/**
 * Finds the next upcoming show of an artist (optionally in a city/country or on a date) and the other acts that
 * have a setlist entry at the same venue on the same day. setlist.fm has no real "line-up" data, so the acts list
 * is only as complete as what users entered; their running order is unknown.
 */
async function getNextConcertData(artistName, options = {}, fetchImpl = fetch) {
    const today = options.today ?? new Date().toISOString().slice(0, 10);
    const artists = await searchSetlistArtistsData(artistName, fetchImpl);
    if (!artists.length)
        throw new Error(`No artist called "${artistName}" on setlist.fm`);
    const wanted = normalizeName(artistName);
    const artist = artists.find((a) => normalizeName(a.name) === wanted) ?? artists[0];
    const setlists = [];
    for (let p = 1; p <= 2; p++) {
        await sleep(PACE_MS);
        const data = await sfGet(`/artist/${encodeURIComponent(artist.mbid)}/setlists`, { p }, fetchImpl);
        const page = data?.setlist ?? [];
        setlists.push(...page);
        const total = Number(data?.total ?? 0), per = Number(data?.itemsPerPage ?? 20);
        if (page.length === 0 || p * per >= total)
            break;
    }
    const upcoming = pickUpcoming(setlists, today, { city: options.city, country: options.country, date: options.date });
    const notes = [];
    if (normalizeName(artist.name) !== wanted)
        notes.push(`Closest setlist.fm match is "${artist.name}"${artist.disambiguation ? ` (${artist.disambiguation})` : ''}; check it is the right band.`);
    const next = upcoming[0] ?? null;
    const sameDayActs = [];
    if (!next) {
        notes.push('No upcoming show found on setlist.fm for these filters. Tour dates are only listed when a user has entered them.');
    }
    else {
        if (next.venueId) {
            await sleep(PACE_MS);
            const [y, m, d] = next.date.split('-');
            const data = await sfGet('/search/setlists', { venueId: next.venueId, date: `${d}-${m}-${y}`, p: 1 }, fetchImpl);
            const seen = new Set([artist.mbid]);
            for (const s of data?.setlist ?? []) {
                const a = s?.artist;
                if (!a?.mbid || seen.has(a.mbid))
                    continue;
                seen.add(a.mbid);
                sameDayActs.push({ name: a.name, mbid: a.mbid, songCount: songsOf(s).length });
            }
        }
        notes.push(sameDayActs.length
            ? 'Other acts are those with a setlist entry at this venue on this day. setlist.fm does not say who plays first; the order on stage is unknown, and the list can be incomplete.'
            : 'No other acts found for this day on setlist.fm. That does not prove there are none: check the venue or ticket page for the line-up.');
    }
    return { artist, upcoming: upcoming.slice(0, 8), next, sameDayActs, notes };
}
//# sourceMappingURL=setlist.js.map