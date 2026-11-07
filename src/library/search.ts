import type { Library, SfxDef } from '../core/types';

/** Małe litery bez polskich znaków – „krzyk” znajdzie „Krzyk bólu”, „zaklecia” znajdzie „Zaklęcia”. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

/** Każde słowo zapytania musi pasować do nazwy, id albo nazwy kategorii. */
export function filterSfx(library: Library, query: string): SfxDef[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return library.sfx;
  const categoryNames = new Map(library.sfxCategories.map((c) => [c.id, c.name]));
  return library.sfx.filter((def) => {
    const haystack = normalize(`${def.name} ${def.id} ${categoryNames.get(def.category) ?? ''}`);
    return words.every((w) => haystack.includes(w));
  });
}
