/**
 * „Deck” = jeden odtwarzacz muzyki. Crossfade to dwa decki naraz:
 * nowy narasta, stary wygasa i się zatrzymuje.
 */
export interface Deck {
  readonly kind: 'local' | 'youtube';
  /** Zatrzymuje odtwarzanie i porzuca trwające ładowanie (start() kończy się wtedy CancelledError). */
  stopNow(): void;
  fadeTo(level: number, seconds: number): void;
  fadeOutAndStop(seconds: number): void;
  next(): void;
  /** Pokazuje/ukrywa wideo (tylko YouTube). */
  setVisible(visible: boolean): void;

  onTitle?: (title: string) => void;
  /** Utwór się skończył w trybie „jeden utwór”. */
  onEnded?: () => void;
  /** Błąd w trakcie grania (np. kolejny plik nie działa). */
  onError?: (message: string) => void;
}

export class CancelledError extends Error {
  constructor() {
    super('Przerwano');
  }
}

/** Kształt fade'u zgodny z rampTo: narastanie po sinusie, opadanie po 1 - cos. */
export function fadeShape(from: number, to: number, t: number): number {
  const p = Math.min(1, Math.max(0, t));
  if (p === 1) return to;
  const shape = to > from ? Math.sin((p * Math.PI) / 2) : 1 - Math.cos((p * Math.PI) / 2);
  return from + (to - from) * shape;
}

export function shuffled<T>(items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
