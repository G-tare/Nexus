import {
  joinVoiceChannel,
  VoiceConnection,
  VoiceConnectionStatus,
  entersState,
  createAudioPlayer,
  createAudioResource,
  AudioPlayer,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
  EndBehaviorType,
  AudioReceiveStream,
} from '@discordjs/voice';
import { opus } from 'prism-media';
import { Readable, Transform, TransformCallback } from 'stream';
import { Client, VoiceChannel, Guild } from 'discord.js';
import { AudioMixer } from './mixer';
import { createModuleLogger } from '../../Shared/src/utils/logger';

const logger = createModuleLogger('VoicePhone');

interface RelaySide {
  guildId: string;
  voiceChannelId: string;
  connection: VoiceConnection | null;
  player: AudioPlayer;
  mixer: AudioMixer;
  speakers: Map<string, AudioReceiveStream>;
  speakerDecoders: Map<string, opus.Decoder>;
}

export interface VoiceRelayOptions {
  maxSpeakersPerSide: number;
  bitrate: number;
}

const DEFAULT_OPTIONS: VoiceRelayOptions = {
  maxSpeakersPerSide: 5,
  bitrate: 64000,
};

/**
 * VoiceRelay manages the audio pipeline between two voice channels
 * in different guilds. It subscribes to speakers on each side and
 * relays mixed audio to the other side.
 */
export class VoiceRelay {
  public readonly callId: string;
  public side1: RelaySide;
  public side2: RelaySide;
  private options: VoiceRelayOptions;
  private destroyed = false;
  private mixedOutputs: Map<string, Readable> = new Map();
  private encoders: Map<string, opus.Encoder> = new Map();

  constructor(
    callId: string,
    guild1Id: string,
    vc1Id: string,
    guild2Id: string,
    vc2Id: string,
    options?: Partial<VoiceRelayOptions>,
  ) {
    this.callId = callId;
    this.options = { ...DEFAULT_OPTIONS, ...options };

    this.side1 = this.createSide(guild1Id, vc1Id);
    this.side2 = this.createSide(guild2Id, vc2Id);
  }

  private createSide(guildId: string, voiceChannelId: string): RelaySide {
    return {
      guildId,
      voiceChannelId,
      connection: null,
      player: createAudioPlayer({
        behaviors: { noSubscriber: NoSubscriberBehavior.Play },
      }),
      mixer: new AudioMixer(),
      speakers: new Map(),
      speakerDecoders: new Map(),
    };
  }

  /**
   * Join both voice channels and start the audio relay.
   */
  async initialize(client: Client): Promise<void> {
    logger.info(`[Relay ${this.callId}] Initializing voice connections...`);

    // Join both voice channels concurrently
    const [conn1, conn2] = await Promise.all([
      this.joinChannel(client, this.side1),
      this.joinChannel(client, this.side2),
    ]);

    this.side1.connection = conn1;
    this.side2.connection = conn2;

    // Set up audio pipelines: Side 1 speakers → Side 2 player, and vice versa
    this.setupReceiver(this.side1, this.side2);
    this.setupReceiver(this.side2, this.side1);

    // Start playing mixed audio on each side
    this.startPlayback(this.side1, this.side2);
    this.startPlayback(this.side2, this.side1);

    logger.info(`[Relay ${this.callId}] Audio relay active.`);
  }

  /**
   * Join a voice channel and wait for the connection to be ready.
   */
  private async joinChannel(client: Client, side: RelaySide): Promise<VoiceConnection> {
    const guild = client.guilds.cache.get(side.guildId);
    if (!guild) throw new Error(`Guild ${side.guildId} not found`);

    const channel = guild.channels.cache.get(side.voiceChannelId) as VoiceChannel;
    if (!channel) throw new Error(`Voice channel ${side.voiceChannelId} not found`);

    const connection = joinVoiceChannel({
      channelId: side.voiceChannelId,
      guildId: side.guildId,
      adapterCreator: guild.voiceAdapterCreator as any,
      selfDeaf: false, // Critical: must receive audio
      selfMute: false,
    });

    // Wait for Ready state (up to 20 seconds)
    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
    } catch {
      connection.destroy();
      throw new Error(`Failed to connect to voice channel in guild ${side.guildId}`);
    }

    // Handle disconnections
    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      if (this.destroyed) return;
      try {
        // Try to reconnect
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
        // Reconnecting...
      } catch {
        // Could not reconnect — cleanup
        logger.warn(`[Relay ${this.callId}] Connection lost in guild ${side.guildId}`);
        this.cleanup();
      }
    });

    return connection;
  }

  /**
   * Subscribe to speakers on the source side so their audio
   * can be mixed and played on the target side.
   */
  private setupReceiver(source: RelaySide, _target: RelaySide): void {
    if (!source.connection) return;

    const receiver = source.connection.receiver;

    // Listen for new speakers
    receiver.speaking.on('start', (userId: string) => {
      if (this.destroyed) return;
      if (source.speakers.has(userId)) return; // Already subscribed

      // Enforce max speakers limit
      if (source.speakers.size >= this.options.maxSpeakersPerSide) {
        logger.debug(`[Relay ${this.callId}] Max speakers reached on side ${source.guildId}, ignoring ${userId}`);
        return;
      }

      this.subscribeSpeaker(source, userId);
    });
  }

  /**
   * Subscribe to a speaker's audio and pipe it into the mixer for the opposite side.
   */
  private subscribeSpeaker(source: RelaySide, userId: string): void {
    if (!source.connection) return;

    logger.debug(`[Relay ${this.callId}] Subscribing to speaker ${userId} on side ${source.guildId}`);

    // Subscribe to the user's Opus audio stream
    const opusStream = source.connection.receiver.subscribe(userId, {
      end: { behavior: EndBehaviorType.AfterSilence, duration: 1000 },
    });

    source.speakers.set(userId, opusStream);

    // Decode Opus → PCM for mixing
    const decoder = new opus.Decoder({
      frameSize: 960,
      channels: 2,
      rate: 48000,
    });

    source.speakerDecoders.set(userId, decoder);

    // Pipe opus stream through decoder into the TARGET side's mixer
    const target = source === this.side1 ? this.side2 : this.side1;
    const mixerKey = `${source.guildId}:${userId}`;

    opusStream.pipe(decoder);
    target.mixer.addStream(mixerKey, decoder);

    // Handle stream ending (user stops speaking)
    opusStream.on('end', () => {
      this.unsubscribeSpeaker(source, userId);
    });

    opusStream.on('error', (err: Error) => {
      logger.debug(`[Relay ${this.callId}] Opus stream error for ${userId}: ${err.message}`);
      this.unsubscribeSpeaker(source, userId);
    });
  }

  /**
   * Unsubscribe from a speaker and remove them from the mixer.
   */
  unsubscribeSpeaker(source: RelaySide, userId: string): void {
    const opusStream = source.speakers.get(userId);
    const decoder = source.speakerDecoders.get(userId);

    if (opusStream && !opusStream.destroyed) {
      opusStream.destroy();
    }
    if (decoder && !decoder.destroyed) {
      decoder.destroy();
    }

    source.speakers.delete(userId);
    source.speakerDecoders.delete(userId);

    // Remove from the target side's mixer
    const target = source === this.side1 ? this.side2 : this.side1;
    const mixerKey = `${source.guildId}:${userId}`;
    target.mixer.removeStream(mixerKey);
  }

  /**
   * Start playing mixed audio from sourceSide's speakers on targetSide.
   * Creates the PCM mixed stream → Opus encoder → AudioResource → AudioPlayer pipeline.
   */
  private startPlayback(targetSide: RelaySide, sourceSide: RelaySide): void {
    if (!targetSide.connection) return;

    // The target side's mixer contains PCM from sourceSide's speakers
    // We need to encode it to Opus and play it
    const mixedPcm = targetSide.mixer.createMixedStream();
    this.mixedOutputs.set(targetSide.guildId, mixedPcm);

    // Encode PCM → Opus
    const encoder = new opus.Encoder({
      frameSize: 960,
      channels: 2,
      rate: 48000,
    });

    if (this.options.bitrate) {
      encoder.setBitrate(this.options.bitrate);
    }

    this.encoders.set(targetSide.guildId, encoder);

    mixedPcm.pipe(encoder);

    // Create audio resource from the Opus stream
    const resource = createAudioResource(encoder, {
      inputType: StreamType.Opus,
    });

    targetSide.player.play(resource);
    targetSide.connection.subscribe(targetSide.player);

    // Handle player errors
    targetSide.player.on('error', (error) => {
      logger.error(`[Relay ${this.callId}] Player error on ${targetSide.guildId}: ${error.message}`);
    });
  }

  /**
   * Get the number of active speakers on a side.
   */
  getSpeakerCount(side: 'side1' | 'side2'): number {
    return this[side].speakers.size;
  }

  /**
   * Check if a user is currently speaking on either side.
   */
  isUserSpeaking(userId: string): boolean {
    return this.side1.speakers.has(userId) || this.side2.speakers.has(userId);
  }

  /**
   * Get the side a guild belongs to, or null if not part of this relay.
   */
  getSide(guildId: string): RelaySide | null {
    if (this.side1.guildId === guildId) return this.side1;
    if (this.side2.guildId === guildId) return this.side2;
    return null;
  }

  /**
   * Get the opposite side from a given guild.
   */
  getOtherSide(guildId: string): RelaySide | null {
    if (this.side1.guildId === guildId) return this.side2;
    if (this.side2.guildId === guildId) return this.side1;
    return null;
  }

  /**
   * Destroy the relay and clean up all resources.
   */
  cleanup(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    logger.info(`[Relay ${this.callId}] Cleaning up...`);

    this.cleanupSide(this.side1);
    this.cleanupSide(this.side2);

    // Clean up encoders
    for (const [, encoder] of this.encoders) {
      if (!encoder.destroyed) encoder.destroy();
    }
    this.encoders.clear();

    // Clean up mixed outputs
    for (const [, output] of this.mixedOutputs) {
      if (!output.destroyed) output.destroy();
    }
    this.mixedOutputs.clear();
  }

  private cleanupSide(side: RelaySide): void {
    // Stop all speaker subscriptions
    for (const [userId] of side.speakers) {
      const opusStream = side.speakers.get(userId);
      const decoder = side.speakerDecoders.get(userId);
      if (opusStream && !opusStream.destroyed) opusStream.destroy();
      if (decoder && !decoder.destroyed) decoder.destroy();
    }
    side.speakers.clear();
    side.speakerDecoders.clear();

    // Stop the player
    side.player.stop(true);

    // Destroy the mixer
    side.mixer.destroy();

    // Destroy the voice connection
    if (side.connection && side.connection.state.status !== VoiceConnectionStatus.Destroyed) {
      side.connection.destroy();
    }
    side.connection = null;
  }

  get isDestroyed(): boolean {
    return this.destroyed;
  }
}

/**
 * Global map of active voice relays, keyed by callId.
 */
export const activeRelays: Map<string, VoiceRelay> = new Map();

/**
 * Find the active relay for a given voice channel.
 */
export function findRelayByVoiceChannel(voiceChannelId: string): VoiceRelay | null {
  for (const relay of activeRelays.values()) {
    if (relay.side1.voiceChannelId === voiceChannelId || relay.side2.voiceChannelId === voiceChannelId) {
      return relay;
    }
  }
  return null;
}

/**
 * Find the active relay for a given guild.
 */
export function findRelayByGuild(guildId: string): VoiceRelay | null {
  for (const relay of activeRelays.values()) {
    if (relay.side1.guildId === guildId || relay.side2.guildId === guildId) {
      return relay;
    }
  }
  return null;
}
