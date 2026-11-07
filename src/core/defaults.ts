import type { HotkeyMap, MixerChannel, MoodDef, SessionOptions } from './types';

export const DEFAULT_MIXER: Record<MixerChannel, number> = {
  master: 0.8,
  ambient: 0.8,
  music: 0.7,
  sfx: 0.9,
};

export const DEFAULT_OPTIONS: SessionOptions = {
  ducking: true,
  humanize: true,
};

export const DEFAULT_HOTKEYS: HotkeyMap = {
  panic: 'Shift+Escape',
};

const mood = (id: string, name: string, emoji: string, color: string, extra: Partial<MoodDef> = {}): MoodDef => ({
  id, name, emoji, color, source: null, oneShot: false, returnTo: null, favorite: true, ...extra,
});

/** Startowa lista nastrojów – w aplikacji można ją dowolnie edytować. */
export const DEFAULT_MOODS: MoodDef[] = [
  mood('calm', 'Calm', '🕊️', '#6fb3d9'),
  mood('explore', 'Exploration', '🧭', '#7fc77a'),
  mood('tension', 'Tension', '😰', '#d9b44a'),
  mood('combat', 'Combat', '⚔️', '#d9643a'),
  mood('boss', 'Boss', '💀', '#c2406a'),
  mood('victory', 'Victory', '🏆', '#e8c547', { oneShot: true, returnTo: 'calm' }),
  mood('sad', 'Sadness', '🥀', '#8a7fb8'),
];

/** Czasy przejść w sekundach. */
export const FADES = {
  ambient: 2,
  music: 3,
  panic: 1,
  volume: 0.08,
} as const;

/** Ducking: ile i jak szybko ściszamy muzykę pod głośny efekt. */
export const DUCK = {
  gain: 0.32, // ≈ −10 dB
  attack: 0.06,
  hold: 0.15,
  release: 0.6,
} as const;

/** Humanizacja efektów: lekka losowa zmiana wysokości i głośności. */
export const HUMANIZE = {
  cents: 80,
  gain: 0.15,
} as const;
