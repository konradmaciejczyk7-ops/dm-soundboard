import type { SoundSource } from '../core/types';

export type BlobResolver = (blobId: string) => Promise<Blob | undefined>;

/** Ładuje i dekoduje dźwięki; każde źródło dekodowane jest tylko raz. */
export class BufferCache {
  private readonly cache = new Map<string, Promise<AudioBuffer>>();

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly resolveBlob?: BlobResolver,
  ) {}

  load(source: SoundSource): Promise<AudioBuffer> {
    const key = JSON.stringify(source);
    let pending = this.cache.get(key);
    if (!pending) {
      pending = this.decode(source);
      this.cache.set(key, pending);
      // Błąd nie zostaje w cache – kolejna próba załaduje ponownie.
      pending.catch(() => this.cache.delete(key));
    }
    return pending;
  }

  private async decode(source: SoundSource): Promise<AudioBuffer> {
    switch (source.kind) {
      case 'url':
        return this.decodeUrl(source.url);
      case 'blob': {
        const blob = await this.resolveBlob?.(source.blobId);
        if (!blob) throw new Error(`File ${source.blobId} not found in the database.`);
        return this.ctx.decodeAudioData(await blob.arrayBuffer());
      }
    }
  }

  private async decodeUrl(url: string): Promise<AudioBuffer> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    // Serwer deweloperski dla brakujących plików potrafi oddać index.html.
    if (res.headers.get('content-type')?.includes('text/html')) {
      throw new Error(`Missing file ${url}`);
    }
    return this.ctx.decodeAudioData(await res.arrayBuffer());
  }
}
