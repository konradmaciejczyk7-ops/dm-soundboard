import type { KeyboardEvent } from 'react';
import { SEARCH_INPUT_ID } from '../../app/hotkeys';
import { dispatch } from '../../app/session';
import { filterSfx } from '../../library/search';
import { useAppStore } from '../../state/store';

export function SearchBox() {
  const search = useAppStore((s) => s.ui.search);
  const setSearch = useAppStore((s) => s.setSearch);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      // Enter gra pierwszy pasujący efekt.
      const first = filterSfx(useAppStore.getState().library, search)[0];
      if (first) dispatch({ type: 'sfx/play', id: first.id });
    } else if (e.key === 'Escape') {
      setSearch('');
      e.currentTarget.blur();
    }
  };

  return (
    <input
      id={SEARCH_INPUT_ID}
      className="search"
      type="search"
      placeholder="Szukaj efektu…  ( / )"
      autoComplete="off"
      spellCheck={false}
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      onKeyDown={onKeyDown}
    />
  );
}
