export class McpSwarmBridge {
    bus;
    constructor(bus) {
        this.bus = bus;
    }
    activate(nodeId, realm) {
        const payload = { nodeId, realm, status: "ACTIVE" };
        this.bus.emit("MCP_SWARM", payload);
    }
    deactivate(nodeId, realm) {
        const payload = { nodeId, realm, status: "INACTIVE" };
        this.bus.emit("MCP_SWARM", payload);
    }
    emitDirective(nodeId, directive) {
        const payload = { nodeId, directive, timestamp: Date.now() };
        this.bus.emit("MCP_SWARM", payload);
    }
}
