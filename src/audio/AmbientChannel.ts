import { FADES } from '../core/defaults';
import type { AmbientLayerDef } from '../core/types';
import type { BufferCache } from './BufferCache';
import { rampTo, sliderToGain } from './gain';

export type LayerStatus = 'idle' | 'loading' | 'playing' | 'error';

export interface LayerStatusInfo {
  status: LayerStatus;
}

interface Voice {
  gain: GainNode;
  source: AudioBufferSourceNode | null;
  active: boolean;
  /** Docelowa głośność suwaka – czytana także po zakończeniu ładowania. */
  volume: number;
  /** Rośnie przy każdym start/stop; pozwala porzucić nieaktualne operacje asynchroniczne. */
  token: number;
  stopTimer: number | undefined;
}

/** Zarządza zapętlonymi warstwami ambientu: każda ma własny GainNode do fade'ów. */
export class AmbientChannel {
  private readonly voices = new Map<string, Voice>();

  constructor(
    private readonly ctx: AudioContext,
    private readonly output: AudioNode,
    private readonly buffers: BufferCache,
    private readonly onStatus: (id: string, info: LayerStatusInfo) => void,
  ) {}

  async start(layer: AmbientLayerDef, volume: number, fade: number = FADES.ambient): Promise<void> {
    const v = this.voice(layer.id);
    const token = ++v.token;
    window.clearTimeout(v.stopTimer);
    v.active = true;
    v.volume = volume;

    // Warstwa jeszcze wygasa – po prostu odwracamy fade, bez restartu pętli.
    if (v.source) {
      rampTo(v.gain.gain, sliderToGain(v.volume), fade, this.ctx);
      this.emit(layer.id, 'playing');
      return;
    }

    this.emit(layer.id, 'loading');
    let buffer: AudioBuffer;
    try {
      buffer = await this.buffers.load(layer.source);
    } catch (err) {
      console.error(`[audio] Nie udało się załadować warstwy ${layer.id}`, err);
      if (token === v.token) this.emit(layer.id, 'error');
      return;
    }
    // W trakcie ładowania warstwę wyłączono albo włączono ponownie.
    if (token !== v.token) return;

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.connect(v.gain);
    // Losowy punkt startu – ta sama warstwa nie brzmi za każdym razem identycznie.
    src.start(0, Math.random() * buffer.duration);
    v.source = src;
    rampTo(v.gain.gain, sliderToGain(v.volume), fade, this.ctx);
    this.emit(layer.id, 'playing');
  }

  stop(id: string, fade: number = FADES.ambient): void {
    const v = this.voices.get(id);
    if (!v || !v.active) return;
    const token = ++v.token;
    v.active = false;
    window.clearTimeout(v.stopTimer);
    rampTo(v.gain.gain, 0, fade, this.ctx);

    if (!v.source) {
      this.emit(id, 'idle');
      return;
    }
    v.stopTimer = window.setTimeout(() => {
      if (token !== v.token || !v.source) return;
      v.source.stop();
      v.source.disconnect();
      v.source = null;
      this.emit(id, 'idle');
    }, fade * 1000 + 50);
  }

  setVolume(id: string, volume: number): void {
    const v = this.voices.get(id);
    if (!v) return;
    v.volume = volume;
    if (v.active && v.source) rampTo(v.gain.gain, sliderToGain(volume), FADES.volume, this.ctx);
  }

  stopAll(fade: number): void {
    for (const id of this.voices.keys()) this.stop(id, fade);
  }

  private voice(id: string): Voice {
    let v = this.voices.get(id);
    if (!v) {
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      gain.connect(this.output);
      v = { gain, source: null, active: false, volume: 0, token: 0, stopTimer: undefined };
      this.voices.set(id, v);
    }
    return v;
  }

  private emit(id: string, status: LayerStatus): void {
    this.onStatus(id, { status });
  }
}
