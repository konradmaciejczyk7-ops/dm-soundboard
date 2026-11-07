import { useState, type KeyboardEvent } from 'react';
import { dispatch } from '../../app/session';
import type { MoodDef, MusicPlaylist, MusicSource } from '../../core/types';
import { parseYouTubeUrl } from '../../music/youtubeUrl';
import { useAppStore } from '../../state/store';

type SourceKind = 'none' | 'youtube' | 'local';

/** Wersja robocza wiersza – pola formularza trzymamy osobno, żeby przełączanie źródła nie gubiło wpisanego linku. */
interface Draft {
  mood: MoodDef;
  kind: SourceKind;
  url: string;
  playlist: string;
}

const toDraft = (mood: MoodDef): Draft => ({
  mood,
  kind: mood.source?.kind ?? 'none',
  url: mood.source?.kind === 'youtube' ? mood.source.url : '',
  playlist: mood.source?.kind === 'local' ? mood.source.playlist : '',
});

function sourceFromDraft(d: Draft): MusicSource | null {
  if (d.kind === 'local') return d.playlist ? { kind: 'local', playlist: d.playlist } : null;
  if (d.kind === 'youtube') {
    const ref = parseYouTubeUrl(d.url);
    return ref ? { kind: 'youtube', url: d.url.trim(), ...ref } : null;
  }
  return null;
}

const youtubeInvalid = (d: Draft) => d.kind === 'youtube' && d.url.trim() !== '' && !parseYouTubeUrl(d.url);

export function MoodEditor() {
  const open = useAppStore((s) => s.ui.moodEditor.open);
  return open ? <MoodEditorDialog /> : null;
}

function MoodEditorDialog() {
  const moods = useAppStore((s) => s.session.moods);
  const playlists = useAppStore((s) => s.library.music);
  const focusId = useAppStore((s) => s.ui.moodEditor.focusId);
  const close = useAppStore((s) => s.closeMoodEditor);
  const [drafts, setDrafts] = useState<Draft[]>(() => moods.map(toDraft));

  const update = (i: number, patch: Partial<Draft> | ((d: Draft) => Partial<Draft>)) =>
    setDrafts((list) => list.map((d, j) => (j === i ? { ...d, ...(typeof patch === 'function' ? patch(d) : patch) } : d)));
  const updateMood = (i: number, patch: Partial<MoodDef>) => update(i, (d) => ({ mood: { ...d.mood, ...patch } }));
  const move = (i: number, delta: number) =>
    setDrafts((list) => {
      const j = i + delta;
      if (j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const remove = (i: number) => setDrafts((list) => list.filter((_, j) => j !== i));
  const add = () =>
    setDrafts((list) => [
      ...list,
      toDraft({ id: `mood-${Date.now().toString(36)}`, name: 'Nowy nastrój', emoji: '🎵', color: '#9d93ab', source: null, oneShot: false, returnTo: null }),
    ]);

  const invalid = drafts.some(youtubeInvalid) || drafts.some((d) => !d.mood.name.trim());
  const save = () => {
    if (invalid) return;
    dispatch({
      type: 'moods/set',
      moods: drafts.map((d) => ({ ...d.mood, name: d.mood.name.trim(), source: sourceFromDraft(d) })),
    });
    close();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };

  return (
    <div className="overlay" onKeyDown={onKeyDown}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="mood-editor-title">
        <header className="dialog__header">
          <h2 id="mood-editor-title">Nastroje i playlisty</h2>
          <button type="button" className="tool-btn" title="Zamknij (Esc)" onClick={close}>
            ✕
          </button>
        </header>

        <p className="dialog__hint">
          <strong>YouTube:</strong> wklej link do playlisty lub filmu (publiczna albo niepubliczna, nie prywatna). Żeby
          nie było reklam, bądź zalogowany na YouTube Premium w tej przeglądarce.
          <br />
          <strong>Lokalnie:</strong> wrzuć pliki do <code>public/sounds/music/&lt;nazwa&gt;/</code> i odśwież stronę –
          folder pojawi się na liście.
        </p>

        <div className="mood-rows">
          <div className="mood-row mood-row--head">
            <span>Ikona</span>
            <span>Nazwa</span>
            <span>Kolor</span>
            <span>Źródło</span>
            <span>Muzyka</span>
            <span>Jeden utwór, potem…</span>
            <span />
          </div>
          {drafts.map((d, i) => (
            <MoodRow
              key={d.mood.id}
              draft={d}
              index={i}
              count={drafts.length}
              others={drafts.filter((o) => o.mood.id !== d.mood.id).map((o) => o.mood)}
              playlists={playlists}
              autoFocus={d.mood.id === focusId}
              onDraft={(patch) => update(i, patch)}
              onMood={(patch) => updateMood(i, patch)}
              onMove={(delta) => move(i, delta)}
              onRemove={() => remove(i)}
            />
          ))}
        </div>

        <footer className="dialog__footer">
          <button type="button" className="chip" onClick={add}>
            ＋ Dodaj nastrój
          </button>
          <span className="dialog__spacer" />
          <button type="button" className="chip" onClick={close}>
            Anuluj
          </button>
          <button type="button" className="chip is-on" disabled={invalid} onClick={save}>
            Zapisz
          </button>
        </footer>
      </div>
    </div>
  );
}

interface RowProps {
  draft: Draft;
  index: number;
  count: number;
  others: MoodDef[];
  playlists: MusicPlaylist[];
  autoFocus: boolean;
  onDraft: (patch: Partial<Draft>) => void;
  onMood: (patch: Partial<MoodDef>) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}

function MoodRow({ draft: d, index, count, others, playlists, autoFocus, onDraft, onMood, onMove, onRemove }: RowProps) {
  const ref = d.kind === 'youtube' ? parseYouTubeUrl(d.url) : null;

  return (
    <div className={`mood-row${autoFocus ? ' is-focused' : ''}`}>
      <input
        className="field field--emoji"
        value={d.mood.emoji}
        maxLength={4}
        aria-label="Ikona"
        onChange={(e) => onMood({ emoji: e.target.value })}
      />
      <input className="field" value={d.mood.name} aria-label="Nazwa" onChange={(e) => onMood({ name: e.target.value })} />
      <input
        className="field field--color"
        type="color"
        value={d.mood.color}
        aria-label="Kolor"
        onChange={(e) => onMood({ color: e.target.value })}
      />
      <select
        className="field"
        value={d.kind}
        aria-label="Źródło muzyki"
        autoFocus={autoFocus}
        onChange={(e) => onDraft({ kind: e.target.value as SourceKind })}
      >
        <option value="none">— brak —</option>
        <option value="youtube">YouTube</option>
        <option value="local">Lokalne pliki</option>
      </select>

      <div className="mood-row__source">
        {d.kind === 'youtube' && (
          <>
            <input
              className={`field${youtubeInvalid(d) ? ' is-invalid' : ''}`}
              placeholder="https://www.youtube.com/playlist?list=…"
              value={d.url}
              spellCheck={false}
              aria-label="Link YouTube"
              onChange={(e) => onDraft({ url: e.target.value })}
            />
            <span className="field-note">
              {!d.url.trim() ? '' : ref ? (ref.playlistId ? '✓ playlista' : '✓ film') : '✗ to nie link YouTube'}
            </span>
          </>
        )}
        {d.kind === 'local' &&
          (playlists.length === 0 ? (
            <span className="field-note">Brak folderów w public/sounds/music/</span>
          ) : (
            <select className="field" value={d.playlist} aria-label="Folder z muzyką" onChange={(e) => onDraft({ playlist: e.target.value })}>
              <option value="">— wybierz folder —</option>
              {playlists.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.files.length})
                </option>
              ))}
            </select>
          ))}
      </div>

      <div className="mood-row__once">
        <input
          type="checkbox"
          checked={d.mood.oneShot}
          aria-label="Jeden utwór, potem przejdź dalej"
          onChange={(e) => onMood({ oneShot: e.target.checked })}
        />
        <select
          className="field"
          disabled={!d.mood.oneShot}
          value={d.mood.returnTo ?? ''}
          aria-label="Po utworze przejdź do"
          onChange={(e) => onMood({ returnTo: e.target.value || null })}
        >
          <option value="">zatrzymaj muzykę</option>
          {others.map((m) => (
            <option key={m.id} value={m.id}>
              {m.emoji} {m.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mood-row__actions">
        <button type="button" className="tool-btn tool-btn--sm" title="W górę" disabled={index === 0} onClick={() => onMove(-1)}>
          ↑
        </button>
        <button type="button" className="tool-btn tool-btn--sm" title="W dół" disabled={index === count - 1} onClick={() => onMove(1)}>
          ↓
        </button>
        <button type="button" className="tool-btn tool-btn--sm" title="Usuń nastrój" onClick={onRemove}>
          🗑
        </button>
      </div>
    </div>
  );
}
