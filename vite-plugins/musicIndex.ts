import { existsSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import type { Plugin } from 'vite';

// Lista lokalnej muzyki generowana z folderów: public/sounds/music/<playlista>/*.mp3
// Dzięki temu wystarczy wrzucić pliki – bez edytowania manifestu.

const AUDIO = new Set(['.mp3', '.ogg', '.oga', '.opus', '.wav', '.m4a', '.aac', '.flac', '.webm']);
const warned = new Set<string>();

/** Plik audio, który serwer potrafi podać („#” w nazwie psuje adres – takie pomijamy z ostrzeżeniem). */
function isAudio(file: string): boolean {
  if (!AUDIO.has(extname(file).toLowerCase())) return false;
  if (!file.includes('#')) return true;
  if (!warned.has(file)) {
    warned.add(file);
    console.warn(`[music] Pomijam „${file}” – usuń znak # z nazwy pliku.`);
  }
  return false;
}

export interface MusicIndexEntry {
  id: string;
  name: string;
  /** Ścieżki względem public/sounds/. */
  files: string[];
}

/** Rekurencyjnie – podfoldery playlisty też się liczą. Ścieżki zawsze z „/”. */
function walk(dir: string, prefix = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name), `${prefix}${e.name}/`) : [`${prefix}${e.name}`],
  );
}

export function scanMusic(dir: string): MusicIndexEntry[] {
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir, { withFileTypes: true });
  const playlists: MusicIndexEntry[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const files = walk(join(dir, e.name)).filter(isAudio).sort().map((f) => `music/${e.name}/${f}`);
    if (files.length) playlists.push({ id: e.name, name: e.name, files });
  }
  const loose = entries.filter((e) => e.isFile() && isAudio(e.name)).map((e) => `music/${e.name}`).sort();
  if (loose.length) playlists.push({ id: '_root', name: 'Luźne pliki', files: loose });
  return playlists.sort((a, b) => a.name.localeCompare(b.name, 'pl'));
}

export function musicIndex(): Plugin {
  let dir = '';
  return {
    name: 'dm-music-index',
    configResolved(config) {
      dir = join(config.publicDir, 'sounds', 'music');
    },
    // Dev: skanujemy przy każdym zapytaniu – nowe pliki widać po odświeżeniu strony.
    configureServer(server) {
      server.middlewares.use('/sounds/music-index.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify(scanMusic(dir)));
      });
    },
    // Build: zapisujemy stan folderu w chwili budowania.
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'sounds/music-index.json', source: JSON.stringify(scanMusic(dir)) });
    },
  };
}
