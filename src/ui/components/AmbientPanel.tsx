import { useAppStore } from '../../state/store';
import { LayerTile } from './LayerTile';

export function AmbientPanel() {
  const defs = useAppStore((s) => s.library.ambient);

  return (
    <section className="panel">
      <h2 className="panel__title">Ambient</h2>
      {defs.length === 0 ? (
        <div className="placeholder-note">Brak warstw – sprawdź public/sounds/manifest.json</div>
      ) : (
        <div className="tile-grid">
          {defs.map((def) => (
            <LayerTile key={def.id} def={def} />
          ))}
        </div>
      )}
    </section>
  );
}
