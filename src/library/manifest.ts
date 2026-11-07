import type { AmbientLayerDef, Library, MusicPlaylist, SfxCategoryDef, SfxDef, SoundSource } from '../core/types';

interface ManifestAmbientEntry {
  id: string;
  name: string;
  emoji?: string;
  /** Ścieżka względem public/sounds/. */
  file?: string;
  volume?: number;
}

interface ManifestSfxEntry {
  /** = nazwa pliku bez numeru („coins” dla coins-1.wav, coins-2.wav…). */
  id: string;
  /** Brak → nazwa z pliku („item-get” → „Item Get”). */
  name?: string;
  emoji?: string;
  category: string;
  /** Opcjonalnie – pliki o innej nazwie; pasujące pliki z folderu dołączają same. Ścieżki względem public/sounds/. */
  files?: string[];
  volume?: number;
  loud?: boolean;
  randomize?: boolean;
  hotkey?: string;
}

interface SoundManifest {
  ambient?: ManifestAmbientEntry[];
  sfxCategories?: SfxCategoryDef[];
  sfx?: ManifestSfxEntry[];
}

const SOUNDS_BASE = `${import.meta.env.BASE_URL}sounds/`;

/** Ścieżka względem public/sounds/ → URL (każdy segment kodowany osobno – działa też „#” czy „?” w nazwie). */
const soundUrl = (file: string) => SOUNDS_BASE + file.split('/').map(encodeURIComponent).join('/');

const fileSource = (file: string): SoundSource => ({ kind: 'url', url: soundUrl(file) });

function toAmbientDef(e: ManifestAmbientEntry): AmbientLayerDef | null {
  if (!e.id || !e.name || !e.file) return null;
  return { id: e.id, name: e.name, emoji: e.emoji ?? '🎵', source: fileSource(e.file), defaultVolume: e.volume ?? 0.6 };
}

/** Efekt wykryty w folderach przez wtyczkę Vite (vite-plugins/soundIndex.ts). */
interface SfxIndexEntry {
  id: string;
  category: string;
  files: string[];
}

/** „item-get” → „Item Get”. */
const titleCase = (id: string) => id.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function toSfxDef(e: ManifestSfxEntry, files: string[], categoryEmoji: (id: string) => string | undefined): SfxDef {
  const category = e.category || 'other';
  return {
    id: e.id,
    name: e.name || titleCase(e.id),
    emoji: e.emoji ?? categoryEmoji(category) ?? '🔊',
    category,
    variants: files.map(fileSource),
    volume: e.volume ?? 0.85,
    loud: e.loud ?? false,
    randomize: e.randomize ?? true,
    defaultHotkey: e.hotkey,
  };
}

/**
 * Łączy manifest z plikami z folderów sfx/:
 * - wpis z manifestu (ten sam id co nazwa pliku bez numeru) dostaje wszystkie pasujące pliki –
 *   nowy „coins-6.wav” sam dołącza do przycisku „Coins”;
 * - pliki bez wpisu tworzą nowy przycisk (nazwa z pliku, kategoria z folderu).
 * Manifest służy już tylko do ustawień: nazwa, emoji, głośność, loud, skrót.
 */
function buildSfx(entries: ManifestSfxEntry[], index: SfxIndexEntry[], categoryEmoji: (id: string) => string | undefined): SfxDef[] {
  const byId = new Map<string, { entry: ManifestSfxEntry; files: string[] }>();
  const owner = new Map<string, string>(); // plik → id wpisu, który go wymienia w "files"
  for (const entry of entries) {
    if (!entry.id || byId.has(entry.id)) continue;
    byId.set(entry.id, { entry, files: [...(entry.files ?? [])] });
    for (const f of entry.files ?? []) owner.set(f, entry.id);
  }

  for (const group of index) {
    // Grupa trafia do wpisu o tym samym id, albo do wpisu, który ręcznie wymienia któryś z jej plików.
    const targetId = byId.has(group.id) ? group.id : group.files.map((f) => owner.get(f)).find(Boolean);
    const target = targetId ? byId.get(targetId) : undefined;
    if (target) {
      for (const f of group.files) if (!target.files.includes(f)) target.files.push(f);
    } else {
      byId.set(group.id, { entry: { id: group.id, name: '', category: group.category }, files: [...group.files] });
    }
  }

  return [...byId.values()].filter((v) => v.files.length > 0).map((v) => toSfxDef(v.entry, v.files, categoryEmoji));
}

const notNull = <T>(v: T | null): v is T => v !== null;

/** Lista plików wygenerowana przez wtyczkę Vite (vite-plugins/soundIndex.ts); pusta, jeśli jej brak. */
async function loadIndex<T>(name: string): Promise<T[]> {
  try {
    const res = await fetch(`${SOUNDS_BASE}${name}`, { cache: 'no-cache' });
    if (!res.ok || !res.headers.get('content-type')?.includes('json')) return [];
    return (await res.json()) as T[];
  } catch (err) {
    console.warn(`[library] Brak ${name}`, err);
    return [];
  }
}

/** Wczytuje public/sounds/manifest.json (ambient, ustawienia efektów) oraz listy plików z folderów. */
export async function loadLibrary(): Promise<Library> {
  const [musicIndex, sfxIndex] = await Promise.all([
    loadIndex<MusicPlaylist>('music-index.json'),
    loadIndex<SfxIndexEntry>('sfx-index.json'),
  ]);
  const music = musicIndex.map((e) => ({ ...e, files: e.files.map(soundUrl) }));

  let manifest: SoundManifest = {};
  try {
    const res = await fetch(`${SOUNDS_BASE}manifest.json`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    manifest = (await res.json()) as SoundManifest;
  } catch (err) {
    console.error('[library] Nie udało się wczytać manifest.json', err);
  }

  const knownCategories = manifest.sfxCategories ?? [];
  const sfx = buildSfx(manifest.sfx ?? [], sfxIndex, (id) => knownCategories.find((c) => c.id === id)?.emoji);
  // Pokazujemy tylko kategorie, w których coś jest; nowy folder dostaje własną kolumnę.
  const sfxCategories = knownCategories.filter((c) => sfx.some((d) => d.category === c.id));
  for (const def of sfx) {
    if (!sfxCategories.some((c) => c.id === def.category)) {
      sfxCategories.push({ id: def.category, name: titleCase(def.category), emoji: '🔊' });
    }
  }
  return { ambient: (manifest.ambient ?? []).map(toAmbientDef).filter(notNull), sfxCategories, sfx, music };
}
