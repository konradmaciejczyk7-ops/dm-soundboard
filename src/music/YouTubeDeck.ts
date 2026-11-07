import { CancelledError, fadeShape, type Deck } from './Deck';
import { describeYouTubeError, loadYouTubeApi, YTState, type YTPlayer } from './youtubeApi';
import { getYouTubeHost } from './youtubeHost';

export interface YouTubeStartOptions {
  playlistId?: string;
  videoId?: string;
  oneShot: boolean;
  shuffle: boolean;
}

const TICK_MS = 50;
const START_TIMEOUT_MS = 20000;
const MAX_ERRORS_IN_ROW = 10;

interface Pending {
  resolve: () => void;
  reject: (err: Error) => void;
  timer: number;
}

/**
 * Odtwarzacz YouTube (iframe). Dźwięk z iframe'a nie przechodzi przez Web Audio,
 * więc głośność liczymy sami co 50 ms: poziom fade'u × gain szyny Muzyka × ducking × master
 * (czytane prosto z AudioParamów) i ustawiamy przez player.setVolume().
 */
export class YouTubeDeck implements Deck {
  readonly kind = 'youtube';
  private readonly el = document.createElement('div');
  private player: YTPlayer | null = null;
  private ready: Promise<YTPlayer> | null = null;
  private token = 0;
  private active = false;
  private pending: Pending | null = null;
  private stopTimer: number | undefined;
  private ticker: number | undefined;

  private level = 0;
  private fade: { from: number; to: number; t0: number; dur: number } | null = null;
  private lastVolume = -1;

  private oneShot = false;
  private isPlaylist = false;
  private wantShuffle = false;
  private shuffledOnce = false;
  private endedFired = false;
  private errorsInRow = 0;

  onTitle?: (title: string) => void;
  onEnded?: () => void;
  onError?: (message: string) => void;

  constructor(private readonly externalGain: () => number) {
    this.el.className = 'yt-deck';
  }

  async start({ playlistId, videoId, oneShot, shuffle }: YouTubeStartOptions): Promise<void> {
    this.stopNow();
    const token = this.token;
    if (!playlistId && !videoId) throw new Error('Brak linku YouTube.');
    const player = await this.ensurePlayer();
    if (token !== this.token) throw new CancelledError();

    this.active = true;
    this.oneShot = oneShot;
    this.isPlaylist = Boolean(playlistId);
    this.wantShuffle = shuffle && this.isPlaylist;
    this.shuffledOnce = false;
    this.endedFired = false;
    this.errorsInRow = 0;
    this.level = 0;
    this.fade = null;
    this.lastVolume = -1;
    player.setVolume(0);
    player.unMute();
    this.startTicker();

    const playing = new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => this.settle(new Error('YouTube nie zaczął grać w ciągu 20 s.')), START_TIMEOUT_MS);
      this.pending = { resolve, reject, timer };
    });
    if (playlistId) player.loadPlaylist({ list: playlistId, listType: 'playlist', index: 0 });
    else if (videoId) player.loadVideoById(videoId);
    await playing;
  }

  fadeTo(level: number, seconds: number): void {
    window.clearTimeout(this.stopTimer);
    const now = performance.now();
    this.fade = { from: this.levelAt(now), to: level, t0: now, dur: seconds * 1000 };
  }

  fadeOutAndStop(seconds: number): void {
    const token = this.token;
    this.fadeTo(0, seconds);
    this.stopTimer = window.setTimeout(() => {
      if (token === this.token) this.stopNow();
    }, seconds * 1000 + 80);
  }

  stopNow(): void {
    this.token++;
    this.active = false;
    window.clearTimeout(this.stopTimer);
    this.settle(new CancelledError());
    this.fade = null;
    this.level = 0;
    this.lastVolume = -1;
    if (this.player) {
      this.player.setVolume(0);
      this.player.stopVideo();
    }
    this.stopTicker();
    this.setVisible(false);
  }

  next(): void {
    if (!this.player || !this.active) return;
    if (this.isPlaylist) this.player.nextVideo();
    else this.player.seekTo(0, true);
  }

  setVisible(visible: boolean): void {
    this.el.classList.toggle('is-visible', visible);
  }

  private ensurePlayer(): Promise<YTPlayer> {
    this.ready ??= (async () => {
      const [YT, host] = await Promise.all([loadYouTubeApi(), getYouTubeHost()]);
      host.appendChild(this.el);
      // YT podmienia ten element na <iframe>, dlatego to osobne dziecko, a nie sam this.el.
      const mount = document.createElement('div');
      this.el.appendChild(mount);
      return new Promise<YTPlayer>((resolve) => {
        const player = new YT.Player(mount, {
          width: '100%',
          height: '100%',
          playerVars: { autoplay: 0, controls: 1, rel: 0, playsinline: 1, iv_load_policy: 3, origin: location.origin },
          events: {
            onReady: () => {
              this.player = player;
              resolve(player);
            },
            onStateChange: (e) => this.handleState(e.data),
            onError: (e) => this.handleError(e.data),
          },
        });
      });
    })().catch((err: unknown) => {
      this.ready = null;
      throw err;
    });
    return this.ready;
  }

  private handleState(state: number): void {
    const player = this.player;
    if (!this.active || !player) return;

    if (state === YTState.Playing) {
      // W trybie „jeden utwór” YouTube sam włącza kolejny film z playlisty – zatrzymujemy go.
      if (this.oneShot && this.endedFired) {
        player.pauseVideo();
        return;
      }
      this.errorsInRow = 0;
      if (this.isPlaylist) player.setLoop(!this.oneShot);
      // Losowa kolejność: włączamy shuffle i od razu skaczemy na losowy utwór (deck jest jeszcze wyciszony).
      if (this.wantShuffle && !this.shuffledOnce) {
        this.shuffledOnce = true;
        player.setShuffle(true);
        const n = player.getPlaylist()?.length ?? 0;
        if (n > 1) {
          player.playVideoAt(1 + Math.floor(Math.random() * (n - 1)));
          return;
        }
      }
      this.onTitle?.(player.getVideoData().title || 'YouTube');
      this.settle();
    } else if (state === YTState.Ended) {
      if (this.oneShot) {
        if (!this.endedFired) {
          this.endedFired = true;
          this.onEnded?.();
        }
      } else if (!this.isPlaylist) {
        // Pojedynczy film gra w pętli.
        player.seekTo(0, true);
        player.playVideo();
      }
    }
  }

  private handleError(code: number): void {
    if (!this.active) return;
    const message = describeYouTubeError(code);
    // W playliście pomijamy filmy, których nie da się osadzić.
    if (this.isPlaylist && ++this.errorsInRow < MAX_ERRORS_IN_ROW) {
      console.warn(`[music] ${message} – pomijam utwór.`);
      this.player?.nextVideo();
      return;
    }
    if (this.pending) this.settle(new Error(message));
    else this.onError?.(message);
  }

  private settle(err?: Error): void {
    const p = this.pending;
    if (!p) return;
    this.pending = null;
    window.clearTimeout(p.timer);
    if (err) p.reject(err);
    else p.resolve();
  }

  private levelAt(now: number): number {
    const f = this.fade;
    if (!f) return this.level;
    const t = f.dur > 0 ? (now - f.t0) / f.dur : 1;
    if (t >= 1) {
      this.level = f.to;
      this.fade = null;
      return this.level;
    }
    return fadeShape(f.from, f.to, t);
  }

  private applyVolume(): void {
    if (!this.player) return;
    const gain = this.levelAt(performance.now()) * this.externalGain();
    const volume = Math.round(100 * Math.min(1, Math.max(0, gain)));
    if (volume !== this.lastVolume) {
      this.player.setVolume(volume);
      this.lastVolume = volume;
    }
  }

  private startTicker(): void {
    this.ticker ??= window.setInterval(() => this.applyVolume(), TICK_MS);
  }

  private stopTicker(): void {
    window.clearInterval(this.ticker);
    this.ticker = undefined;
  }
}
