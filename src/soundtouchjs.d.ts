declare module 'soundtouchjs' {
  export class SoundTouch {
    tempo: number;
    pitchSemitones: number;
    stretch: { quickSeek: boolean; setParameters(sampleRate: number, sequenceMs: number, seekWindowMs: number, overlapMs: number): void };
  }
  export class SimpleFilter {
    constructor(source: { extract(target: Float32Array, frames: number, position: number): number }, pipe: SoundTouch);
    extract(target: Float32Array, frames: number): number;
  }
}
