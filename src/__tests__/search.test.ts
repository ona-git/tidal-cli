import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('../auth', () => ({
  getApiClient: vi.fn(),
  getCountryCode: vi.fn().mockResolvedValue('US'),
}));

import { getApiClient, getCountryCode } from '../auth';
import { search, searchSuggestions } from '../search';

const mockClient = {
  GET: vi.fn(),
  POST: vi.fn(),
  PATCH: vi.fn(),
  DELETE: vi.fn(),
};

let output: string[] = [];
let errorOutput: string[] = [];

beforeEach(() => {
  output = [];
  errorOutput = [];
  vi.spyOn(console, 'log').mockImplementation((...args) => output.push(args.join(' ')));
  vi.spyOn(console, 'error').mockImplementation((...args) => errorOutput.push(args.join(' ')));
  vi.spyOn(process, 'exit').mockImplementation((code) => {
    throw new Error(`process.exit(${code})`);
  });
  (getApiClient as any).mockResolvedValue(mockClient);
  (getCountryCode as any).mockResolvedValue('US');
  vi.clearAllMocks();
  (getApiClient as any).mockResolvedValue(mockClient);
  (getCountryCode as any).mockResolvedValue('US');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('search request format', () => {
  it('sends the term as filter[query] to GET /searchResults', async () => {
    mockClient.GET.mockResolvedValue({ data: { included: [] } });
    await search('track', 'Fyrnask Vigil', true);
    const [path, opts] = mockClient.GET.mock.calls[0];
    expect(path).toBe('/searchResults');
    expect(opts.params.query['filter[query]']).toBe('Fyrnask Vigil');
    expect(opts.params.path).toBeUndefined();
  });
});

describe('search', () => {
  describe('artist search', () => {
    it('returns artist results sorted by popularity', async () => {
      mockClient.GET.mockResolvedValue({
        data: {
          included: [
            { id: 'a1', type: 'artists', attributes: { name: 'Low Pop', popularity: 30 } },
            { id: 'a2', type: 'artists', attributes: { name: 'High Pop', popularity: 90 } },
            { id: 'a3', type: 'artists', attributes: { name: 'Mid Pop', popularity: 60 } },
          ],
        },
      });

      await search('artist', 'test', false);

      // Should be sorted by popularity descending
      expect(output.some((l) => l.includes('[a2] High Pop'))).toBe(true);
      const highIdx = output.findIndex((l) => l.includes('[a2]'));
      const midIdx = output.findIndex((l) => l.includes('[a3]'));
      const lowIdx = output.findIndex((l) => l.includes('[a1]'));
      expect(highIdx).toBeLessThan(midIdx);
      expect(midIdx).toBeLessThan(lowIdx);
    });

    it('outputs JSON for artist search', async () => {
      mockClient.GET.mockResolvedValue({
        data: {
          included: [
            { id: 'a1', type: 'artists', attributes: { name: 'Radiohead', popularity: 85 } },
          ],
        },
      });

      await search('artist', 'radiohead', true);

      const parsed = JSON.parse(output.join(''));
      expect(parsed).toHaveLength(1);
      expect(parsed[0]).toEqual({
        id: 'a1',
        type: 'artist',
        name: 'Radiohead',
        extra: { popularity: 85 },
      });
    });
  });

  describe('album search', () => {
    it('returns album results (not sorted by popularity)', async () => {
      mockClient.GET.mockResolvedValue({
        data: {
          included: [
            {
              id: 'alb1',
              type: 'albums',
              attributes: {
                title: 'OK Computer',
                albumType: 'ALBUM',
                numberOfItems: 12,
                releaseDate: '1997-06-16',
                duration: 'PT53M21S',
              },
            },
            {
              id: 'alb2',
              type: 'albums',
              attributes: {
                title: 'Kid A',
                albumType: 'ALBUM',
                numberOfItems: 10,
                releaseDate: '2000-10-02',
                duration: 'PT49M57S',
              },
            },
          ],
        },
      });

      await search('album', 'radiohead', false);

      // Albums maintain original order (not sorted by popularity)
      const alb1Idx = output.findIndex((l) => l.includes('[alb1]'));
      const alb2Idx = output.findIndex((l) => l.includes('[alb2]'));
      expect(alb1Idx).toBeLessThan(alb2Idx);
      expect(output.some((l) => l.includes('OK Computer'))).toBe(true);
    });
  });

  describe('track search', () => {
    it('returns track results sorted by popularity', async () => {
      mockClient.GET.mockResolvedValue({
        data: {
          included: [
            {
              id: 't1',
              type: 'tracks',
              attributes: { title: 'Creep', duration: 'PT3M56S', explicit: false, isrc: 'GBAYE9200070', popularity: 80 },
            },
            {
              id: 't2',
              type: 'tracks',
              attributes: { title: 'Karma Police', duration: 'PT4M21S', explicit: false, isrc: 'GBAYE9700100', popularity: 95 },
            },
          ],
        },
      });

      await search('track', 'radiohead', false);

      const t2Idx = output.findIndex((l) => l.includes('[t2]'));
      const t1Idx = output.findIndex((l) => l.includes('[t1]'));
      expect(t2Idx).toBeLessThan(t1Idx);
    });
  });

  describe('video search', () => {
    it('returns video results', async () => {
      mockClient.GET.mockResolvedValue({
        data: {
          included: [
            {
              id: 'v1',
              type: 'videos',
              attributes: { title: 'Live Video', duration: 'PT5M12S', explicit: false, popularity: 70 },
            },
          ],
        },
      });

      await search('video', 'live', false);

      expect(output.some((l) => l.includes('[v1] Live Video'))).toBe(true);
    });
  });

  describe('playlist search', () => {
    it('returns playlist results (not sorted by popularity)', async () => {
      mockClient.GET.mockResolvedValue({
        data: {
          included: [
            {
              id: 'p1',
              type: 'playlists',
              attributes: { name: 'Chill Vibes', numberOfItems: 25, description: 'Relaxing tunes' },
            },
          ],
        },
      });

      await search('playlist', 'chill', false);

      expect(output.some((l) => l.includes('[p1] Chill Vibes'))).toBe(true);
    });
  });

  describe('empty results', () => {
    it('shows no results message for empty included', async () => {
      mockClient.GET.mockResolvedValue({
        data: { included: [] },
      });

      await search('artist', 'nonexistent', false);

      expect(output.some((l) => l.includes('No artists found for "nonexistent"'))).toBe(true);
    });

    it('outputs empty JSON array for empty results', async () => {
      mockClient.GET.mockResolvedValue({
        data: { included: [] },
      });

      await search('track', 'nonexistent', true);

      const parsed = JSON.parse(output.join(''));
      expect(parsed).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('exits on API error', async () => {
      mockClient.GET.mockResolvedValue({
        data: null,
        error: { status: 401, detail: 'Unauthorized' },
      });

      await expect(search('artist', 'test', false)).rejects.toThrow('process.exit(1)');
      expect(errorOutput.some((l) => l.includes('Search failed'))).toBe(true);
    });
  });
});

describe('searchSuggestions', () => {
  it('returns suggestions and direct hits', async () => {
    mockClient.GET.mockResolvedValue({
      data: {
        data: {
          attributes: {
            suggestions: [
              { query: 'radiohead' },
              { query: 'radio ga ga' },
            ],
          },
        },
        included: [
          { id: 'a1', type: 'artists', attributes: { name: 'Radiohead' } },
          { id: 't1', type: 'tracks', attributes: { title: 'Radio' } },
        ],
      },
    });

    await searchSuggestions('radio', false);

    expect(output.some((l) => l.includes('radiohead'))).toBe(true);
    expect(output.some((l) => l.includes('radio ga ga'))).toBe(true);
    expect(output.some((l) => l.includes('[a1]'))).toBe(true);
    expect(output.some((l) => l.includes('[t1]'))).toBe(true);
  });

  it('outputs JSON for suggestions', async () => {
    mockClient.GET.mockResolvedValue({
      data: {
        data: {
          attributes: {
            suggestions: [{ query: 'daft punk' }],
          },
        },
        included: [
          { id: 'a1', type: 'artists', attributes: { name: 'Daft Punk' } },
        ],
      },
    });

    await searchSuggestions('daft', true);

    const parsed = JSON.parse(output.join(''));
    expect(parsed.suggestions).toEqual(['daft punk']);
    expect(parsed.directHits).toHaveLength(1);
    expect(parsed.directHits[0].name).toBe('Daft Punk');
  });

  it('shows no suggestions message for empty results', async () => {
    mockClient.GET.mockResolvedValue({
      data: {
        data: { attributes: { suggestions: [] } },
        included: [],
      },
    });

    await searchSuggestions('zzzznonexistent', false);

    expect(output.some((l) => l.includes('No suggestions found'))).toBe(true);
  });

  it('exits on API error', async () => {
    mockClient.GET.mockResolvedValue({
      data: null,
      error: { status: 500 },
    });

    await expect(searchSuggestions('test', false)).rejects.toThrow('process.exit(1)');
  });
});
