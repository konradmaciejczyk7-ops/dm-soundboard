import { dispatch } from '../../app/session';
import type { AmbientLayerDef } from '../../core/types';
import { useAppStore } from '../../state/store';
import { useHotkeyTarget } from '../hooks/useHotkeyTarget';
import { HotkeyBadge, preventFocus } from './HotkeyBadge';
import { VolumeSlider } from './VolumeSlider';

export function LayerTile({ def }: { def: AmbientLayerDef }) {
  const layer = useAppStore((s) => s.session.layers[def.id]);
  const status = useAppStore((s) => s.layerStatus[def.id]);
  const { combo, selected, onActivate } = useHotkeyTarget(`layer:${def.id}`);
  if (!layer) return null;

  const loading = layer.active && status?.status === 'loading';
  const error = status?.status === 'error';
  const classes = [
    'tile',
    layer.active && 'is-active',
    loading && 'is-loading',
    error && 'is-error',
    selected && 'is-selected',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      <button
        type="button"
        className="tile__toggle"
        aria-pressed={layer.active}
        onMouseDown={preventFocus}
        onClick={onActivate(() => dispatch({ type: 'layer/set', id: def.id, active: !layer.active }))}
      >
        <span className="tile__emoji" aria-hidden>
          {def.emoji}
        </span>
        <span className="tile__name">{def.name}</span>
        <span className="tile__state">
          {error ? 'file error' : loading ? 'loading…' : layer.active ? 'playing' : 'off'}
        </span>
      </button>
      <span className="tile__kbd">
        <HotkeyBadge combo={combo} selected={selected} />
      </span>
      <div className="tile__slider">
        <VolumeSlider
          value={layer.volume}
          label={`Volume: ${def.name}`}
          onChange={(volume) => dispatch({ type: 'layer/set', id: def.id, volume })}
        />
      </div>
    </div>
  );
}
