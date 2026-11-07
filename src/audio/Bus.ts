import { FADES } from '../core/defaults';
import { rampTo, sliderToGain } from './gain';

/** Szyna miksera: wszystko, co do niej wpada, przechodzi przez jeden GainNode. */
export class Bus {
  readonly input: GainNode;

  constructor(
    private readonly ctx: BaseAudioContext,
    destination: AudioNode,
    volume: number,
  ) {
    this.input = ctx.createGain();
    this.input.gain.value = sliderToGain(volume);
    this.input.connect(destination);
  }

  setVolume(volume: number, fade: number = FADES.volume): void {
    rampTo(this.input.gain, sliderToGain(volume), fade, this.ctx);
  }
}
