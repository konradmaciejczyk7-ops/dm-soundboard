import { DUCK } from '../core/defaults';
import { rampTo } from './gain';

/**
 * Ścisza muzykę na czas głośnych efektów. Licznik „trzymających” obsługuje
 * nakładające się efekty – muzyka wraca dopiero po ostatnim.
 */
export class Ducker {
  private holders = 0;
  private releaseTimer: number | undefined;

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly node: GainNode,
  ) {}

  engage(): void {
    this.holders++;
    window.clearTimeout(this.releaseTimer);
    rampTo(this.node.gain, DUCK.gain, DUCK.attack, this.ctx);
  }

  release(): void {
    this.holders = Math.max(0, this.holders - 1);
    if (this.holders > 0) return;
    window.clearTimeout(this.releaseTimer);
    this.releaseTimer = window.setTimeout(() => {
      rampTo(this.node.gain, 1, DUCK.release, this.ctx);
    }, DUCK.hold * 1000);
  }

  reset(): void {
    this.holders = 0;
    window.clearTimeout(this.releaseTimer);
    rampTo(this.node.gain, 1, DUCK.release, this.ctx);
  }
}
