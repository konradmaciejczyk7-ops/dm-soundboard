import { useMemo } from 'react';
import { dispatch } from '../../app/session';
import { filterSfx } from '../../library/search';
import { useAppStore } from '../../state/store';
import { AssignBanner } from './AssignBanner';
import { EffectButton } from './EffectButton';
import { SearchBox } from './SearchBox';
import { ToggleChip } from './ToggleChip';

export function SoundboardPanel() {
  const library = useAppStore((s) => s.library);
  const search = useAppStore((s) => s.ui.search);
  const options = useAppStore((s) => s.session.options);
  const assignMode = useAppStore((s) => s.ui.assignMode);
  const setAssignMode = useAppStore((s) => s.setAssignMode);

  const filtered = useMemo(() => filterSfx(library, search), [library, search]);

  return (
    <section className="panel">
      <div className="panel__header">
        <h2 className="panel__title">Efekty</h2>
        <SearchBox />
        <ToggleChip
          on={options.humanize}
          label="🎲 Losowość"
          title="Lekka losowa zmiana wysokości i głośności przy każdym odtworzeniu"
          onToggle={() => dispatch({ type: 'options/set', options: { humanize: !options.humanize } })}
        />
        <ToggleChip
          on={options.ducking}
          label="🔉 Ducking"
          title="Ściszaj muzykę na czas głośnych efektów"
          onToggle={() => dispatch({ type: 'options/set', options: { ducking: !options.ducking } })}
        />
        <ToggleChip
          on={assignMode}
          label="⌨️ Skróty"
          title="Tryb przypisywania skrótów klawiszowych"
          onToggle={() => setAssignMode(!assignMode)}
        />
      </div>

      <AssignBanner />

      {filtered.length === 0 ? (
        <div className="placeholder-note">
          {library.sfx.length === 0 ? 'Brak efektów w manifest.json' : `Brak efektów dla „${search}”`}
        </div>
      ) : (
        <div className="sfx-columns">
          {library.sfxCategories.map((cat) => {
            const items = filtered.filter((d) => d.category === cat.id);
            if (items.length === 0) return null;
            return (
              <div key={cat.id} className="sfx-cat">
                <h3 className="sfx-cat__title">
                  <span aria-hidden>{cat.emoji}</span> {cat.name}
                </h3>
                <div className="sfx-cat__grid">
                  {items.map((def) => (
                    <EffectButton key={def.id} def={def} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
