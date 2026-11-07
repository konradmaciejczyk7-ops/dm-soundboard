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
        <h2 className="panel__title">Effects</h2>
        <SearchBox />
        <ToggleChip
          on={options.humanize}
          label="🎲 Variation"
          title="Slight random pitch and volume change on every play"
          onToggle={() => dispatch({ type: 'options/set', options: { humanize: !options.humanize } })}
        />
        <ToggleChip
          on={options.ducking}
          label="🔉 Ducking"
          title="Lower the music during loud effects"
          onToggle={() => dispatch({ type: 'options/set', options: { ducking: !options.ducking } })}
        />
        <ToggleChip
          on={assignMode}
          label="⌨️ Hotkeys"
          title="Keyboard shortcut assignment mode"
          onToggle={() => setAssignMode(!assignMode)}
        />
      </div>

      <AssignBanner />

      {filtered.length === 0 ? (
        <div className="placeholder-note">
          {library.sfx.length === 0 ? 'No effects in manifest.json' : `No effects matching “${search}”`}
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
