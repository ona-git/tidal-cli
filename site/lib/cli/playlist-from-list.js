"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalize = normalize;
exports.parseList = parseList;
exports.editDistance = editDistance;
exports.titleRelation = titleRelation;
exports.artistRelation = artistRelation;
exports.checkTracksData = checkTracksData;
exports.createPlaylistFromListData = createPlaylistFromListData;
const search_1 = require("./search");
const playlist_1 = require("./playlist");
const retry_1 = require("./retry");
/** Lower-case, strip diacritics and punctuation, collapse whitespace. */
function normalize(s) {
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
function parseList(lines) {
    const entries = [];
    const invalid = [];
    for (const rawLine of lines) {
        const raw = rawLine.trim();
        if (!raw)
            continue;
        const idx = raw.indexOf(' - ');
        if (idx <= 0 || idx + 3 >= raw.length) {
            invalid.push(raw);
            continue;
        }
        entries.push({ raw, artist: raw.slice(0, idx).trim(), title: raw.slice(idx + 3).trim() });
    }
    return { entries, invalid };
}
/** normalize() without spaces, so "X-Mal Deutschland" and "Xmal Deutschland" compare equal. */
function compact(s) {
    return normalize(s).replace(/ /g, '');
}
/** Edit distance (Levenshtein), used only on short strings such as names and titles. */
function editDistance(a, b) {
    if (a === b)
        return 0;
    if (!a.length)
        return b.length;
    if (!b.length)
        return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
        const cur = [i];
        for (let j = 1; j <= b.length; j++) {
            cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
        prev = cur;
    }
    return prev[b.length];
}
/** 1 = identical, 0 = nothing in common. */
function similarity(a, b) {
    const len = Math.max(a.length, b.length);
    return len === 0 ? 1 : 1 - editDistance(a, b) / len;
}
// Small words that set lists and catalogs often swap ("Kiss the Shadow" vs "Kiss Your Shadow").
const FILLER = new Set(['the', 'a', 'an', 'your', 'my', 'our', 'his', 'her', 'their', 'of', 'to', 'in', 'on', 'and', 'der', 'die', 'das', 'ein', 'eine', 'le', 'la', 'les', 'el', 'il']);
function coreWords(s) {
    return normalize(s).split(' ').filter((w) => w && !FILLER.has(w)).join(' ');
}
function titleRelation(wanted, found) {
    const w = normalize(wanted);
    const f = normalize(found);
    if (!w || !f)
        return 'none';
    if (w === f || compact(wanted) === compact(found))
        return 'exact';
    // Same title with a suffix such as "Remastered 2020", "Live", "Radio Edit" is accepted only as variant.
    if (f.startsWith(w + ' '))
        return 'variant';
    // Nearly the same title: only filler words differ, or a small typo in a title that is long enough.
    const cw = coreWords(wanted);
    const cf = coreWords(found);
    if (cw && cw === cf && cw.includes(' '))
        return 'fuzzy';
    const cwc = w.replace(/ /g, '');
    const cfc = f.replace(/ /g, '');
    if (Math.min(cwc.length, cfc.length) >= 8 && similarity(cwc, cfc) >= 0.85)
        return 'fuzzy';
    return 'none';
}
/**
 * 'exact' = same name after normalizing; 'close' = the same name spelled differently on Tidal:
 * hyphens or spaces ("X-Mal" / "XMAL"), a leading "The", or a letter off in a long name ("Poupée Fabrikk" / "Pouppée Fabrikk").
 */
function artistRelation(wanted, found) {
    const w = normalize(wanted);
    const f = normalize(found);
    if (!w || !f)
        return 'none';
    if (w === f)
        return 'exact';
    const strip = (x) => x.replace(/^the /, '').replace(/ /g, '');
    const wc = strip(w);
    const fc = strip(f);
    if (wc === fc)
        return 'close';
    // A typo is tolerated only in long names and never in digits ("Front 242" is not "Front 424").
    if (wc.replace(/\D/g, '') !== fc.replace(/\D/g, ''))
        return 'none';
    const shorter = Math.min(wc.length, fc.length);
    const d = editDistance(wc, fc);
    if ((shorter >= 10 && d <= 1) || (shorter >= 16 && d <= 2))
        return 'close';
    return 'none';
}
function artistMatch(wanted, found) {
    let best = 'none';
    for (const a of found) {
        const r = artistRelation(wanted, a);
        if (r === 'exact')
            return r;
        if (r === 'close')
            best = r;
    }
    return best;
}
const TITLE_SCORE = { exact: 30, variant: 20, fuzzy: 10, none: 0 };
/**
 * One call for up to 20 tracks: GET /tracks?filter[id]=...&include=artists,usageRules
 * `playable` = TIDAL's usage rules for the user's country allow STREAM for subscribers (or free tier);
 * falls back to the deprecated `availability` attribute; null when neither is present.
 */
async function getTrackArtistsBatch(ids, client, countryCode) {
    const out = new Map();
    if (ids.length === 0)
        return out;
    const { data, error } = await (0, retry_1.getWithRetry)(client, '/tracks', {
        params: { query: { countryCode, 'filter[id]': [ids.join(',')], include: ['artists', 'usageRules'] } },
    });
    if (error || !data) {
        throw new Error(`Failed to get tracks — ${JSON.stringify(error)}`);
    }
    const artistNames = new Map();
    const rulesById = new Map();
    for (const inc of data.included ?? []) {
        if (inc.type === 'artists')
            artistNames.set(inc.id, inc.attributes?.name ?? inc.id);
        if (inc.type === 'usageRules')
            rulesById.set(inc.id, inc.attributes ?? {});
    }
    const rows = Array.isArray(data.data) ? data.data : [data.data];
    for (const row of rows) {
        if (!row?.id)
            continue;
        const refs = row.relationships?.artists?.data ?? [];
        const ruleData = row.relationships?.usageRules?.data;
        const ruleRefs = Array.isArray(ruleData) ? ruleData : ruleData ? [ruleData] : [];
        const rules = ruleRefs.map((r) => rulesById.get(r.id)).filter(Boolean);
        const forCountry = rules.filter((r) => !r.countryCode || r.countryCode === countryCode);
        let playable = null;
        if (forCountry.length > 0) {
            playable = forCountry.some((r) => (r.subscription ?? []).includes('STREAM') || (r.free ?? []).includes('STREAM'));
        }
        else if (Array.isArray(row.attributes?.availability)) {
            playable = row.attributes.availability.includes('STREAM');
        }
        out.set(row.id, {
            title: row.attributes?.title ?? 'Unknown',
            artists: refs.map((r) => artistNames.get(r.id)).filter((n) => !!n),
            playable,
        });
    }
    return out;
}
/** Availability check for known track ids (e.g. to see why a track is greyed out). */
async function checkTracksData(trackIds, client, countryCode) {
    const result = [];
    for (let i = 0; i < trackIds.length; i += 20) {
        const chunk = trackIds.slice(i, i + 20);
        const infos = await getTrackArtistsBatch(chunk, client, countryCode);
        for (const id of chunk) {
            const info = infos.get(id);
            result.push({ trackId: id, title: info?.title ?? 'not found', artists: info?.artists ?? [], playable: info ? info.playable : null, country: countryCode });
        }
    }
    return result;
}
async function findTrack(entry, client, countryCode) {
    // 1) artist + title, 2) title alone: Tidal often spells the artist differently, so the second search
    //    shows which artists have this title, and artistRelation() decides whether one of them is the wanted band.
    const queries = [`${entry.artist} ${entry.title}`, entry.title];
    const seen = new Map();
    let best;
    let blocked; // match that exists but cannot be streamed in this country
    for (const query of queries) {
        const results = await (0, search_1.searchData)('track', query, client, countryCode);
        // Only look up artists for tracks whose title is plausibly the wanted one (keeps API calls low).
        const plausible = results
            .filter((r) => titleRelation(entry.title, r.name) !== 'none' && !seen.has(r.id))
            .slice(0, 20);
        const infos = await getTrackArtistsBatch(plausible.map((r) => r.id), client, countryCode);
        for (const r of plausible) {
            const info = infos.get(r.id);
            if (!info)
                continue;
            seen.set(r.id, info);
            const art = artistMatch(entry.artist, info.artists);
            if (art === 'none')
                continue;
            const rel = titleRelation(entry.title, info.title);
            if (rel === 'none')
                continue;
            // A fuzzy title is only trusted with the exact artist name, so two guesses never stack up.
            if (rel === 'fuzzy' && art !== 'exact')
                continue;
            const score = TITLE_SCORE[rel] + (art === 'exact' ? 5 : 0);
            const hit = { line: entry.raw, trackId: r.id, tidalTitle: info.title, tidalArtists: info.artists, match: rel, playable: info.playable };
            if (info.playable === false) {
                if (!blocked || score > blocked.score)
                    blocked = { hit, score };
                continue;
            }
            if (!best || score > best.score)
                best = { hit, score };
        }
        // Exact title or a version of it: good enough, skip the title-only search.
        if (best && best.score >= TITLE_SCORE.variant)
            return { hit: best.hit, candidates: [] };
        // Keep a few unfiltered results (title only) as suggestions in case nothing matched.
        for (const r of results.slice(0, 5)) {
            if (!seen.has(r.id))
                seen.set(r.id, { title: r.name, artists: [], playable: null });
        }
    }
    if (best)
        return { hit: best.hit, candidates: [] };
    if (blocked)
        return { hit: blocked.hit, candidates: [] };
    const candidates = [...seen.entries()].slice(0, 5).map(([trackId, v]) => ({ trackId, title: v.title, artists: v.artists }));
    return { candidates };
}
/**
 * Takes lines in the form "Artist - Title", resolves each to a Tidal track requiring the artist to
 * match (spelling variants allowed), creates one playlist in list order and reports what could not be found.
 * With dryRun = true nothing is created.
 */
async function createPlaylistFromListData(name, lines, client, countryCode, options = {}) {
    const { entries, invalid } = parseList(lines);
    const matched = [];
    const notFound = [];
    const duplicates = [];
    const unplayable = [];
    const usedIds = new Set();
    for (const entry of entries) {
        if (matched.length + notFound.length + duplicates.length > 0)
            await (0, retry_1.sleep)(250); // gentle pacing against API rate limits
        let found;
        try {
            found = await findTrack(entry, client, countryCode);
        }
        catch (e) {
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
        if (found.hit.playable === false)
            unplayable.push(entry.raw);
    }
    const result = {
        dryRun: !!options.dryRun,
        matched,
        unplayable,
        notFound,
        duplicates,
        invalidLines: invalid,
    };
    if (options.dryRun || matched.length === 0)
        return result;
    const created = await (0, playlist_1.createPlaylistData)(name, options.description ?? '', client);
    const CHUNK = 20; // sequential chunks keep the original order
    for (let i = 0; i < matched.length; i += CHUNK) {
        const chunk = matched.slice(i, i + CHUNK).map((m) => ({ id: m.trackId, type: 'tracks' }));
        const { error } = await client.POST('/playlists/{id}/relationships/items', {
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
//# sourceMappingURL=playlist-from-list.js.map