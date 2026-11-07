/** Suwak 0..1 → gain. Krzywa kwadratowa jest bliższa temu, jak słyszymy głośność. */
export function sliderToGain(v: number): number {
  return v <= 0 ? 0 : v * v;
}

const CURVE_POINTS = 64;

/**
 * Płynna zmiana parametru od jego bieżącej wartości do `target`.
 * Narastanie po sinusie, opadanie po (1 - cos) – para equal-power, więc
 * przy crossfadzie dwóch źródeł nie ma „dziury” głośności w środku.
 * Bezpieczne do wywołania w trakcie trwającego fade'a (bez skoku).
 */
export function rampTo(
  param: AudioParam,
  target: number,
  seconds: number,
  ctx: BaseAudioContext,
): void {
  const now = ctx.currentTime;
  const from = param.value;
  param.cancelScheduledValues(now);
  if (seconds <= 0 || Math.abs(from - target) < 1e-4) {
    param.setValueAtTime(target, now);
    return;
  }
  const rising = target > from;
  const curve = new Float32Array(CURVE_POINTS);
  for (let i = 0; i < CURVE_POINTS; i++) {
    const t = i / (CURVE_POINTS - 1);
    const shape = rising ? Math.sin((t * Math.PI) / 2) : 1 - Math.cos((t * Math.PI) / 2);
    curve[i] = from + (target - from) * shape;
  }
  param.setValueCurveAtTime(curve, now, seconds);
}
