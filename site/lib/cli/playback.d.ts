import type { PlaybackInfo, PlaybackUrl } from './types';
export type { PlaybackInfo, PlaybackUrl };
export declare function playbackInfoData(trackId: string, quality: string, client: any): Promise<PlaybackInfo>;
export declare function playbackInfo(trackId: string, quality: string, json: boolean): Promise<void>;
export declare function playbackUrlData(trackId: string, quality: string, client: any): Promise<PlaybackUrl>;
export interface PlaybackAudioChunk {
    trackId: string;
    audioQuality: string;
    presentation: string;
    mimeType: string;
    segmentCount: number;
    from: number;
    count: number;
    includesInit: boolean;
    bytes: number;
    base64: string;
}
/**
 * Downloads (a range of) the DASH segments of a track on the server and returns them as base64,
 * so clients that cannot reach Tidal's CDN themselves (e.g. sandboxed pages) can play the audio.
 * Segment 1 comes with the init segment, so the chunks of one track can be concatenated in order.
 */
export declare function playbackAudioData(trackId: string, quality: string, from: number, count: number, client: any): Promise<PlaybackAudioChunk>;
export declare function playbackUrl(trackId: string, quality: string, json: boolean): Promise<void>;
export declare function playbackPlay(trackId: string, quality: string): Promise<void>;
