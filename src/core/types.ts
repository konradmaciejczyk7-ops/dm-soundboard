// Typy domenowe – czysty TS, bez zależności od przeglądarki.
// Ten folder ma być współdzielony z przyszłym botem na Discordzie.

export type BusId = 'ambient' | 'music' | 'sfx';
export type MixerChannel = BusId | 'master';

/** Skąd pochodzi dźwięk: plik z public/sounds albo plik wgrany do IndexedDB. */
export type SoundSource =
  | { kind: 'url'; url: string }
  | { kind: 'blob'; blobId: string };

export interface AmbientLayerDef {
  id: string;
  name: string;
  emoji: string;
  source: SoundSource;
  defaultVolume: number;
}

export interface SfxCategoryDef {
  id: string;
  name: string;
  emoji: string;
}

export interface SfxDef {
  id: string;
  name: string;
  emoji: string;
  category: string;
  /** Warianty – przy każdym kliknięciu losowany jest inny niż poprzedni. */
  variants: SoundSource[];
  volume: number;
  /** Głośny efekt – przy włączonym duckingu ścisza muzykę. */
  loud: boolean;
  /** false = bez losowej zmiany pitch/głośności (np. fanfary). */
  randomize: boolean;
  defaultHotkey?: string;
}

/** Lokalna playlista = podfolder public/sounds/music/<nazwa>/ (lista generowana automatycznie). */
export interface MusicPlaylist {
  id: string;
  name: string;
  /** Adresy URL plików, gotowe do odtworzenia. */
  files: string[];
}

export interface Library {
  ambient: AmbientLayerDef[];
  sfxCategories: SfxCategoryDef[];
  sfx: SfxDef[];
  music: MusicPlaylist[];
}

/** Skąd gra muzyka nastroju. Dla YouTube trzymamy też oryginalny link – do edycji. */
export type MusicSource =
  | { kind: 'youtube'; url: string; playlistId?: string; videoId?: string }
  | { kind: 'local'; playlist: string };

export interface MoodDef {
  id: string;
  name: string;
  emoji: string;
  color: string;
  source: MusicSource | null;
  /** Zagraj jeden utwór, a potem przejdź do `returnTo` (null = zatrzymaj muzykę). */
  oneShot: boolean;
  returnTo: string | null;
}

/** Do czego przypięty jest skrót klawiszowy. */
export type HotkeyTarget = 'panic' | `sfx:${string}` | `layer:${string}` | `mood:${string}`;

/** Kombinacja w formacie „Ctrl+Alt+Shift+KeyQ” (KeyboardEvent.code – niezależne od układu klawiatury). */
export type HotkeyMap = Partial<Record<HotkeyTarget, string>>;

export interface LayerState {
  active: boolean;
  /** 0..1 – pozycja suwaka (nie surowy gain). */
  volume: number;
}

export interface SessionOptions {
  ducking: boolean;
  humanize: boolean;
}

export interface SessionState {
  layers: Record<string, LayerState>;
  mixer: Record<MixerChannel, number>;
  hotkeys: HotkeyMap;
  options: SessionOptions;
  moods: MoodDef[];
  /** Aktualnie grający nastrój (null = cisza). */
  currentMood: string | null;
}

/** To, co zapisujemy między sesjami (aktywność warstw i bieżący nastrój celowo nie). */
export interface SavedSettings {
  mixer: Record<MixerChannel, number>;
  layerVolumes: Record<string, number>;
  hotkeys: HotkeyMap;
  options: SessionOptions;
  moods: MoodDef[];
}
