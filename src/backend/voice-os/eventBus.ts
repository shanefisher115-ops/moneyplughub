import { EventEmitter } from 'events';
import { VoiceEventType, VoiceEventMap } from './types';

export type VoiceEventHandler<T extends VoiceEventType> = (payload: VoiceEventMap[T]) => Promise<void> | void;

export interface TelemetryRecord {
  id: string;
  type: VoiceEventType;
  payload: unknown;
  timestamp: number;
  latencyMs?: number;
}

export class VoiceOSEventBus {
  private emitter = new EventEmitter();
  private telemetryRingBuffer: TelemetryRecord[] = [];
  private readonly maxBufferSize = 250;
  private subscribersCount = new Map<VoiceEventType, number>();

  constructor() {
    this.emitter.setMaxListeners(100);
  }

  public on<T extends VoiceEventType>(event: T, handler: VoiceEventHandler<T>): () => void {
    const wrapper = async (payload: VoiceEventMap[T]) => {
      const start = Date.now();
      try {
        await handler(payload);
        this.recordTelemetry(event, payload, Date.now() - start);
      } catch (err) {
        console.error(`[VoiceOS EventBus] Error in handler for ${event}:`, err);
      }
    };

    this.emitter.on(event, wrapper);
    const count = (this.subscribersCount.get(event) || 0) + 1;
    this.subscribersCount.set(event, count);

    return () => {
      this.emitter.off(event, wrapper);
      this.subscribersCount.set(event, Math.max(0, (this.subscribersCount.get(event) || 1) - 1));
    };
  }

  public emit<T extends VoiceEventType>(event: T, payload: VoiceEventMap[T]): boolean {
    this.recordTelemetry(event, payload);
    return this.emitter.emit(event, payload);
  }

  private recordTelemetry(type: VoiceEventType, payload: unknown, latencyMs?: number): void {
    const record: TelemetryRecord = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type,
      payload,
      timestamp: Date.now(),
      latencyMs
    };

    this.telemetryRingBuffer.push(record);
    if (this.telemetryRingBuffer.length > this.maxBufferSize) {
      this.telemetryRingBuffer.shift();
    }
  }

  public getRecentTelemetry(limit = 50, filterType?: VoiceEventType): TelemetryRecord[] {
    let records = this.telemetryRingBuffer;
    if (filterType) {
      records = records.filter(r => r.type === filterType);
    }
    return records.slice(-limit);
  }

  public clearTelemetry(): void {
    this.telemetryRingBuffer = [];
  }
}

export const globalVoiceBus = new VoiceOSEventBus();
