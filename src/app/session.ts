import { AudioEngine } from '../audio/AudioEngine';
import type { Command } from '../core/commands';
import { createInitialState, toSavedSettings } from '../core/reducer';
import { loadLibrary } from '../library/manifest';
import { useAppStore } from '../state/store';
import { loadSettings, saveSettings } from '../storage/db';

// Spoiwo aplikacji: jedno miejsce, przez które przechodzi każda komenda.

export const engine = new AudioEngine({
  getLayer: (id) => useAppStore.getState().library.ambient.find((d) => d.id === id),
  getSfx: (id) => useAppStore.getState().library.sfx.find((d) => d.id === id),
  onLayerStatus: (id, info) => useAppStore.getState().setLayerStatus(id, info),
  resolvePlaylist: (id) => useAppStore.getState().library.music.find((p) => p.id === id)?.files,
  onMusicStatus: (status) => useAppStore.getState().setMusicStatus(status),
  onOneShotEnded: (moodId) => {
    // Np. po fanfarze zwycięstwa: wracamy do wskazanego nastroju albo wyciszamy muzykę.
    const { session } = useAppStore.getState();
    if (session.currentMood !== moodId) return;
    const returnTo = session.moods.find((m) => m.id === moodId)?.returnTo;
    dispatch(returnTo ? { type: 'mood/play', id: returnTo } : { type: 'mood/stop' });
  },
});

type CommandListener = (cmd: Command) => void;
const listeners = new Set<CommandListener>();

/** Dodatkowi słuchacze komend – np. w przyszłości most WebSocket do bota. */
export function onCommand(listener: CommandListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function dispatch(cmd: Command): void {
  const store = useAppStore.getState();
  store.apply(cmd);
  engine.handle(cmd, useAppStore.getState().session);
  for (const l of listeners) l(cmd);
  if (cmd.type !== 'sfx/play' && cmd.type !== 'music/next') schedulePersist();
}

let persistTimer: number | undefined;
function schedulePersist(): void {
  window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    void saveSettings(toSavedSettings(useAppStore.getState().session));
  }, 400);
}

export async function bootstrap(): Promise<void> {
  const [library, saved] = await Promise.all([loadLibrary(), loadSettings()]);
  useAppStore.getState().init(library, createInitialState(library, saved));
}

export async function startAudio(): Promise<void> {
  const { session, library } = useAppStore.getState();
  await engine.start(session);
  engine.preloadSfx(library.sfx);
  useAppStore.getState().setAudioStarted();
}
