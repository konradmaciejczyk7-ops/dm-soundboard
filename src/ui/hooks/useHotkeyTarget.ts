import type { HotkeyTarget } from '../../core/types';
import { useAppStore } from '../../state/store';

/** Wspólna logika elementów, do których można przypiąć skrót (efekt, warstwa, PANIC). */
export function useHotkeyTarget(target: HotkeyTarget) {
  const combo = useAppStore((s) => s.session.hotkeys[target]);
  const assignMode = useAppStore((s) => s.ui.assignMode);
  const selected = useAppStore((s) => s.ui.assignTarget === target);

  return {
    combo,
    assignMode,
    selected,
    /** W trybie przypisywania kliknięcie wybiera cel; poza nim wykonuje akcję. */
    onActivate: (action: () => void) => () => {
      if (assignMode) useAppStore.getState().setAssignTarget(target);
      else action();
    },
  };
}
