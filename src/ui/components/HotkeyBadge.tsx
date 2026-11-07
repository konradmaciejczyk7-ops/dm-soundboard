import type { MouseEvent } from 'react';
import { formatCombo } from '../../app/hotkeys';

export function HotkeyBadge({ combo, selected }: { combo?: string; selected?: boolean }) {
  if (selected) return <kbd className="kbd kbd--waiting">naciśnij…</kbd>;
  if (!combo) return null;
  return <kbd className="kbd">{formatCombo(combo)}</kbd>;
}

/**
 * Kliknięcie myszą nie zabiera fokusu – inaczej Spacja/Enter odpaliłyby
 * ostatnio kliknięty przycisk drugi raz. Nawigacja Tabem dalej działa.
 */
export function preventFocus(e: MouseEvent): void {
  e.preventDefault();
}
