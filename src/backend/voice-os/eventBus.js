import { EventEmitter } from 'events';
export class VoiceOSEventBus {
    emitter = new EventEmitter();
    telemetryRingBuffer = [];
    maxBufferSize = 250;
    subscribersCount = new Map();
    constructor() {
        this.emitter.setMaxListeners(100);
    }
    on(event, handler) {
        const wrapper = async (payload) => {
            const start = Date.now();
            try {
                await handler(payload);
                this.recordTelemetry(event, payload, Date.now() - start);
            }
            catch (err) {
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
    emit(event, payload) {
        this.recordTelemetry(event, payload);
        return this.emitter.emit(event, payload);
    }
    recordTelemetry(type, payload, latencyMs) {
        const record = {
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
    getRecentTelemetry(limit = 50, filterType) {
        let records = this.telemetryRingBuffer;
        if (filterType) {
            records = records.filter(r => r.type === filterType);
        }
        return records.slice(-limit);
    }
    clearTelemetry() {
        this.telemetryRingBuffer = [];
    }
}
export const globalVoiceBus = new VoiceOSEventBus();
