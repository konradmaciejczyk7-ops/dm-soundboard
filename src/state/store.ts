import { create } from 'zustand';
import type { LayerStatusInfo } from '../audio/AmbientChannel';
import type { MusicStatus } from '../music/MusicController';
import type { Command } from '../core/commands';
import { createInitialState, reduce } from '../core/reducer';
import type { HotkeyTarget, Library, SessionState } from '../core/types';

interface UiState {
  search: string;
  /** Tryb przypisywania skrótów: kliknięcia wybierają cel zamiast grać. */
  assignMode: boolean;
  assignTarget: HotkeyTarget | null;
  /** Okno edycji nastrojów; focusId = nastrój do podświetlenia. */
  moodEditor: { open: boolean; focusId: string | null };
}

interface AppStore {
  library: Library;
  session: SessionState;
  /** Stan runtime z silnika audio (ładowanie, błąd pliku) – nie jest zapisywany. */
  layerStatus: Record<string, LayerStatusInfo>;
  /** Ostatnio zagrany efekt – do podświetlenia przycisku (także po skrócie z klawiatury). */
  lastPlayed: { id: string; at: number } | null;
  musicStatus: MusicStatus;
  audioStarted: boolean;
  ui: UiState;

  init: (library: Library, session: SessionState) => void;
  apply: (cmd: Command) => void;
  setLayerStatus: (id: string, info: LayerStatusInfo) => void;
  setAudioStarted: () => void;
  setSearch: (search: string) => void;
  setAssignMode: (on: boolean) => void;
  setAssignTarget: (target: HotkeyTarget | null) => void;
  setMusicStatus: (status: MusicStatus) => void;
  openMoodEditor: (focusId?: string) => void;
  closeMoodEditor: () => void;
}

const EMPTY_LIBRARY: Library = { ambient: [], sfxCategories: [], sfx: [], music: [] };

export const useAppStore = create<AppStore>()((set) => ({
  library: EMPTY_LIBRARY,
  session: createInitialState(EMPTY_LIBRARY),
  layerStatus: {},
  lastPlayed: null,
  musicStatus: { moodId: null, state: 'idle' },
  audioStarted: false,
  ui: { search: '', assignMode: false, assignTarget: null, moodEditor: { open: false, focusId: null } },

  init: (library, session) => set({ library, session }),
  apply: (cmd) =>
    set((s) => ({
      session: reduce(s.session, cmd),
      ...(cmd.type === 'sfx/play' && { lastPlayed: { id: cmd.id, at: performance.now() } }),
    })),
  setLayerStatus: (id, info) => set((s) => ({ layerStatus: { ...s.layerStatus, [id]: info } })),
  setAudioStarted: () => set({ audioStarted: true }),
  setSearch: (search) => set((s) => ({ ui: { ...s.ui, search } })),
  setAssignMode: (assignMode) => set((s) => ({ ui: { ...s.ui, assignMode, assignTarget: null } })),
  setAssignTarget: (assignTarget) => set((s) => ({ ui: { ...s.ui, assignTarget } })),
  setMusicStatus: (musicStatus) => set({ musicStatus }),
  openMoodEditor: (focusId) =>
    set((s) => ({ ui: { ...s.ui, assignMode: false, assignTarget: null, moodEditor: { open: true, focusId: focusId ?? null } } })),
  closeMoodEditor: () => set((s) => ({ ui: { ...s.ui, moodEditor: { open: false, focusId: null } } })),
}));
