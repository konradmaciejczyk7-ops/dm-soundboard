import type { Command } from '../core/commands';
import type { HotkeyMap, HotkeyTarget, SessionState } from '../core/types';
import { useAppStore } from '../state/store';
import { dispatch } from './session';

export const SEARCH_INPUT_ID = 'sfx-search';

const MODIFIER_CODES = new Set([
  'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight',
]);

/** „Ctrl+Alt+Shift+KeyQ” – używamy KeyboardEvent.code, więc działa niezależnie od układu klawiatury. */
export function comboFromEvent(e: KeyboardEvent): string | null {
  if (MODIFIER_CODES.has(e.code) || !e.code) return null;
  const parts: string[] = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  parts.push(e.code);
  return parts.join('+');
}

const CODE_LABELS: Record<string, string> = {
  Escape: 'Esc', Space: 'Spacja', Enter: 'Enter', Backquote: '`', Minus: '-', Equal: '=',
  BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.',
  Slash: '/', Backslash: '\\', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
  NumpadAdd: 'Num+', NumpadSubtract: 'Num-', NumpadMultiply: 'Num*', NumpadDivide: 'Num/',
  NumpadEnter: 'NumEnter', NumpadDecimal: 'Num.',
};

export function formatCombo(combo: string): string {
  return combo
    .split('+')
    .map((part) => {
      const key = /^Key([A-Z])$/.exec(part)?.[1] ?? /^Digit(\d)$/.exec(part)?.[1];
      if (key) return key;
      const num = /^Numpad(\d)$/.exec(part)?.[1];
      if (num) return `Num${num}`;
      return CODE_LABELS[part] ?? part;
    })
    .join('+');
}

export function findTarget(hotkeys: HotkeyMap, combo: string): HotkeyTarget | undefined {
  return (Object.keys(hotkeys) as HotkeyTarget[]).find((t) => hotkeys[t] === combo);
}

function commandForTarget(target: HotkeyTarget, state: SessionState): Command | null {
  if (target === 'panic') return { type: 'panic' };
  const [kind, id] = [target.slice(0, target.indexOf(':')), target.slice(target.indexOf(':') + 1)];
  if (kind === 'sfx') return { type: 'sfx/play', id };
  if (kind === 'mood') return { type: 'mood/play', id };
  if (kind === 'layer') {
    const layer = state.layers[id];
    return layer ? { type: 'layer/set', id, active: !layer.active } : null;
  }
  return null;
}

/** Czy użytkownik właśnie pisze w polu tekstowym (wtedy skróty nie działają). */
function isTyping(el: EventTarget | null): boolean {
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) return !['range', 'checkbox', 'radio', 'button'].includes(el.type);
  return el instanceof HTMLElement && el.isContentEditable;
}

function onKeyDown(e: KeyboardEvent): void {
  const store = useAppStore.getState();
  if (!store.audioStarted || store.ui.moodEditor.open || isTyping(e.target)) return;

  const { assignMode, assignTarget } = store.ui;

  // Tryb przypisywania: kolejny klawisz trafia do wybranego celu.
  if (assignMode) {
    if (e.code === 'Escape' && !e.shiftKey) {
      e.preventDefault();
      if (assignTarget) store.setAssignTarget(null);
      else store.setAssignMode(false);
      return;
    }
    if (!assignTarget) return;
    if (e.code === 'Backspace' || e.code === 'Delete') {
      e.preventDefault();
      dispatch({ type: 'hotkey/set', target: assignTarget, combo: null });
      store.setAssignTarget(null);
      return;
    }
    const combo = comboFromEvent(e);
    if (!combo) return;
    e.preventDefault();
    dispatch({ type: 'hotkey/set', target: assignTarget, combo });
    store.setAssignTarget(null);
    return;
  }

  if (e.repeat) return;
  const combo = comboFromEvent(e);
  if (!combo) return;

  const target = findTarget(store.session.hotkeys, combo);
  if (target) {
    e.preventDefault(); // np. Spacja nie „kliknie” przycisku z fokusem
    const cmd = commandForTarget(target, store.session);
    if (cmd) dispatch(cmd);
    return;
  }

  // „/” – szybkie przejście do wyszukiwarki, jeśli nie jest zajęte przez skrót.
  if (combo === 'Slash' || e.key === '/') {
    e.preventDefault();
    document.getElementById(SEARCH_INPUT_ID)?.focus();
  }
}

export function installHotkeys(): () => void {
  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}
