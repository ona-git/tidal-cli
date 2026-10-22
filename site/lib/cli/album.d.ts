import type { AlbumInfo, AlbumResult } from './types';
export type { AlbumInfo, AlbumResult };
export declare function getAlbumInfoData(albumId: string, client: any, countryCode: string): Promise<AlbumInfo>;
export interface AlbumTrack {
    position: number;
    trackId: string;
    title?: string;
    version?: string | null;
    duration: string;
    explicit?: boolean;
    volume?: number;
}
/** Lists the tracks of an album in order (title, length, explicit flag). */
export declare function getAlbumTracksData(albumId: string, client: any, countryCode: string): Promise<AlbumTrack[]>;
export declare function getAlbumInfo(albumId: string, json: boolean): Promise<void>;
export declare function getAlbumByBarcodeData(barcode: string, client: any, countryCode: string): Promise<AlbumResult[]>;
export declare function getAlbumByBarcode(barcode: string, json: boolean): Promise<void>;
