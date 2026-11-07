import type { Command } from './commands';
import { DEFAULT_HOTKEYS, DEFAULT_MIXER, DEFAULT_MOODS, DEFAULT_OPTIONS } from './defaults';
import type { HotkeyMap, LayerState, Library, SavedSettings, SessionState } from './types';

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function createInitialState(library: Library, saved: Partial<SavedSettings> = {}): SessionState {
  const layers: Record<string, LayerState> = {};
  for (const def of library.ambient) {
    layers[def.id] = {
      active: false,
      volume: saved.layerVolumes?.[def.id] ?? def.defaultVolume,
    };
  }

  // Zapisane skróty zastępują domyślne w całości – inaczej usunięty skrót wracałby po odświeżeniu.
  let hotkeys: HotkeyMap = saved.hotkeys ?? { ...DEFAULT_HOTKEYS };
  if (!saved.hotkeys) {
    for (const sfx of library.sfx) {
      if (sfx.defaultHotkey) hotkeys = bindHotkey(hotkeys, `sfx:${sfx.id}`, sfx.defaultHotkey);
    }
  }

  return {
    layers,
    mixer: { ...DEFAULT_MIXER, ...saved.mixer },
    hotkeys,
    options: { ...DEFAULT_OPTIONS, ...saved.options },
    // Nastroje zapisane przed dodaniem „ulubionych” traktujemy jako ulubione – nic nie znika z paska.
    moods: saved.moods ? migrateMoodNames(saved.moods).map((m) => ({ ...m, favorite: m.favorite ?? true })) : DEFAULT_MOODS,
    currentMood: null,
  };
}

/** Dawne polskie nazwy domyślnych nastrojów → angielskie (własne nazwy użytkownika zostają bez zmian). */
const LEGACY_MOOD_NAMES: Record<string, string> = {
  calm: 'Spokój', explore: 'Eksploracja', tension: 'Napięcie', combat: 'Walka', victory: 'Zwycięstwo', sad: 'Smutek',
};

function migrateMoodNames(moods: SessionState['moods']): SessionState['moods'] {
  return moods.map((m) => {
    if (LEGACY_MOOD_NAMES[m.id] !== m.name) return m;
    const name = DEFAULT_MOODS.find((d) => d.id === m.id)?.name;
    return name ? { ...m, name } : m;
  });
}

/** Przypisuje kombinację; jeśli była zajęta, odbiera ją poprzedniemu celowi. */
function bindHotkey(map: HotkeyMap, target: keyof HotkeyMap, combo: string | null): HotkeyMap {
  const next: HotkeyMap = {};
  for (const [t, c] of Object.entries(map) as Array<[keyof HotkeyMap, string]>) {
    if (t !== target && c !== combo) next[t] = c;
  }
  if (combo) next[target] = combo;
  return next;
}

/** Czysta funkcja: stan + komenda → nowy stan. Audio reaguje osobno. */
export function reduce(state: SessionState, cmd: Command): SessionState {
  switch (cmd.type) {
    case 'layer/set': {
      const prev = state.layers[cmd.id];
      if (!prev) return state;
      return {
        ...state,
        layers: {
          ...state.layers,
          [cmd.id]: {
            active: cmd.active ?? prev.active,
            volume: clamp01(cmd.volume ?? prev.volume),
          },
        },
      };
    }
    case 'mixer/set':
      return { ...state, mixer: { ...state.mixer, [cmd.channel]: clamp01(cmd.volume) } };
    case 'sfx/play':
    case 'music/next':
      return state; // zdarzenia jednorazowe – stan się nie zmienia
    case 'mood/play':
      return state.moods.some((m) => m.id === cmd.id) ? { ...state, currentMood: cmd.id } : state;
    case 'mood/stop':
      return { ...state, currentMood: null };
    case 'moods/set': {
      const ids = new Set(cmd.moods.map((m) => m.id));
      // Usunięty nastrój znika też ze skrótów i z powrotów „po zwycięstwie”.
      const hotkeys: HotkeyMap = {};
      for (const [t, c] of Object.entries(state.hotkeys) as Array<[keyof HotkeyMap, string]>) {
        if (!t.startsWith('mood:') || ids.has(t.slice(5))) hotkeys[t] = c;
      }
      const moods = cmd.moods.map((m) => (m.returnTo && !ids.has(m.returnTo) ? { ...m, returnTo: null } : m));
      return { ...state, moods, hotkeys, currentMood: state.currentMood && ids.has(state.currentMood) ? state.currentMood : null };
    }
    case 'hotkey/set':
      return { ...state, hotkeys: bindHotkey(state.hotkeys, cmd.target, cmd.combo) };
    case 'options/set':
      return { ...state, options: { ...state.options, ...cmd.options } };
    case 'panic': {
      const layers: Record<string, LayerState> = {};
      for (const [id, l] of Object.entries(state.layers)) layers[id] = { ...l, active: false };
      return { ...state, layers, currentMood: null };
    }
  }
}

export function toSavedSettings(state: SessionState): SavedSettings {
  const layerVolumes: Record<string, number> = {};
  for (const [id, l] of Object.entries(state.layers)) layerVolumes[id] = l.volume;
  return { mixer: state.mixer, layerVolumes, hotkeys: state.hotkeys, options: state.options, moods: state.moods };
}
