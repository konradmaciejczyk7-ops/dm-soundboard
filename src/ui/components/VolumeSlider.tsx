import type { CSSProperties } from 'react';

interface Props {
  value: number;
  onChange: (value: number) => void;
  label: string;
}

export function VolumeSlider({ value, onChange, label }: Props) {
  return (
    <input
      className="slider"
      type="range"
      min={0}
      max={1}
      step={0.01}
      value={value}
      aria-label={label}
      style={{ '--fill': `${value * 100}%` } as CSSProperties}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}
