import type { HotkeyTarget, MixerChannel, MoodDef, SessionOptions } from './types';

// Każda akcja w aplikacji to serializowalna komenda. Dzięki temu ten sam
// strumień komend może w przyszłości przyjść z bota (slash-komendy) albo
// zostać do niego wysłany przez WebSocket.
export type Command =
  | { type: 'layer/set'; id: string; active?: boolean; volume?: number }
  | { type: 'mixer/set'; channel: MixerChannel; volume: number }
  | { type: 'sfx/play'; id: string }
  | { type: 'mood/play'; id: string }
  | { type: 'mood/stop' }
  | { type: 'music/next' }
  | { type: 'moods/set'; moods: MoodDef[] }
  | { type: 'hotkey/set'; target: HotkeyTarget; combo: string | null }
  | { type: 'options/set'; options: Partial<SessionOptions> }
  | { type: 'panic' };
