// Minimalne typy i ładowanie YouTube IFrame Player API.
// https://developers.google.com/youtube/iframe_api_reference

export const YTState = {
  Unstarted: -1,
  Ended: 0,
  Playing: 1,
  Paused: 2,
  Buffering: 3,
  Cued: 5,
} as const;

export interface YTPlayer {
  loadPlaylist(args: { list: string; listType: 'playlist'; index?: number }): void;
  loadVideoById(videoId: string): void;
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  nextVideo(): void;
  playVideoAt(index: number): void;
  setVolume(volume: number): void;
  unMute(): void;
  setShuffle(on: boolean): void;
  setLoop(on: boolean): void;
  getPlaylist(): string[] | null;
  getVideoData(): { title?: string; video_id?: string };
  destroy(): void;
}

interface YTPlayerOptions {
  width?: string | number;
  height?: string | number;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: () => void;
    onStateChange?: (e: { data: number }) => void;
    onError?: (e: { data: number }) => void;
  };
}

interface YTNamespace {
  Player: new (el: HTMLElement, opts: YTPlayerOptions) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let loading: Promise<YTNamespace> | null = null;

/** Wstrzykuje skrypt API tylko raz. Wymaga internetu. */
export function loadYouTubeApi(timeoutMs = 15000): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (loading) return loading;

  loading = new Promise<YTNamespace>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      loading = null;
      reject(new Error('Could not load YouTube – check your internet connection.'));
    }, timeoutMs);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      window.clearTimeout(timer);
      if (window.YT) resolve(window.YT);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => {
      window.clearTimeout(timer);
      loading = null;
      script.remove();
      reject(new Error('Could not load YouTube – check your internet connection.'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/** Kody błędów odtwarzacza → komunikat dla DM-a. */
export function describeYouTubeError(code: number): string {
  switch (code) {
    case 2:
      return 'Invalid YouTube link.';
    case 5:
      return 'YouTube player error.';
    case 100:
      return 'The video does not exist or is private.';
    case 101:
    case 150:
      return 'The owner has blocked playback of this video outside YouTube.';
    default:
      return `YouTube error (${code}).`;
  }
}
