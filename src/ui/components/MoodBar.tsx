import { useEffect, useRef, type CSSProperties } from 'react';
import { dispatch } from '../../app/session';
import type { MoodDef } from '../../core/types';
import { useAppStore } from '../../state/store';
import { useHotkeyTarget } from '../hooks/useHotkeyTarget';
import { HotkeyBadge, preventFocus } from './HotkeyBadge';

function MoodButton({ mood }: { mood: MoodDef }) {
  const { combo, selected, onActivate } = useHotkeyTarget(`mood:${mood.id}`);
  const active = useAppStore((s) => s.session.currentMood === mood.id);
  const status = useAppStore((s) => (s.musicStatus.moodId === mood.id ? s.musicStatus.state : null));
  const openEditor = useAppStore((s) => s.openMoodEditor);
  const unassigned = !mood.source;

  const classes = [
    'mood',
    active && 'is-active',
    active && status === 'loading' && 'is-loading',
    status === 'error' && 'is-error',
    unassigned && 'is-empty',
    selected && 'is-selected',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={classes}
      style={{ '--mood-color': mood.color } as CSSProperties}
      title={unassigned ? 'No music – click to set it up' : mood.oneShot ? 'One track, then return' : mood.name}
      onMouseDown={preventFocus}
      onClick={onActivate(() => (unassigned ? openEditor(mood.id) : dispatch({ type: 'mood/play', id: mood.id })))}
    >
      <span className="mood__emoji" aria-hidden>
        {mood.emoji}
      </span>
      <span className="mood__name">{mood.name}</span>
      {mood.oneShot && <span className="mood__once" title="One track, then return">↩</span>}
      <span className="mood__kbd">
        <HotkeyBadge combo={combo} selected={selected} />
      </span>
    </button>
  );
}

export function MoodBar() {
  const allMoods = useAppStore((s) => s.session.moods);
  // Pasek pokazuje tylko ulubione; gdy żaden nie jest zaznaczony – wszystkie, żeby pasek nie był pusty.
  const favorites = allMoods.filter((m) => m.favorite);
  const moods = favorites.length > 0 ? favorites : allMoods;
  const openEditor = useAppStore((s) => s.openMoodEditor);
  const playing = useAppStore((s) => s.session.currentMood !== null);
  const listRef = useRef<HTMLDivElement>(null);

  // Kółko myszy przewija pasek w poziomie. Listener niepasywny, żeby móc zablokować domyślne przewijanie.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Aktywny nastrój (np. włączony skrótem) przewija się do widoku.
  const currentMood = useAppStore((s) => s.session.currentMood);
  useEffect(() => {
    listRef.current?.querySelector('.mood.is-active')?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [currentMood]);

  return (
    <nav className="moods" aria-label="Music moods">
      <div className="moods__list" ref={listRef}>
        {moods.map((m) => (
          <MoodButton key={m.id} mood={m} />
        ))}
      </div>
      <div className="moods__tools">
        <button
          type="button"
          className="tool-btn"
          title="Stop music (fade out)"
          disabled={!playing}
          onClick={() => dispatch({ type: 'mood/stop' })}
        >
          ⏹
        </button>
        <button type="button" className="tool-btn" title="Edit moods and playlists" onClick={() => openEditor()}>
          ⚙️
        </button>
      </div>
    </nav>
  );
}
