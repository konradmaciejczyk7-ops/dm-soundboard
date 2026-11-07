import type { CSSProperties } from 'react';
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
      title={unassigned ? 'Brak muzyki – kliknij, żeby ustawić' : mood.oneShot ? 'Jeden utwór, potem powrót' : mood.name}
      onMouseDown={preventFocus}
      onClick={onActivate(() => (unassigned ? openEditor(mood.id) : dispatch({ type: 'mood/play', id: mood.id })))}
    >
      <span className="mood__emoji" aria-hidden>
        {mood.emoji}
      </span>
      <span className="mood__name">{mood.name}</span>
      {mood.oneShot && <span className="mood__once" title="Jeden utwór, potem powrót">↩</span>}
      <span className="mood__kbd">
        <HotkeyBadge combo={combo} selected={selected} />
      </span>
    </button>
  );
}

export function MoodBar() {
  const moods = useAppStore((s) => s.session.moods);
  const openEditor = useAppStore((s) => s.openMoodEditor);
  const playing = useAppStore((s) => s.session.currentMood !== null);

  return (
    <nav className="moods" aria-label="Nastroje muzyki">
      {moods.map((m) => (
        <MoodButton key={m.id} mood={m} />
      ))}
      <div className="moods__tools">
        <button
          type="button"
          className="tool-btn"
          title="Zatrzymaj muzykę (płynnie)"
          disabled={!playing}
          onClick={() => dispatch({ type: 'mood/stop' })}
        >
          ⏹
        </button>
        <button type="button" className="tool-btn" title="Edytuj nastroje i playlisty" onClick={() => openEditor()}>
          ⚙️
        </button>
      </div>
    </nav>
  );
}
