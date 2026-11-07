import type { HotkeyTarget, Library } from '../../core/types';
import { useAppStore } from '../../state/store';

function targetLabel(target: HotkeyTarget, library: Library): string {
  if (target === 'panic') return 'PANIC';
  const id = target.slice(target.indexOf(':') + 1);
  if (target.startsWith('sfx:')) return library.sfx.find((d) => d.id === id)?.name ?? id;
  if (target.startsWith('mood:')) return useAppStore.getState().session.moods.find((m) => m.id === id)?.name ?? id;
  return library.ambient.find((d) => d.id === id)?.name ?? id;
}

export function AssignBanner() {
  const { assignMode, assignTarget } = useAppStore((s) => s.ui);
  const library = useAppStore((s) => s.library);
  if (!assignMode) return null;

  return (
    <div className="assign-banner" role="status">
      {assignTarget ? (
        <>
          Naciśnij klawisz dla <strong>{targetLabel(assignTarget, library)}</strong> · Backspace – usuń skrót · Esc –
          anuluj
        </>
      ) : (
        <>Kliknij efekt, warstwę ambientu, nastrój albo PANIC, a potem naciśnij klawisz · Esc – zakończ</>
      )}
    </div>
  );
}
