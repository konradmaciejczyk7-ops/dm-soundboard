import { FADES } from '../core/defaults';
import type { MoodDef } from '../core/types';
import { CancelledError, type Deck } from './Deck';
import { LocalDeck } from './LocalDeck';
import { YouTubeDeck } from './YouTubeDeck';

export interface MusicStatus {
  moodId: string | null;
  state: 'idle' | 'loading' | 'playing' | 'error';
  source?: 'local' | 'youtube';
  title?: string;
  message?: string;
}

export interface MusicControllerDeps {
  /** id lokalnej playlisty → adresy plików (undefined = nie ma takiego folderu). */
  resolvePlaylist: (id: string) => string[] | undefined;
  onStatus: (status: MusicStatus) => void;
  /** Utwór „jednorazowego” nastroju (np. Zwycięstwo) się skończył. */
  onOneShotEnded: (moodId: string) => void;
}

/**
 * Przełączanie nastrojów z crossfade'em. Po dwa decki każdego rodzaju:
 * nowy nastrój ładuje się na wolnym decku (stary gra dalej), a dopiero gdy
 * nowy faktycznie zacznie grać, oba przenikają się przez FADES.music sekund.
 */
export class MusicController {
  private readonly local: [LocalDeck, LocalDeck];
  private readonly youtube: [YouTubeDeck, YouTubeDeck];
  private current: { deck: Deck; moodId: string } | null = null;
  private token = 0;
  private status: MusicStatus = { moodId: null, state: 'idle' };

  constructor(
    ctx: AudioContext,
    output: AudioNode,
    externalGain: () => number,
    private readonly deps: MusicControllerDeps,
  ) {
    this.local = [new LocalDeck(ctx, output), new LocalDeck(ctx, output)];
    this.youtube = [new YouTubeDeck(externalGain), new YouTubeDeck(externalGain)];
  }

  async play(mood: MoodDef, fade: number = FADES.music): Promise<void> {
    const token = ++this.token;
    const source = mood.source;
    if (!source) {
      this.setStatus({ moodId: mood.id, state: 'error', message: 'This mood has no music yet – set it in ⚙️.' });
      return;
    }

    const deck = this.spareDeck(source.kind);
    let title: string | undefined;
    deck.onTitle = (t) => {
      title = t;
      if (this.current?.deck === deck) this.setStatus({ ...this.status, state: 'playing', title: t, message: undefined });
    };
    deck.onEnded = () => {
      if (this.current?.deck === deck) this.deps.onOneShotEnded(mood.id);
    };
    deck.onError = (message) => {
      if (this.current?.deck === deck) this.setStatus({ ...this.status, state: 'error', message });
    };
    this.setStatus({ moodId: mood.id, state: 'loading', source: source.kind });

    try {
      if (source.kind === 'local') {
        const files = this.deps.resolvePlaylist(source.playlist);
        if (!files) throw new Error(`Folder not found: public/sounds/music/${source.playlist}/.`);
        await (deck as LocalDeck).start({ files, oneShot: mood.oneShot, shuffle: true });
      } else {
        await (deck as YouTubeDeck).start({ playlistId: source.playlistId, videoId: source.videoId, oneShot: mood.oneShot, shuffle: true });
      }
    } catch (err) {
      // Przerwane przez kolejne kliknięcie – nic nie zgłaszamy.
      if (token === this.token && !(err instanceof CancelledError)) {
        this.setStatus({ moodId: mood.id, state: 'error', source: source.kind, message: err instanceof Error ? err.message : String(err) });
      }
      return;
    }
    if (token !== this.token) {
      deck.stopNow();
      return;
    }

    const previous = this.current;
    this.current = { deck, moodId: mood.id };
    deck.setVisible(true);
    deck.fadeTo(1, fade);
    if (previous && previous.deck !== deck) {
      previous.deck.setVisible(false);
      previous.deck.fadeOutAndStop(fade);
    }
    this.setStatus({ moodId: mood.id, state: 'playing', source: source.kind, title });
  }

  stop(fade: number = FADES.music): void {
    this.token++;
    this.current?.deck.fadeOutAndStop(fade);
    this.current = null;
    this.setStatus({ moodId: null, state: 'idle' });
  }

  next(): void {
    this.current?.deck.next();
  }

  /** Wolny deck danego rodzaju – ten, który nie gra teraz głównej muzyki. */
  private spareDeck(kind: 'local' | 'youtube'): Deck {
    const pool: readonly Deck[] = kind === 'local' ? this.local : this.youtube;
    return pool[0] === this.current?.deck ? pool[1] : pool[0];
  }

  private setStatus(status: MusicStatus): void {
    this.status = status;
    this.deps.onStatus(status);
  }
}
