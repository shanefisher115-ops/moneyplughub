import { EventEmitter } from "events";

export class McpSwarmBridge {
  private bus: EventEmitter;

  constructor(bus: EventEmitter) {
    this.bus = bus;
  }

  activate(nodeId: string, realm: string) {
    const payload = { nodeId, realm, status: "ACTIVE" };
    this.bus.emit("MCP_SWARM", payload);
  }

  deactivate(nodeId: string, realm: string) {
    const payload = { nodeId, realm, status: "INACTIVE" };
    this.bus.emit("MCP_SWARM", payload);
  }

  emitDirective(nodeId: string, directive: string) {
    const payload = { nodeId, directive, timestamp: Date.now() };
    this.bus.emit("MCP_SWARM", payload);
  }
}
