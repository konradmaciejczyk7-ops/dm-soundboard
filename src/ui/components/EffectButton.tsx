import { useEffect, useRef } from 'react';
import { dispatch } from '../../app/session';
import type { SfxDef } from '../../core/types';
import { useAppStore } from '../../state/store';
import { useHotkeyTarget } from '../hooks/useHotkeyTarget';
import { HotkeyBadge, preventFocus } from './HotkeyBadge';

export function EffectButton({ def }: { def: SfxDef }) {
  const { combo, selected, onActivate } = useHotkeyTarget(`sfx:${def.id}`);
  const playedAt = useAppStore((s) => (s.lastPlayed?.id === def.id ? s.lastPlayed.at : 0));
  const ref = useRef<HTMLButtonElement>(null);

  // Błysk przy każdym odtworzeniu – restart animacji CSS przez reflow.
  useEffect(() => {
    const el = ref.current;
    if (!playedAt || !el) return;
    el.classList.remove('is-flash');
    void el.offsetWidth;
    el.classList.add('is-flash');
  }, [playedAt]);

  return (
    <button
      ref={ref}
      type="button"
      className={`sfx-btn${selected ? ' is-selected' : ''}`}
      title={def.variants.length > 1 ? `${def.name} – ${def.variants.length} warianty` : def.name}
      onMouseDown={preventFocus}
      onClick={onActivate(() => dispatch({ type: 'sfx/play', id: def.id }))}
    >
      <span className="sfx-btn__emoji" aria-hidden>
        {def.emoji}
      </span>
      <span className="sfx-btn__name">{def.name}</span>
      {def.variants.length > 1 && <span className="sfx-btn__variants">×{def.variants.length}</span>}
      <span className="sfx-btn__kbd">
        <HotkeyBadge combo={combo} selected={selected} />
      </span>
    </button>
  );
}
