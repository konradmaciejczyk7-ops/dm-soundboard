import { dispatch } from '../../app/session';
import { useHotkeyTarget } from '../hooks/useHotkeyTarget';
import { HotkeyBadge } from './HotkeyBadge';

export function PanicButton() {
  const { combo, selected, onActivate } = useHotkeyTarget('panic');

  return (
    <button
      type="button"
      className={`panic${selected ? ' is-selected' : ''}`}
      title="Fades everything out in 1 s"
      onClick={onActivate(() => dispatch({ type: 'panic' }))}
    >
      PANIC
      <HotkeyBadge combo={combo} selected={selected} />
    </button>
  );
}
