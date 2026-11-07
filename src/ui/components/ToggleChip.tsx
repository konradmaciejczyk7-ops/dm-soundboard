interface Props {
  on: boolean;
  onToggle: () => void;
  label: string;
  title: string;
}

export function ToggleChip({ on, onToggle, label, title }: Props) {
  return (
    <button type="button" className={`chip${on ? ' is-on' : ''}`} aria-pressed={on} title={title} onClick={onToggle}>
      {label}
    </button>
  );
}
