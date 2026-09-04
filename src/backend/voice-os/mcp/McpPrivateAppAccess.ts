import { EventEmitter } from "events";

export class McpPrivateAppAccess {
  private bus: EventEmitter;

  constructor(bus: EventEmitter) {
    this.bus = bus;
  }

  verifyAccess(identity: { userId: string; role: string; devicePosture?: { trustScore?: number } }) {
    const allowedRoles = ["admin", "operator", "finance"];
    const roleAllowed = allowedRoles.includes(identity.role);

    const postureValid = (identity.devicePosture?.trustScore ?? 0) >= 80;

    const access = roleAllowed && postureValid;

    const payload = {
      userId: identity.userId,
      role: identity.role,
      postureValid,
      access
    };

    this.bus.emit("MCP_IDENTITY", payload);
    return access;
  }
}
