import { rampTo } from '../audio/gain';
import { CancelledError, shuffled, type Deck } from './Deck';

export interface LocalStartOptions {
  files: string[];
  oneShot: boolean;
  shuffle: boolean;
}

/**
 * Lokalne pliki muzyczne przez <audio> + MediaElementSource: plik jest strumieniowany
 * (bez dekodowania całości do RAM), a dźwięk idzie przez graf Web Audio – więc działa
 * ducking, suwak Muzyka i w przyszłości wysyłka do bota.
 */
export class LocalDeck implements Deck {
  readonly kind = 'local';
  private readonly audio = new Audio();
  private readonly gain: GainNode;
  private queue: string[] = [];
  private index = 0;
  private oneShot = false;
  private reshuffle = false;
  private token = 0;
  private stopTimer: number | undefined;

  onTitle?: (title: string) => void;
  onEnded?: () => void;
  onError?: (message: string) => void;

  constructor(
    private readonly ctx: AudioContext,
    output: AudioNode,
  ) {
    this.audio.preload = 'auto';
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    ctx.createMediaElementSource(this.audio).connect(this.gain).connect(output);
    this.audio.addEventListener('ended', () => {
      if (this.oneShot) this.onEnded?.();
      else void this.advance(this.token).catch(() => undefined);
    });
  }

  async start({ files, oneShot, shuffle }: LocalStartOptions): Promise<void> {
    this.stopNow();
    const token = this.token;
    if (files.length === 0) throw new Error('Playlista jest pusta – wrzuć pliki do public/sounds/music/<nazwa>/.');
    this.queue = shuffle ? shuffled(files) : [...files];
    this.reshuffle = shuffle;
    this.oneShot = oneShot;
    this.index = 0;
    await this.playFrom(token, 0);
  }

  next(): void {
    void this.advance(this.token).catch((err: unknown) => {
      if (!(err instanceof CancelledError)) this.onError?.(err instanceof Error ? err.message : String(err));
    });
  }

  fadeTo(level: number, seconds: number): void {
    window.clearTimeout(this.stopTimer);
    rampTo(this.gain.gain, level, seconds, this.ctx);
  }

  fadeOutAndStop(seconds: number): void {
    const token = this.token;
    this.fadeTo(0, seconds);
    this.stopTimer = window.setTimeout(() => {
      if (token === this.token) this.stopNow();
    }, seconds * 1000 + 50);
  }

  stopNow(): void {
    this.token++;
    window.clearTimeout(this.stopTimer);
    rampTo(this.gain.gain, 0, 0, this.ctx);
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
  }

  setVisible(): void {
    // lokalne pliki nie mają obrazu
  }

  private async advance(token: number): Promise<void> {
    let i = this.index + 1;
    if (i >= this.queue.length) {
      i = 0;
      // Nowa kolejność po każdym przejściu całej playlisty, ale bez powtórki ostatniego utworu na starcie.
      if (this.reshuffle && this.queue.length > 1) {
        const last = this.queue[this.queue.length - 1];
        do this.queue = shuffled(this.queue);
        while (this.queue[0] === last);
      }
    }
    await this.playFrom(token, i);
  }

  /** Gra utwór `i`; zepsute pliki pomija (najwyżej jedno okrążenie playlisty). */
  private async playFrom(token: number, start: number): Promise<void> {
    let lastError: unknown;
    for (let attempt = 0; attempt < this.queue.length; attempt++) {
      if (token !== this.token) throw new CancelledError();
      const i = (start + attempt) % this.queue.length;
      this.index = i;
      this.audio.src = this.queue[i];
      try {
        await this.audio.play();
        if (token !== this.token) throw new CancelledError();
        this.onTitle?.(titleFromUrl(this.queue[i]));
        return;
      } catch (err) {
        if (err instanceof CancelledError || token !== this.token) throw new CancelledError();
        console.warn(`[music] Nie da się odtworzyć ${this.queue[i]}`, err);
        lastError = err;
      }
    }
    throw new Error(`Żaden plik z playlisty nie działa (${lastError instanceof Error ? lastError.message : 'nieznany błąd'}).`);
  }
}

/** „music/walka/01_Epic-Battle.mp3” → „01 Epic Battle”. */
function titleFromUrl(url: string): string {
  const file = decodeURIComponent(url.split('/').pop() ?? url);
  return file.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
}
