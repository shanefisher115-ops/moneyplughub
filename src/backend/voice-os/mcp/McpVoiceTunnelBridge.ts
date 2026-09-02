import { EventEmitter } from "events";
import crypto from "crypto";

export class McpVoiceTunnelBridge {
  private bus: EventEmitter;
  private encryptionKey: Buffer;

  constructor(bus: EventEmitter) {
    this.bus = bus;
    this.encryptionKey = crypto.randomBytes(32); // AES-256
  }

  encryptAudioChunk(chunk: Buffer) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", this.encryptionKey, iv);

    const encrypted = Buffer.concat([cipher.update(chunk), cipher.final()]);
    const tag = cipher.getAuthTag();

    return { encrypted, iv, tag };
  }

  sendToTunnel(tunnelId: string, chunk: Buffer) {
    const { encrypted, iv, tag } = this.encryptAudioChunk(chunk);

    const payload = {
      tunnelId,
      encrypted: encrypted.toString("base64"),
      iv: iv.toString("base64"),
      tag: tag.toString("base64"),
      encryptionKey: this.encryptionKey.toString("base64")
    };

    this.bus.emit("MCP_TUNNEL", payload);
    return payload;
  }
}
