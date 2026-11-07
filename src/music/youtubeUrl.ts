export interface YouTubeRef {
  playlistId?: string;
  videoId?: string;
}

const VIDEO_ID = /^[\w-]{11}$/;
const PLAYLIST_ID = /^(PL|UU|LL|RD|OL|FL|OLAK5uy_)[\w-]{10,}$/;
const HOSTS = new Set(['youtube.com', 'youtu.be', 'youtube-nocookie.com']);

/**
 * Rozpoznaje link do playlisty lub filmu (youtube.com, youtu.be, music.youtube.com,
 * /embed/, /shorts/) albo samo ID. Zwraca null, gdy to nie YouTube.
 */
export function parseYouTubeUrl(input: string): YouTubeRef | null {
  const s = input.trim();
  if (!s) return null;
  if (PLAYLIST_ID.test(s)) return { playlistId: s };
  if (VIDEO_ID.test(s)) return { videoId: s };

  let url: URL;
  try {
    url = new URL(s.includes('://') ? s : `https://${s}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, '');
  if (!HOSTS.has(host)) return null;

  const playlistId = url.searchParams.get('list') || undefined;
  let videoId = url.searchParams.get('v') || undefined;
  if (host === 'youtu.be') videoId = url.pathname.slice(1).split('/')[0] || undefined;
  const path = /^\/(?:embed|shorts|live)\/([\w-]{11})/.exec(url.pathname);
  if (path) videoId = path[1];
  if (videoId && !VIDEO_ID.test(videoId)) videoId = undefined;

  if (!playlistId && !videoId) return null;
  return { ...(playlistId && { playlistId }), ...(videoId && { videoId }) };
}
