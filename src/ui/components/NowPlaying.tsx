import { dispatch } from '../../app/session';
import { setYouTubeHost } from '../../music/youtubeHost';
import { useAppStore } from '../../state/store';

const STATE_LABEL = {
  idle: 'Cisza',
  loading: 'Ładowanie…',
  playing: 'Gra',
  error: 'Błąd',
} as const;

export function NowPlaying() {
  const status = useAppStore((s) => s.musicStatus);
  const mood = useAppStore((s) => s.session.moods.find((m) => m.id === s.musicStatus.moodId));
  const isPlaying = status.state === 'playing' || status.state === 'loading';
  const showVideo = status.source === 'youtube' && isPlaying;

  return (
    <section className="panel now-playing">
      <div className={`np-media${showVideo ? ' is-video' : ''}`}>
        <div className="np-art" aria-hidden>
          {mood?.emoji ?? '🎵'}
        </div>
        {/* Tu osadzają się odtwarzacze YouTube – React nie renderuje dzieci tego elementu. */}
        <div className="yt-host" ref={setYouTubeHost} />
      </div>

      <div className="np-info">
        <h2 className="panel__title">Muzyka</h2>
        <div className="np-mood" style={mood ? { color: mood.color } : undefined}>
          {mood ? `${mood.emoji} ${mood.name}` : 'Wybierz nastrój u góry'}
        </div>
        <div className="np-title" title={status.title}>
          {status.state === 'error' ? status.message : (status.title ?? STATE_LABEL[status.state])}
        </div>
        <div className="np-meta">
          {status.source && <span className="np-source">{status.source === 'youtube' ? 'YouTube' : 'Lokalnie'}</span>}
          <span className={`np-state np-state--${status.state}`}>{STATE_LABEL[status.state]}</span>
        </div>
        <div className="np-controls">
          <button type="button" className="tool-btn" title="Następny utwór" disabled={status.state !== 'playing'} onClick={() => dispatch({ type: 'music/next' })}>
            ⏭
          </button>
          <button type="button" className="tool-btn" title="Zatrzymaj muzykę" disabled={!isPlaying} onClick={() => dispatch({ type: 'mood/stop' })}>
            ⏹
          </button>
        </div>
      </div>
    </section>
  );
}
