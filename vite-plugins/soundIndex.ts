import { existsSync, readdirSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import type { Plugin } from 'vite';

// Listy plików generowane z folderów – wystarczy wrzucić pliki, bez edytowania manifestu:
//   public/sounds/music/<playlista>/*.mp3  → music-index.json (playlisty)
//   public/sounds/sfx/<kategoria>/*.wav    → sfx-index.json (efekty pogrupowane po nazwie)

const AUDIO = new Set(['.mp3', '.ogg', '.oga', '.opus', '.wav', '.m4a', '.aac', '.flac', '.webm']);
const warned = new Set<string>();

/** Plik audio, który serwer potrafi podać („#” w nazwie psuje adres – takie pomijamy z ostrzeżeniem). */
function isAudio(file: string): boolean {
  if (!AUDIO.has(extname(file).toLowerCase())) return false;
  if (!file.includes('#')) return true;
  if (!warned.has(file)) {
    warned.add(file);
    console.warn(`[sounds] Pomijam „${file}” – usuń znak # z nazwy pliku.`);
  }
  return false;
}

/** Rekurencyjnie – podfoldery też się liczą. Ścieżki zawsze z „/”. */
function walk(dir: string, prefix = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name), `${prefix}${e.name}/`) : [`${prefix}${e.name}`],
  );
}

/** Sortowanie „naturalne”: coins-2 przed coins-10. */
const natural = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true });

// --- Muzyka ---

export interface MusicIndexEntry {
  id: string;
  name: string;
  /** Ścieżki względem public/sounds/. */
  files: string[];
}

export function scanMusic(dir: string): MusicIndexEntry[] {
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir, { withFileTypes: true });
  const playlists: MusicIndexEntry[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const files = walk(join(dir, e.name)).filter(isAudio).sort(natural).map((f) => `music/${e.name}/${f}`);
    if (files.length) playlists.push({ id: e.name, name: e.name, files });
  }
  const loose = entries.filter((e) => e.isFile() && isAudio(e.name)).map((e) => `music/${e.name}`).sort(natural);
  if (loose.length) playlists.push({ id: '_root', name: 'Loose files', files: loose });
  return playlists.sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

// --- Efekty ---

export interface SfxIndexEntry {
  /** Nazwa pliku bez numeru, np. „coins” – ten sam id co w manifest.json. */
  id: string;
  /** Folder pierwszego pliku (sfx/<kategoria>/…). */
  category: string;
  /** Warianty – ścieżki względem public/sounds/. */
  files: string[];
}

/**
 * „coins-3.wav” → „coins”, „dragon-f12.wav” → „dragon”, „Item Get 2.mp3” → „item-get”.
 * Plik bez numeru („item-get.wav”) to po prostu efekt z jednym wariantem.
 */
export function sfxGroupId(file: string): string {
  const stem = basename(file, extname(file));
  const base = stem.replace(/[-_ ]+f?\d+$|\d+$/i, '') || stem;
  return base.trim().toLowerCase().replace(/[\s_]+/g, '-');
}

export function scanSfx(dir: string): SfxIndexEntry[] {
  if (!existsSync(dir)) return [];
  const groups = new Map<string, SfxIndexEntry>();
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    for (const f of walk(join(dir, e.name)).filter(isAudio).sort(natural)) {
      const id = sfxGroupId(f);
      const group = groups.get(id) ?? { id, category: e.name, files: [] };
      group.files.push(`sfx/${e.name}/${f}`);
      groups.set(id, group);
    }
  }
  return [...groups.values()].sort((a, b) => natural(a.id, b.id));
}

// --- Wtyczka ---

export function soundIndex(): Plugin {
  let soundsDir = '';
  const indexes = () => ({
    'music-index.json': scanMusic(join(soundsDir, 'music')),
    'sfx-index.json': scanSfx(join(soundsDir, 'sfx')),
  });

  return {
    name: 'dm-sound-index',
    configResolved(config) {
      soundsDir = join(config.publicDir, 'sounds');
    },
    // Dev: skanujemy przy każdym zapytaniu – nowe pliki widać po odświeżeniu strony.
    configureServer(server) {
      for (const name of ['music-index.json', 'sfx-index.json'] as const) {
        server.middlewares.use(`/sounds/${name}`, (_req, res) => {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify(indexes()[name]));
        });
      }
    },
    // Build: zapisujemy stan folderów w chwili budowania.
    generateBundle() {
      for (const [name, data] of Object.entries(indexes())) {
        this.emitFile({ type: 'asset', fileName: `sounds/${name}`, source: JSON.stringify(data) });
      }
    },
  };
}
