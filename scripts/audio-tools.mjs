#!/usr/bin/env node
// Narzędzia do przygotowania dźwięków bez ffmpeg (tylko WAV).
//
//   node scripts/audio-tools.mjs loop  <wej.wav> <wyj.wav> [sekundy=60]
//       Wycina fragment, robi bezszwową pętlę (przenikanie końca z początkiem)
//       i wyrównuje głośność – do warstw ambientu.
//
//   node scripts/audio-tools.mjs split <wej.wav> <prefiks_wyj>
//       Tnie plik z kilkoma uderzeniami na osobne pliki po ciszy:
//       <prefiks>-1.wav, <prefiks>-2.wav… – gotowe warianty efektu.
//
//   node scripts/audio-tools.mjs info  <plik.wav>

import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** @typedef {{ sampleRate: number, channels: Float32Array[] }} Audio */

const dbToGain = (db) => 10 ** (db / 20);

/** Czyta WAV: PCM 8/16/24/32-bit, float32, także WAVE_FORMAT_EXTENSIBLE. */
export function readWav(path) {
  const b = readFileSync(path);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`To nie jest plik WAV: ${path}`);
  }
  let off = 12;
  let fmt = null;
  while (off + 8 <= b.length) {
    const id = b.toString('ascii', off, off + 4);
    const size = b.readUInt32LE(off + 4);
    const body = off + 8;
    if (id === 'fmt ') {
      let tag = b.readUInt16LE(body);
      if (tag === 0xfffe) tag = b.readUInt16LE(body + 24); // pierwsze bajty GUID podformatu
      fmt = { tag, channels: b.readUInt16LE(body + 2), sampleRate: b.readUInt32LE(body + 4), bits: b.readUInt16LE(body + 14) };
    } else if (id === 'data') {
      if (!fmt) throw new Error(`Brak nagłówka fmt: ${path}`);
      const bytes = fmt.bits / 8;
      const frames = Math.floor(Math.min(size, b.length - body) / (bytes * fmt.channels));
      const channels = Array.from({ length: fmt.channels }, () => new Float32Array(frames));
      const read = sampleReader(b, fmt);
      for (let i = 0; i < frames; i++) {
        for (let c = 0; c < fmt.channels; c++) channels[c][i] = read(body + (i * fmt.channels + c) * bytes);
      }
      return { sampleRate: fmt.sampleRate, channels };
    }
    off = body + size + (size % 2);
  }
  throw new Error(`Brak danych audio: ${path}`);
}

function sampleReader(b, { tag, bits }) {
  if (tag === 3 && bits === 32) return (p) => b.readFloatLE(p);
  if (tag !== 1) throw new Error(`Nieobsługiwany format WAV (tag ${tag}, ${bits} bit)`);
  switch (bits) {
    case 8: return (p) => (b[p] - 128) / 128;
    case 16: return (p) => b.readInt16LE(p) / 32768;
    case 24: return (p) => b.readIntLE(p, 3) / 8388608;
    case 32: return (p) => b.readInt32LE(p) / 2147483648;
    default: throw new Error(`Nieobsługiwana głębia: ${bits} bit`);
  }
}

/** Zapisuje 16-bit PCM WAV. */
export function writeWav(path, { sampleRate, channels }) {
  const n = channels[0].length;
  const ch = channels.length;
  const b = Buffer.alloc(44 + n * ch * 2);
  b.write('RIFF', 0, 'ascii');
  b.writeUInt32LE(36 + n * ch * 2, 4);
  b.write('WAVEfmt ', 8, 'ascii');
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(ch, 22);
  b.writeUInt32LE(sampleRate, 24);
  b.writeUInt32LE(sampleRate * ch * 2, 28);
  b.writeUInt16LE(ch * 2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36, 'ascii');
  b.writeUInt32LE(n * ch * 2, 40);
  let p = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++, p += 2) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      b.writeInt16LE(Math.round(s * 32767), p);
    }
  }
  writeFileSync(path, b);
}

export function peak(audio) {
  let m = 0;
  for (const c of audio.channels) for (let i = 0; i < c.length; i++) m = Math.max(m, Math.abs(c[i]));
  return m;
}

export function rms(audio) {
  let sum = 0;
  let n = 0;
  for (const c of audio.channels) {
    for (let i = 0; i < c.length; i++) sum += c[i] * c[i];
    n += c.length;
  }
  return Math.sqrt(sum / (n || 1));
}

function gain(audio, k) {
  for (const c of audio.channels) for (let i = 0; i < c.length; i++) c[i] *= k;
  return audio;
}

export const normalizePeak = (audio, db = -1) => gain(audio, dbToGain(db) / (peak(audio) || 1));

/** Wyrównuje głośność (RMS), ale nie pozwala przekroczyć sufitu szczytowego. */
export function normalizeLoudness(audio, rmsDb = -24, ceilingDb = -1) {
  const r = rms(audio) || 1;
  const k = Math.min(dbToGain(rmsDb) / r, dbToGain(ceilingDb) / (peak(audio) || 1));
  return gain(audio, k);
}

/** Zawsze stereo – mono kopiujemy na oba kanały. */
export const toStereo = (audio) =>
  audio.channels.length >= 2 ? { ...audio, channels: audio.channels.slice(0, 2) } : { ...audio, channels: [audio.channels[0], audio.channels[0].slice()] };

/**
 * Bezszwowa pętla: bierzemy (seconds + seam) sekund i przenikamy nadmiar
 * za końcem z początkiem (equal-power), więc koniec przechodzi płynnie w start.
 */
export function makeLoop(audio, { seconds = 60, seam = 3, margin = 4 } = {}) {
  const sr = audio.sampleRate;
  const total = audio.channels[0].length / sr;
  const len = Math.min(seconds, total - seam - 2 * margin);
  if (len < 10) throw new Error(`Nagranie za krótkie na pętlę (${total.toFixed(1)} s)`);
  // Start w 1/3 wolnego miejsca – omijamy wyciszenia na początku i końcu nagrań.
  const start = Math.floor((margin + (total - 2 * margin - len - seam) / 3) * sr);
  const L = Math.floor(len * sr);
  const S = Math.floor(seam * sr);
  const channels = audio.channels.map((src) => {
    const out = src.slice(start, start + L);
    for (let i = 0; i < S; i++) {
      const t = i / S;
      out[i] = src[start + i] * Math.sin((t * Math.PI) / 2) + src[start + L + i] * Math.cos((t * Math.PI) / 2);
    }
    return out;
  });
  return { sampleRate: sr, channels };
}

/**
 * Dzieli nagranie na pojedyncze zdarzenia po ciszy.
 * Próg liczony względem szczytu całego pliku, krótkie przerwy są sklejane.
 */
export function splitOnSilence(audio, { thresholdDb = -32, tailDb = -50, minGap = 0.12, minLength = 0.06, maxParts = 12 } = {}) {
  const sr = audio.sampleRate;
  const block = Math.floor(0.005 * sr);
  const n = audio.channels[0].length;
  const blocks = Math.ceil(n / block);
  const env = new Float32Array(blocks);
  for (let k = 0; k < blocks; k++) {
    let m = 0;
    for (const c of audio.channels) for (let i = k * block; i < Math.min(n, (k + 1) * block); i++) m = Math.max(m, Math.abs(c[i]));
    env[k] = m;
  }
  const p = peak(audio) || 1;
  const on = dbToGain(thresholdDb) * p;
  const off = dbToGain(tailDb) * p;
  const gapBlocks = Math.ceil((minGap * sr) / block);

  const parts = [];
  let k = 0;
  while (k < blocks) {
    if (env[k] < on) { k++; continue; }
    const s = k;
    let e = k;
    let quiet = 0;
    // Idziemy do przodu, dopóki nie trafimy na dość długą ciszę.
    while (k < blocks && quiet < gapBlocks) {
      if (env[k] >= on) { e = k; quiet = 0; } else quiet++;
      k++;
    }
    // Wybrzmienie: przedłużamy do spadku poniżej progu ogona.
    let tail = e;
    while (tail + 1 < blocks && env[tail + 1] >= off && (tail - e) * block < 1.5 * sr) {
      if (env[tail + 1] >= on) break;
      tail++;
    }
    parts.push([Math.max(0, s - 2), Math.min(blocks, tail + 2)]);
  }

  return parts
    .map(([s, e]) => [s * block, Math.min(n, e * block)])
    .filter(([s, e]) => (e - s) / sr >= minLength)
    .slice(0, maxParts)
    .map(([s, e]) => fade({ sampleRate: sr, channels: audio.channels.map((c) => c.slice(s, e)) }, 0.003, 0.03));
}

/** Krótkie wejście/wyjście – bez trzasków na krawędziach. */
export function fade(audio, inSec, outSec) {
  const sr = audio.sampleRate;
  for (const c of audio.channels) {
    const fi = Math.min(c.length, Math.floor(inSec * sr));
    const fo = Math.min(c.length, Math.floor(outSec * sr));
    for (let i = 0; i < fi; i++) c[i] *= i / fi;
    for (let i = 0; i < fo; i++) c[c.length - 1 - i] *= i / fo;
  }
  return audio;
}

const duration = (a) => a.channels[0].length / a.sampleRate;

// --- CLI ---
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [cmd, input, output, arg] = process.argv.slice(2);
  try {
    if (cmd === 'loop' && input && output) {
      const loop = normalizeLoudness(makeLoop(toStereo(readWav(input)), { seconds: Number(arg) || 60 }));
      writeWav(output, loop);
      console.log(`Pętla ${duration(loop).toFixed(1)} s → ${output}`);
    } else if (cmd === 'split' && input && output) {
      const parts = splitOnSilence(readWav(input));
      parts.forEach((part, i) => writeWav(`${output}-${i + 1}.wav`, normalizePeak(part)));
      console.log(`${parts.length} części → ${output}-N.wav`);
    } else if (cmd === 'info' && input) {
      const a = readWav(input);
      console.log(`${duration(a).toFixed(2)} s, ${a.sampleRate} Hz, ${a.channels.length} kan., szczyt ${(20 * Math.log10(peak(a))).toFixed(1)} dB`);
    } else {
      console.log('Użycie: node scripts/audio-tools.mjs loop|split|info <wej.wav> [wyj] [sekundy]');
      process.exitCode = 1;
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}
