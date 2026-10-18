import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../search', () => ({ searchData: vi.fn() }));
vi.mock('../playlist', () => ({ createPlaylistData: vi.fn() }));

import { searchData } from '../search';
import { createPlaylistData } from '../playlist';
import { normalize, parseList, createPlaylistFromListData } from '../playlist-from-list';

const tracks: Record<string, { title: string; artists: string[] }> = {
  '1': { title: 'Vigil', artists: ['Fyrnask'] },
  '2': { title: 'Vigil', artists: ['Someone Else'] },
  '3': { title: 'Jarðeldr', artists: ['Fyrnask'] },
  '4': { title: 'Wretched (Remastered 2020)', artists: ['Final Dose'] },
};

const client = {
  // Batched lookup: GET /tracks?filter[id]=a,b,c&include=artists
  GET: vi.fn(async (_path: string, opts: any) => {
    const ids: string[] = opts.params.query['filter[id]'][0].split(',');
    return {
      data: {
        data: ids.map((id) => ({
          id,
          attributes: { title: tracks[id].title },
          relationships: { artists: { data: tracks[id].artists.map((_, i) => ({ id: `${id}a${i}` })) } },
        })),
        included: ids.flatMap((id) => tracks[id].artists.map((a, i) => ({ type: 'artists', id: `${id}a${i}`, attributes: { name: a } }))),
      },
      response: { status: 200 },
    };
  }),
  POST: vi.fn(async () => ({ data: {} })),
};

beforeEach(() => {
  vi.clearAllMocks();
  (createPlaylistData as any).mockResolvedValue({ id: 'PL1', name: 'Test', description: '' });
  (searchData as any).mockImplementation(async (_t: string, q: string) => {
    const all = Object.entries(tracks).map(([id, t]) => ({ id, type: 'track', name: t.title }));
    const ql = normalize(q);
    return all.filter((r) => ql.includes(normalize(r.name).split(' ')[0]));
  });
});

describe('normalize', () => {
  it('strips diacritics and special letters', () => {
    expect(normalize('Jarðeldr')).toBe('jardeldr');
    expect(normalize('Hliðvera')).toBe('hlidvera');
    expect(normalize('  Wolves   in the Throne Room ')).toBe('wolves in the throne room');
  });
});

describe('parseList', () => {
  it('splits on the first " - " and reports invalid lines', () => {
    const { entries, invalid } = parseList(['Fyrnask - Vigil', 'Band - Song - Live', 'no separator', '']);
    expect(entries.map((e) => [e.artist, e.title])).toEqual([['Fyrnask', 'Vigil'], ['Band', 'Song - Live']]);
    expect(invalid).toEqual(['no separator']);
  });
});

describe('createPlaylistFromListData', () => {
  it('requires the artist to match, ignoring diacritics', async () => {
    const r = await createPlaylistFromListData('Test', ['Fyrnask - Vigil', 'Fyrnask - Jardeldr'], client, 'DE');
    expect(r.matched.map((m) => m.trackId)).toEqual(['1', '3']);
    expect(r.notFound).toEqual([]);
    expect(r.playlist?.url).toBe('https://tidal.com/playlist/PL1');
    expect(client.POST).toHaveBeenCalledTimes(1);
  });

  it('accepts a "(Remastered)" suffix as variant and keeps list order', async () => {
    const r = await createPlaylistFromListData('Test', ['Final Dose - Wretched', 'Fyrnask - Vigil'], client, 'DE');
    expect(r.matched.map((m) => [m.trackId, m.match])).toEqual([['4', 'variant'], ['1', 'exact']]);
  });

  it('reports not found when only another artist has the title', async () => {
    const r = await createPlaylistFromListData('Test', ['Nobody - Vigil'], client, 'DE');
    expect(r.matched).toEqual([]);
    expect(r.notFound).toHaveLength(1);
    expect(createPlaylistData).not.toHaveBeenCalled();
  });

  it('does not create anything on dryRun and dedupes repeated tracks', async () => {
    const r = await createPlaylistFromListData('Test', ['Fyrnask - Vigil', 'Fyrnask - Vigil'], client, 'DE', { dryRun: true });
    expect(r.matched).toHaveLength(1);
    expect(r.duplicates).toEqual(['Fyrnask - Vigil']);
    expect(r.playlist).toBeUndefined();
    expect(createPlaylistData).not.toHaveBeenCalled();
  });
});
