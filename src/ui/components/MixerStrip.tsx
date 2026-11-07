import { dispatch } from '../../app/session';
import type { MixerChannel } from '../../core/types';
import { useAppStore } from '../../state/store';
import { VolumeSlider } from './VolumeSlider';

const CHANNELS: Array<{ id: MixerChannel; label: string }> = [
  { id: 'master', label: 'Master' },
  { id: 'ambient', label: 'Ambient' },
  { id: 'music', label: 'Muzyka' },
  { id: 'sfx', label: 'Efekty' },
];

export function MixerStrip() {
  const mixer = useAppStore((s) => s.session.mixer);

  return (
    <footer className="mixer panel">
      {CHANNELS.map(({ id, label }) => (
        <label key={id} className={`mixer__channel${id === 'master' ? ' mixer__channel--master' : ''}`}>
          <span className="mixer__label">{label}</span>
          <VolumeSlider
            value={mixer[id]}
            label={`Głośność: ${label}`}
            onChange={(volume) => dispatch({ type: 'mixer/set', channel: id, volume })}
          />
          <span className="mixer__value">{Math.round(mixer[id] * 100)}</span>
        </label>
      ))}
    </footer>
  );
}
