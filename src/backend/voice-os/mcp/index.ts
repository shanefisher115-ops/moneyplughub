import { EventEmitter } from "events";

import { McpIdentityGateway } from "./McpIdentityGateway";
import { McpZeroTrustEnforcer } from "./McpZeroTrustEnforcer";
import { McpVoiceTunnelBridge } from "./McpVoiceTunnelBridge";
import { McpPrivateAppAccess } from "./McpPrivateAppAccess";
import { McpSwarmBridge } from "./McpSwarmBridge";

export const bus = new EventEmitter();

export const mcp = {
  identity: new McpIdentityGateway(bus),
  zeroTrust: new McpZeroTrustEnforcer(bus),
  tunnel: new McpVoiceTunnelBridge(bus),
  privateAccess: new McpPrivateAppAccess(bus),
  swarm: new McpSwarmBridge(bus)
};

export {
  McpIdentityGateway,
  McpZeroTrustEnforcer,
  McpVoiceTunnelBridge,
  McpPrivateAppAccess,
  McpSwarmBridge
};
