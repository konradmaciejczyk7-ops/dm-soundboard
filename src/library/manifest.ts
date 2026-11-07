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
  id: string;
  name: string;
  emoji?: string;
  category: string;
  /** Warianty – ścieżki względem public/sounds/. */
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

function toSfxDef(e: ManifestSfxEntry): SfxDef | null {
  if (!e.id || !e.name || !e.files?.length) return null;
  return {
    id: e.id,
    name: e.name,
    emoji: e.emoji ?? '🔊',
    category: e.category || 'other',
    variants: e.files.map(fileSource),
    volume: e.volume ?? 0.85,
    loud: e.loud ?? false,
    randomize: e.randomize ?? true,
    defaultHotkey: e.hotkey,
  };
}

const notNull = <T>(v: T | null): v is T => v !== null;

/** Lista lokalnej muzyki – generowana przez wtyczkę Vite (vite-plugins/musicIndex.ts). */
async function loadMusicIndex(): Promise<MusicPlaylist[]> {
  try {
    const res = await fetch(`${SOUNDS_BASE}music-index.json`, { cache: 'no-cache' });
    if (!res.ok || !res.headers.get('content-type')?.includes('json')) return [];
    const entries = (await res.json()) as MusicPlaylist[];
    return entries.map((e) => ({ ...e, files: e.files.map(soundUrl) }));
  } catch (err) {
    console.warn('[library] Brak listy lokalnej muzyki', err);
    return [];
  }
}

/** Wczytuje public/sounds/manifest.json (ambient, efekty) i listę lokalnej muzyki. */
export async function loadLibrary(): Promise<Library> {
  const music = await loadMusicIndex();
  try {
    const res = await fetch(`${SOUNDS_BASE}manifest.json`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const manifest = (await res.json()) as SoundManifest;

    const sfx = (manifest.sfx ?? []).map(toSfxDef).filter(notNull);
    // Pokazujemy tylko kategorie, w których coś jest; nieznana kategoria dostaje własną kolumnę.
    const sfxCategories = (manifest.sfxCategories ?? []).filter((c) => sfx.some((d) => d.category === c.id));
    for (const def of sfx) {
      if (!sfxCategories.some((c) => c.id === def.category)) {
        sfxCategories.push({ id: def.category, name: def.category, emoji: '🔊' });
      }
    }
    return { ambient: (manifest.ambient ?? []).map(toAmbientDef).filter(notNull), sfxCategories, sfx, music };
  } catch (err) {
    console.error('[library] Nie udało się wczytać manifest.json', err);
    return { ambient: [], sfxCategories: [], sfx: [], music };
  }
}
