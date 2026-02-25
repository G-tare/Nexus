import { Readable } from 'stream';

/**
 * PCM Audio Mixer
 * Mixes multiple PCM audio streams into a single output stream.
 *
 * Audio format: 48kHz, stereo, signed 16-bit little-endian (s16le)
 * Frame size: 20ms = 960 samples/channel × 2 channels × 2 bytes = 3840 bytes
 */

const SAMPLE_RATE = 48000;
const CHANNELS = 2;
const BYTES_PER_SAMPLE = 2; // 16-bit
const FRAME_DURATION_MS = 20;
const SAMPLES_PER_FRAME = (SAMPLE_RATE * FRAME_DURATION_MS) / 1000; // 960
const FRAME_SIZE = SAMPLES_PER_FRAME * CHANNELS * BYTES_PER_SAMPLE; // 3840 bytes

const SILENCE_FRAME = Buffer.alloc(FRAME_SIZE, 0);

interface MixerStream {
  readable: Readable;
  buffer: Buffer;
  ended: boolean;
}

export class AudioMixer {
  private streams: Map<string, MixerStream> = new Map();
  private outputStream: Readable | null = null;
  private mixInterval: ReturnType<typeof setInterval> | null = null;
  private destroyed = false;

  /**
   * Add a PCM audio stream for a user.
   * If the user already has a stream, it replaces the old one.
   */
  addStream(userId: string, stream: Readable): void {
    // Clean up existing stream for this user
    this.removeStream(userId);

    const mixerStream: MixerStream = {
      readable: stream,
      buffer: Buffer.alloc(0),
      ended: false,
    };

    // Accumulate incoming PCM data into the buffer
    stream.on('data', (chunk: Buffer) => {
      if (this.destroyed) return;
      mixerStream.buffer = Buffer.concat([mixerStream.buffer, chunk]);
    });

    stream.on('end', () => {
      mixerStream.ended = true;
    });

    stream.on('error', () => {
      mixerStream.ended = true;
    });

    this.streams.set(userId, mixerStream);
  }

  /**
   * Remove a user's audio stream from the mixer.
   */
  removeStream(userId: string): void {
    const existing = this.streams.get(userId);
    if (existing) {
      if (!existing.readable.destroyed) {
        existing.readable.destroy();
      }
      this.streams.delete(userId);
    }
  }

  /**
   * Get the number of active (non-ended) streams.
   */
  get activeStreamCount(): number {
    let count = 0;
    for (const stream of this.streams.values()) {
      if (!stream.ended) count++;
    }
    return count;
  }

  /**
   * Create a mixed output stream that combines all input streams.
   * Starts a 20ms interval tick that reads one frame from each input,
   * mixes them, and pushes the result to the output.
   */
  createMixedStream(): Readable {
    if (this.outputStream) {
      return this.outputStream;
    }

    const output = new Readable({
      read() {
        // Data is pushed via the mix interval
      },
    });

    this.outputStream = output;

    // Mix at 20ms intervals (50 frames/sec)
    this.mixInterval = setInterval(() => {
      if (this.destroyed) return;

      const frame = this.mixFrame();
      if (frame) {
        const canContinue = output.push(frame);
        if (!canContinue) {
          // Backpressure — skip this frame rather than blocking
        }
      }

      // Clean up ended streams that have been fully consumed
      this.cleanupEndedStreams();
    }, FRAME_DURATION_MS);

    return output;
  }

  /**
   * Mix one frame (20ms) from all active streams.
   * Uses Int32 intermediate precision to prevent clipping during summation,
   * then clips back to Int16 range.
   */
  private mixFrame(): Buffer | null {
    const activeFrames: Buffer[] = [];

    for (const [, stream] of this.streams) {
      if (stream.buffer.length >= FRAME_SIZE) {
        // Extract one frame from the buffer
        const frame = stream.buffer.subarray(0, FRAME_SIZE);
        activeFrames.push(Buffer.from(frame));
        stream.buffer = stream.buffer.subarray(FRAME_SIZE);
      } else if (!stream.ended) {
        // Stream is still active but doesn't have enough data — use silence
        activeFrames.push(SILENCE_FRAME);
      }
      // If stream ended and no data left, skip it entirely
    }

    if (activeFrames.length === 0) {
      // No active streams — push silence to keep the audio player alive
      return Buffer.from(SILENCE_FRAME);
    }

    if (activeFrames.length === 1) {
      // Single stream — no mixing needed, pass through directly
      return activeFrames[0];
    }

    // Multi-stream mixing with Int32 intermediate precision
    const mixed = Buffer.alloc(FRAME_SIZE);
    const sampleCount = FRAME_SIZE / BYTES_PER_SAMPLE;

    for (let i = 0; i < sampleCount; i++) {
      let sum = 0;
      const byteOffset = i * BYTES_PER_SAMPLE;

      for (const frame of activeFrames) {
        sum += frame.readInt16LE(byteOffset);
      }

      // Clip to Int16 range [-32768, 32767]
      if (sum > 32767) sum = 32767;
      else if (sum < -32768) sum = -32768;

      mixed.writeInt16LE(sum, byteOffset);
    }

    return mixed;
  }

  /**
   * Remove streams that have ended and have no remaining buffered data.
   */
  private cleanupEndedStreams(): void {
    for (const [userId, stream] of this.streams) {
      if (stream.ended && stream.buffer.length < FRAME_SIZE) {
        this.streams.delete(userId);
      }
    }
  }

  /**
   * Destroy the mixer and all associated streams.
   */
  destroy(): void {
    this.destroyed = true;

    if (this.mixInterval) {
      clearInterval(this.mixInterval);
      this.mixInterval = null;
    }

    for (const [, stream] of this.streams) {
      if (!stream.readable.destroyed) {
        stream.readable.destroy();
      }
    }
    this.streams.clear();

    if (this.outputStream) {
      this.outputStream.push(null); // Signal end of stream
      this.outputStream = null;
    }
  }
}

export { FRAME_SIZE, SAMPLE_RATE, CHANNELS, FRAME_DURATION_MS };
