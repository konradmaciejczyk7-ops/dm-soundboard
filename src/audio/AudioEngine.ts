import type { Command } from '../core/commands';
import { FADES } from '../core/defaults';
import type { AmbientLayerDef, BusId, SessionState, SfxDef } from '../core/types';
import { AmbientChannel, type LayerStatusInfo } from './AmbientChannel';
import { BufferCache, type BlobResolver } from './BufferCache';
import { Bus } from './Bus';
import { Ducker } from './Ducker';
import { SfxPlayer } from './SfxPlayer';
import { MusicController, type MusicStatus } from '../music/MusicController';

export interface AudioEngineDeps {
  getLayer: (id: string) => AmbientLayerDef | undefined;
  getSfx: (id: string) => SfxDef | undefined;
  onLayerStatus: (id: string, info: LayerStatusInfo) => void;
  resolvePlaylist: (id: string) => string[] | undefined;
  onMusicStatus: (status: MusicStatus) => void;
  onOneShotEnded: (moodId: string) => void;
  resolveBlob?: BlobResolver;
}

interface Graph {
  ctx: AudioContext;
  master: Bus;
  buses: Record<BusId, Bus>;
  ducker: Ducker;
  ambient: AmbientChannel;
  sfx: SfxPlayer;
  music: MusicController;
}

/**
 * Graf:  warstwy → Ambient ───────────┐
 *        muzyka  → Music → [ducking] ─┼→ Master → Kompresor → głośniki
 *        efekty  → SFX ───────────────┘
 * YouTube gra poza grafem (iframe) – jego głośność liczona jest z tych samych gainów.
 * Silnik nie trzyma stanu UI – wykonuje komendy na podstawie stanu z reducera.
 */
export class AudioEngine {
  private graph: Graph | null = null;

  constructor(private readonly deps: AudioEngineDeps) {}

  get started(): boolean {
    return this.graph !== null;
  }

  /** Musi być wywołane z kliknięcia użytkownika (polityka autoplay przeglądarek). */
  async start(state: SessionState): Promise<void> {
    if (this.graph) {
      await this.graph.ctx.resume();
      return;
    }
    const ctx = new AudioContext({ latencyHint: 'interactive' });

    // Kompresor/limiter chroni przed przesterem, gdy gra wiele rzeczy naraz.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 6;
    limiter.ratio.value = 8;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    limiter.connect(ctx.destination);

    const master = new Bus(ctx, limiter, state.mixer.master);
    const duckNode = ctx.createGain();
    duckNode.connect(master.input);
    const buses: Record<BusId, Bus> = {
      ambient: new Bus(ctx, master.input, state.mixer.ambient),
      music: new Bus(ctx, duckNode, state.mixer.music),
      sfx: new Bus(ctx, master.input, state.mixer.sfx),
    };
    const buffers = new BufferCache(ctx, this.deps.resolveBlob);
    const ducker = new Ducker(ctx, duckNode);
    this.graph = {
      ctx,
      master,
      buses,
      ducker,
      ambient: new AmbientChannel(ctx, buses.ambient.input, buffers, this.deps.onLayerStatus),
      sfx: new SfxPlayer(ctx, buses.sfx.input, buffers, ducker),
      music: new MusicController(
        ctx,
        buses.music.input,
        // Aktualna wartość AudioParamów uwzględnia trwające fade'y i ducking.
        () => buses.music.input.gain.value * duckNode.gain.value * master.input.gain.value,
        {
          resolvePlaylist: this.deps.resolvePlaylist,
          onStatus: this.deps.onMusicStatus,
          onOneShotEnded: this.deps.onOneShotEnded,
        },
      ),
    };
    await ctx.resume();

    // Synchronizacja ze stanem sprzed startu silnika.
    for (const [id, layer] of Object.entries(state.layers)) {
      if (layer.active) this.startLayer(id, layer.volume);
    }
  }

  preloadSfx(defs: SfxDef[]): void {
    this.graph?.sfx.preload(defs);
  }

  /** Wywoływane po zastosowaniu komendy w reducerze; `state` to stan już po zmianie. */
  handle(cmd: Command, state: SessionState): void {
    const g = this.graph;
    if (!g) return; // przed startem – start() zsynchronizuje stan

    switch (cmd.type) {
      case 'layer/set': {
        const layer = state.layers[cmd.id];
        if (!layer) return;
        if (cmd.active !== undefined) {
          if (layer.active) this.startLayer(cmd.id, layer.volume);
          else g.ambient.stop(cmd.id);
        }
        if (cmd.volume !== undefined) g.ambient.setVolume(cmd.id, layer.volume);
        return;
      }
      case 'mixer/set':
        if (cmd.channel === 'master') g.master.setVolume(state.mixer.master);
        else g.buses[cmd.channel].setVolume(state.mixer[cmd.channel]);
        return;
      case 'sfx/play': {
        const def = this.deps.getSfx(cmd.id);
        if (def) void g.sfx.play(def, { humanize: state.options.humanize, duck: state.options.ducking });
        return;
      }
      case 'mood/play': {
        const mood = state.moods.find((m) => m.id === cmd.id);
        if (mood) void g.music.play(mood);
        return;
      }
      case 'mood/stop':
        g.music.stop();
        return;
      case 'music/next':
        g.music.next();
        return;
      case 'moods/set':
        return;
      case 'options/set':
        if (cmd.options.ducking === false) g.ducker.reset();
        return;
      case 'hotkey/set':
        return;
      case 'panic':
        g.ambient.stopAll(FADES.panic);
        g.sfx.stopAll(FADES.panic);
        g.music.stop(FADES.panic);
        g.ducker.reset();
        return;
    }
  }

  private startLayer(id: string, volume: number): void {
    const def = this.deps.getLayer(id);
    if (def) void this.graph?.ambient.start(def, volume);
  }
}
