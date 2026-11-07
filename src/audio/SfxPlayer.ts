import { HUMANIZE } from '../core/defaults';
import type { SfxDef } from '../core/types';
import type { BufferCache } from './BufferCache';
import type { Ducker } from './Ducker';
import { rampTo, sliderToGain } from './gain';

interface PlayingSfx {
  src: AudioBufferSourceNode;
  gain: GainNode;
}

export interface SfxPlayOptions {
  humanize: boolean;
  duck: boolean;
}

/** Jednorazowe efekty: każde kliknięcie to nowe źródło, więc efekty mogą się nakładać. */
export class SfxPlayer {
  private readonly lastVariant = new Map<string, number>();
  private readonly playing = new Set<PlayingSfx>();

  constructor(
    private readonly ctx: AudioContext,
    private readonly output: AudioNode,
    private readonly buffers: BufferCache,
    private readonly ducker: Ducker,
  ) {}

  /** Dekoduje wszystko z góry, żeby pierwsze kliknięcie nie miało opóźnienia. */
  preload(defs: SfxDef[]): void {
    for (const def of defs) {
      for (const v of def.variants) this.buffers.load(v).catch(() => undefined);
    }
  }

  async play(def: SfxDef, opts: SfxPlayOptions): Promise<void> {
    if (def.variants.length === 0) return;
    const variant = def.variants[this.pickVariant(def)];

    let buffer: AudioBuffer;
    try {
      buffer = await this.buffers.load(variant);
    } catch (err) {
      console.error(`[audio] Nie udało się załadować efektu ${def.id}`, err);
      return;
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const gain = this.ctx.createGain();
    let level = sliderToGain(def.volume);
    if (opts.humanize && def.randomize) {
      src.playbackRate.value = 2 ** ((Math.random() * 2 - 1) * HUMANIZE.cents / 1200);
      level *= 1 + (Math.random() * 2 - 1) * HUMANIZE.gain;
    }
    gain.gain.value = level;
    src.connect(gain).connect(this.output);

    const ducks = opts.duck && def.loud;
    if (ducks) this.ducker.engage();

    const entry: PlayingSfx = { src, gain };
    this.playing.add(entry);
    src.onended = () => {
      this.playing.delete(entry);
      src.disconnect();
      gain.disconnect();
      if (ducks) this.ducker.release();
    };
    src.start();
  }

  stopAll(fade: number): void {
    for (const { src, gain } of this.playing) {
      rampTo(gain.gain, 0, fade, this.ctx);
      try {
        src.stop(this.ctx.currentTime + fade);
      } catch {
        // już zatrzymany
      }
    }
  }

  /** Losuje wariant inny niż ostatnio zagrany (gdy jest z czego wybierać). */
  private pickVariant(def: SfxDef): number {
    const n = def.variants.length;
    const last = this.lastVariant.get(def.id);
    let i: number;
    if (n === 1) i = 0;
    else if (last === undefined) i = Math.floor(Math.random() * n);
    else {
      i = Math.floor(Math.random() * (n - 1));
      if (i >= last) i++;
    }
    this.lastVariant.set(def.id, i);
    return i;
  }
}
