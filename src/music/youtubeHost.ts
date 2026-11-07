// Miejsce w UI, w którym osadzamy odtwarzacze YouTube (regulamin wymaga, by były widoczne).
// Komponent rejestruje element, a decki czekają na niego, jeśli jeszcze go nie ma.

let host: HTMLElement | null = null;
const waiting: Array<(el: HTMLElement) => void> = [];

export function setYouTubeHost(el: HTMLElement | null): void {
  host = el;
  if (el) for (const resolve of waiting.splice(0)) resolve(el);
}

export function getYouTubeHost(): Promise<HTMLElement> {
  return host ? Promise.resolve(host) : new Promise((resolve) => waiting.push(resolve));
}
