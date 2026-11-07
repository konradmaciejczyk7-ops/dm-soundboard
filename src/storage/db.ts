import Dexie, { type Table } from 'dexie';
import type { SavedSettings } from '../core/types';

interface SettingRow {
  key: keyof SavedSettings;
  value: unknown;
}

// Na razie tylko ustawienia klucz-wartość. W Etapie 4 dojdą tabele na
// wgrane pliki (Bloby), sceny i własne efekty – jako kolejna wersja schematu.
class SoundboardDB extends Dexie {
  settings!: Table<SettingRow, string>;

  constructor() {
    super('dm-soundboard');
    this.version(1).stores({ settings: 'key' });
  }
}

export const db = new SoundboardDB();

const KEYS: Array<keyof SavedSettings> = ['mixer', 'layerVolumes', 'hotkeys', 'options', 'moods'];

export async function loadSettings(): Promise<Partial<SavedSettings>> {
  try {
    const rows = await db.settings.bulkGet(KEYS);
    const saved: Partial<Record<keyof SavedSettings, unknown>> = {};
    for (const row of rows) if (row) saved[row.key] = row.value;
    return saved as Partial<SavedSettings>;
  } catch (err) {
    console.warn('[db] Nie udało się wczytać ustawień', err);
    return {};
  }
}

export async function saveSettings(s: SavedSettings): Promise<void> {
  try {
    await db.settings.bulkPut(KEYS.map((key) => ({ key, value: s[key] })));
  } catch (err) {
    console.warn('[db] Nie udało się zapisać ustawień', err);
  }
}
